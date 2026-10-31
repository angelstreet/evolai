import type pg from 'pg';
import { USE_CASES, evidenceTagSchema, type EvidenceTag, type TenantId } from '@evolai/contracts';
import {
  proposeFindings,
  tagsInText,
  type FindingAxis,
  type FindingProposal,
  type MissionAnswer,
} from '@evolai/domain';
import { answerValueText, submittedCounts } from './answersData';
import { withTenant } from './db';
import { MIN_GROUP_SIZE } from './invitationTracking';
import { isOpenDispute, isReportable, REVIEW_MAX, reviewShortlist } from './findingRules';
import { tableReady } from './visitData';

export { isOpenDispute, isReportable, REVIEW_MAX, reviewShortlist };

/**
 * Findings of a mission (TASK-AJ A1 to A3, ADR 0058): engagement-level statements, each resting on
 * the answers it cites, written by the auditor from the Answers tab or proposed by a rule. Staff
 * only: the callers go through `resolveActor` or the staff guard. People are distinct submissions
 * of the cited answers, never the answers themselves.
 *
 * An approved finding cited by at least `MIN_GROUP_SIZE` people gets an approved opportunity of its
 * own (linked), so the catalogue proposes actions for it and the report can rank it. Under that
 * size it stays on staff pages ("not publishable"). Withdrawing it archives that opportunity and
 * rejects its actions.
 *
 * A finding can also rest on visit notes (A6, ADR 0059): one that cites a note is reportable
 * whatever its people count, because the auditor saw it on site; the report then says "seen on the
 * visit" instead of a count under the minimum. The referent can confirm or dispute an approved
 * finding (A8); an open dispute blocks publishing until the auditor marks it corrected or kept.
 *
 * Until migration 0029 is applied the reads answer `unavailable` and pages show nothing new; until
 * 0030, findings have no notes and no review.
 */

export const FINDING_AXES: readonly FindingAxis[] = [
  'literacy',
  'practice',
  'readiness',
  'opportunity',
  'context',
];

export type FindingStatus = 'draft' | 'approved' | 'rejected';

export interface FindingReview {
  readonly verdict: 'confirmed' | 'disputed';
  readonly comment: string;
  readonly resolution: 'corrected' | 'kept' | null;
}

export interface FindingRow {
  readonly id: string;
  readonly axis: FindingAxis;
  readonly label: string;
  readonly statement: string;
  readonly status: FindingStatus;
  readonly source: 'auditor' | 'rule';
  readonly tags: readonly EvidenceTag[];
  readonly people: number;
  /** Visit notes it cites (A6). */
  readonly notes: number;
  /** The referent's confirm or dispute (A8). */
  readonly review: FindingReview | null;
  /** Proposal rule (`tag:…` = keyword theme); null when written by the auditor. */
  readonly ruleKey: string | null;
  /** Picked for the referent's review (ADR 0062). */
  readonly forReview: boolean;
  readonly opportunityId: string | null;
}

export class FindingError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'FindingError';
  }
}

const cleanTags = (raw: unknown): EvidenceTag[] =>
  Array.isArray(raw) ? raw.flatMap((t) => (evidenceTagSchema.safeParse(t).success ? [t] : [])) : [];

const audit = (
  client: pg.PoolClient,
  tenantId: string,
  actor: string,
  action: string,
  targetId: string,
  payload: Record<string, unknown>,
) =>
  client.query(
    `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
     VALUES ($1, $2, $3, 'finding', $4, $5)`,
    [tenantId, actor, action, targetId, JSON.stringify(payload)],
  );

/** Which migrations are applied: 0029 (findings), 0030 (notes and reviews). */
interface Ready {
  readonly findings: boolean;
  readonly visit: boolean;
  readonly pick: boolean;
}

const readiness = async (client: pg.PoolClient): Promise<Ready> => ({
  findings: await tableReady(client, 'findings'),
  visit: await tableReady(client, 'finding_reviews'),
  pick: await pickReady(client),
});

/** `opportunities.use_case_id` exists (migration 0034, ADR 0064). */
const useCaseColumn = async (client: pg.PoolClient): Promise<boolean> =>
  (
    await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'opportunities' AND column_name = 'use_case_id'`,
    )
  ).rowCount === 1;

/** `findings.for_review` exists (migration 0033, ADR 0062). */
const pickReady = async (client: pg.PoolClient): Promise<boolean> =>
  (
    await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'findings' AND column_name = 'for_review'`,
    )
  ).rowCount === 1;

const selectFindings = (ready: Ready) => `
  SELECT f.id, f.axis, f.label, f.statement, f.status, f.source, f.tags, f.rule_key,
         ${ready.pick ? 'f.for_review' : 'false AS for_review'},
         (SELECT count(DISTINCT a.submission_id)::int FROM finding_evidence fe
            JOIN answers a ON a.id = fe.answer_id
            JOIN submissions s ON s.id = a.submission_id AND s.status = 'submitted'
           WHERE fe.finding_id = f.id) AS people,
         ${
           ready.visit
             ? `(SELECT count(*)::int FROM finding_notes fn WHERE fn.finding_id = f.id) AS notes,
         fr.verdict, fr.comment AS review_comment, fr.resolution,`
             : `0 AS notes, NULL::text AS verdict, NULL::text AS review_comment, NULL::text AS resolution,`
         }
         (SELECT ofi.opportunity_id FROM opportunity_findings ofi
            JOIN opportunities o ON o.id = ofi.opportunity_id AND o.status <> 'archived'
           WHERE ofi.finding_id = f.id LIMIT 1) AS opportunity_id
    FROM findings f
    ${ready.visit ? 'LEFT JOIN finding_reviews fr ON fr.finding_id = f.id' : ''}
   WHERE f.tenant_id = $1 AND f.engagement_id = $2`;

type DbFinding = {
  id: string;
  axis: FindingAxis;
  label: string;
  statement: string;
  status: FindingStatus;
  source: 'auditor' | 'rule';
  tags: unknown;
  people: number;
  notes: number;
  verdict: 'confirmed' | 'disputed' | null;
  review_comment: string | null;
  resolution: 'corrected' | 'kept' | null;
  opportunity_id: string | null;
  rule_key: string | null;
  for_review: boolean;
};

const fromDb = (r: DbFinding): FindingRow => ({
  id: r.id,
  axis: r.axis,
  label: r.label,
  statement: r.statement,
  status: r.status,
  source: r.source,
  tags: cleanTags(r.tags),
  people: Number(r.people),
  notes: Number(r.notes),
  review: r.verdict
    ? { verdict: r.verdict, comment: r.review_comment ?? '', resolution: r.resolution }
    : null,
  opportunityId: r.opportunity_id,
  ruleKey: r.rule_key,
  forReview: r.for_review === true,
});

/** Every finding of the mission, rejected ones last; `null` before migration 0029. */
export const listFindingsWith = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<FindingRow[] | null> => {
  const ready = await readiness(client);
  if (!ready.findings) return null;
  const { rows } = await client.query<DbFinding>(
    `${selectFindings(ready)}
     ORDER BY CASE f.status WHEN 'approved' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, f.created_at, f.id`,
    [tenantId, engagementId],
  );
  return rows.map(fromDb);
};

export const listFindings = (tenantId: TenantId, engagementId: string) =>
  withTenant(tenantId, (c) => listFindingsWith(c, tenantId, engagementId));

export interface ApprovedFinding {
  readonly id: string;
  /** A theme from the free texts (`tag:` rule): evidence for a use case, not a key finding (ADR 0064). */
  readonly theme: boolean;
  /** Evidence patterns, for the risks the report starts with. */
  readonly tags: readonly EvidenceTag[];
  readonly axis: string;
  readonly label: string;
  /** People behind it, or 0 when under the minimum (then it was seen on the visit). */
  readonly people: number;
  /** Rests on visit notes. */
  readonly visit: boolean;
  /** The referent disputed it and the auditor kept it: the report says so. */
  readonly disputed: boolean;
}

/**
 * What a report and the client may show: approved findings cited by at least `minPeople`, or by a
 * visit note. A count under the minimum is never shown.
 */
export const loadApprovedFindings = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
  minPeople: number = MIN_GROUP_SIZE,
): Promise<ApprovedFinding[]> =>
  ((await listFindingsWith(client, tenantId, engagementId)) ?? [])
    .filter((f) => f.status === 'approved' && isReportable(f, minPeople))
    .map((f) => ({
      id: f.id,
      theme: f.ruleKey?.startsWith('tag:') === true,
      tags: f.tags,
      axis: f.axis,
      label: f.label,
      people: f.people >= minPeople ? f.people : 0,
      visit: f.notes > 0,
      disputed: f.review?.verdict === 'disputed' && f.review.resolution === 'kept',
    }))
    .sort((a, b) => b.people - a.people || a.label.localeCompare(b.label));

/** The referent's review, counted for the method note (A8). */
export const reviewCountsWith = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<{ disputed: number; corrected: number; open: number }> => {
  const all = (await listFindingsWith(client, tenantId, engagementId)) ?? [];
  const disputed = all.filter((f) => f.status !== 'draft' && f.review?.verdict === 'disputed');
  return {
    disputed: disputed.length,
    corrected: disputed.filter((f) => f.review?.resolution === 'corrected').length,
    open: all.filter(isOpenDispute).length,
  };
};

/** Labels and evidence patterns of the approved findings an opportunity was made from. */
export const linkedFindingWords = async (
  client: pg.PoolClient,
  tenantId: string,
  opportunityId: string,
): Promise<{ labels: string[]; tags: EvidenceTag[] }> => {
  if (!(await tableReady(client, 'findings'))) return { labels: [], tags: [] };
  const { rows } = await client.query<{ label: string; statement: string; tags: unknown }>(
    `SELECT f.label, f.statement, f.tags FROM opportunity_findings ofi
       JOIN findings f ON f.id = ofi.finding_id AND f.status = 'approved'
      WHERE ofi.tenant_id = $1 AND ofi.opportunity_id = $2`,
    [tenantId, opportunityId],
  );
  return {
    labels: rows.flatMap((r) => [r.label, r.statement]),
    tags: [...new Set(rows.flatMap((r) => cleanTags(r.tags)))],
  };
};

// ---------------------------------------------------------------------------------------------
// Answers of the mission, as evidence
// ---------------------------------------------------------------------------------------------

interface EvidenceRow {
  answer_id: string;
  submission_id: string;
  code: string;
  kind: string;
  prompt: string;
  options_json: unknown;
  value_json: unknown;
}

const loadEvidenceRows = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<EvidenceRow[]> =>
  (
    await client.query<EvidenceRow>(
      `SELECT a.id AS answer_id, a.submission_id, q.code, q.kind, q.prompt, q.options_json, a.value_json
         FROM answers a
         JOIN submissions s ON s.id = a.submission_id
         JOIN question_items q ON q.id = a.question_item_id
        WHERE a.tenant_id = $1 AND s.tenant_id = $1 AND s.engagement_id = $2 AND s.status = 'submitted'`,
      [tenantId, engagementId],
    )
  ).rows;

/** The stored answer as a proposal input: a choice's option value, or the text written. */
export const toMissionAnswer = (r: EvidenceRow): MissionAnswer | null => {
  const v = (r.value_json ?? {}) as Record<string, unknown>;
  if (typeof v['choice'] === 'string') {
    return {
      answerId: r.answer_id,
      submissionId: r.submission_id,
      code: r.code,
      kind: 'choice',
      value: v['choice'],
    };
  }
  if (typeof v['text'] === 'string' && v['text'].trim() !== '') {
    return {
      answerId: r.answer_id,
      submissionId: r.submission_id,
      code: r.code,
      kind: 'text',
      value: v['text'],
    };
  }
  return null;
};

const minimumMet = async (client: pg.PoolClient, tenantId: string, engagementId: string) => {
  const n = (await submittedCounts(client, tenantId, engagementId)).get(engagementId) ?? 0;
  if (n < MIN_GROUP_SIZE) throw new FindingError('few_people');
};

// ---------------------------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------------------------

/** Give an approved finding with enough people its own approved opportunity (once). */
const ensureOpportunity = async (
  client: pg.PoolClient,
  tenantId: string,
  actor: string,
  engagementId: string,
  findingId: string,
): Promise<boolean> => {
  const [row] = (
    await client.query<DbFinding>(`${selectFindings(await readiness(client))} AND f.id = $3`, [
      tenantId,
      engagementId,
      findingId,
    ])
  ).rows;
  const f = row ? fromDb(row) : null;
  if (!f || f.status !== 'approved' || !isReportable(f) || f.opportunityId) return false;
  // With use cases (ADR 0064) the report groups findings into use cases. A finding the auditor
  // wrote that names no use case keeps an opportunity of its own, so it still gets actions.
  if (await useCaseColumn(client)) {
    if (f.ruleKey !== null) return false;
    const tags = new Set([...f.tags, ...tagsInText(f.label)]);
    if (USE_CASES.some((u) => u.evidence.some((t) => tags.has(t)))) return false;
  }
  const made = await client.query<{ id: string }>(
    `INSERT INTO opportunities (tenant_id, engagement_id, status, title, description, axis, created_by)
     VALUES ($1, $2, 'approved', $3, $4, $5, $6) RETURNING id`,
    [tenantId, engagementId, f.label, f.statement, f.axis, actor],
  );
  const opportunityId = (made.rows[0] as { id: string }).id;
  await client.query(
    `INSERT INTO opportunity_findings (tenant_id, opportunity_id, finding_id) VALUES ($1, $2, $3)`,
    [tenantId, opportunityId, findingId],
  );
  await client.query(
    `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
     VALUES ($1, $2, 'opportunity.create', 'opportunity', $3, $4)`,
    [tenantId, actor, opportunityId, JSON.stringify({ findingId, source: 'finding' })],
  );
  return true;
};

export interface NewFinding {
  readonly label: string;
  readonly statement: string;
  readonly axis: FindingAxis;
  /** Free-text answers ticked in the Answers tab. */
  readonly answerIds: readonly string[];
  /** Choice options ticked in the Answers tab: question code and the option's shown label. */
  readonly choices: ReadonlyArray<{ code: string; label: string }>;
  /** Visit notes ticked in the Visit tab (A6). */
  readonly noteIds?: readonly string[];
}

/**
 * A finding the auditor writes from the Answers or the Visit tab. Writing it is the approval: it is
 * saved approved, with the ticked answers (only this mission's finished surveys, and only from five
 * of them) and the ticked visit notes (only this mission's) as evidence.
 */
export const createFinding = (
  tenantId: TenantId,
  actor: string,
  engagementId: string,
  input: NewFinding,
): Promise<{ id: string; people: number }> =>
  withTenant(tenantId, async (client) => {
    const wanted = input.noteIds ?? [];
    const notes =
      wanted.length > 0 && (await tableReady(client, 'visit_notes'))
        ? (
            await client.query<{ id: string }>(
              `SELECT id FROM visit_notes
                WHERE tenant_id = $1 AND engagement_id = $2 AND id = ANY($3::uuid[])`,
              [tenantId, engagementId, wanted],
            )
          ).rows.map((r) => r.id)
        : [];
    const fromAnswers = input.answerIds.length > 0 || input.choices.length > 0;
    if (fromAnswers) await minimumMet(client, tenantId, engagementId);
    const rows = fromAnswers ? await loadEvidenceRows(client, tenantId, engagementId) : [];
    const ticked = new Set(input.answerIds);
    const evidence = rows.filter(
      (r) =>
        ticked.has(r.answer_id) ||
        input.choices.some(
          (c) =>
            c.code === r.code &&
            answerValueText(r.value_json, r.options_json).split(' | ').includes(c.label),
        ),
    );
    if (evidence.length === 0 && notes.length === 0) throw new FindingError('no_evidence');
    const ins = await client.query<{ id: string }>(
      `INSERT INTO findings (tenant_id, engagement_id, axis, label, statement, status, source, created_by)
       VALUES ($1, $2, $3, $4, $5, 'approved', 'auditor', $6) RETURNING id`,
      [tenantId, engagementId, input.axis, input.label, input.statement, actor],
    );
    const id = (ins.rows[0] as { id: string }).id;
    await client.query(
      `INSERT INTO finding_evidence (tenant_id, finding_id, answer_id)
       SELECT $1, $2, unnest($3::uuid[])`,
      [tenantId, id, evidence.map((r) => r.answer_id)],
    );
    if (notes.length > 0) {
      await client.query(
        `INSERT INTO finding_notes (tenant_id, finding_id, note_id) SELECT $1, $2, unnest($3::uuid[])`,
        [tenantId, id, notes],
      );
    }
    const people = new Set(evidence.map((r) => r.submission_id)).size;
    await audit(client, tenantId, actor, 'finding.create', id, {
      engagementId,
      answers: evidence.length,
      notes: notes.length,
      people,
    });
    await ensureOpportunity(client, tenantId, actor, engagementId, id);
    return { id, people };
  });

/** Words of a rule proposal, in the mission's language (`question` is the stored prompt). */
export type ProposalWords = (
  p: FindingProposal,
  question: string,
) => { label: string; statement: string };

/** Run the rules on the mission's answers and save new proposals as drafts; returns how many. */
export const proposeMissionFindings = (
  tenantId: TenantId,
  actor: string,
  engagementId: string,
  words: (locale: 'fr' | 'en') => ProposalWords,
): Promise<number> =>
  withTenant(tenantId, async (client) => {
    await minimumMet(client, tenantId, engagementId);
    const eng = await client.query<{ locale: 'fr' | 'en' }>(
      'SELECT locale FROM engagements WHERE tenant_id = $1 AND id = $2',
      [tenantId, engagementId],
    );
    const locale = eng.rows[0]?.locale;
    if (!locale) throw new FindingError('not_found');
    const rows = await loadEvidenceRows(client, tenantId, engagementId);
    const prompts = new Map(rows.map((r) => [r.code, r.prompt]));
    const say = words(locale);
    let added = 0;
    for (const p of proposeFindings(rows.flatMap((r) => toMissionAnswer(r) ?? []))) {
      const code = p.rule.kind === 'tag' ? '' : p.rule.code;
      const { label, statement } = say(p, prompts.get(code) ?? '');
      const ins = await client.query<{ id: string }>(
        `INSERT INTO findings (tenant_id, engagement_id, axis, label, statement, status, source,
                               rule_key, tags, created_by)
         VALUES ($1, $2, $3, $4, $5, 'draft', 'rule', $6, $7, $8)
         ON CONFLICT (engagement_id, rule_key) DO NOTHING RETURNING id`,
        [
          tenantId,
          engagementId,
          p.axis,
          label.slice(0, 200),
          statement.slice(0, 600),
          p.ruleKey,
          p.tags,
          actor,
        ],
      );
      const id = ins.rows[0]?.id;
      if (!id) continue;
      await client.query(
        `INSERT INTO finding_evidence (tenant_id, finding_id, answer_id)
         SELECT $1, $2, unnest($3::uuid[])`,
        [tenantId, id, p.answerIds],
      );
      added += 1;
    }
    await audit(client, tenantId, actor, 'finding.propose', engagementId, { engagementId, added });
    return added;
  });

/**
 * Approve or reject a finding, or withdraw an approved one (back to rejected). Approving gives it
 * an opportunity when it has enough people; withdrawing archives that opportunity and rejects the
 * actions the auditor had under it, so nothing of it reaches the report.
 */
export const decideFinding = (
  tenantId: TenantId,
  actor: string,
  findingId: string,
  to: 'approved' | 'rejected',
): Promise<{ engagementId: string; opportunity: boolean }> =>
  withTenant(tenantId, async (client) => {
    const cur = await client.query<{ engagement_id: string; status: FindingStatus }>(
      'SELECT engagement_id, status FROM findings WHERE tenant_id = $1 AND id = $2 FOR UPDATE',
      [tenantId, findingId],
    );
    const f = cur.rows[0];
    if (!f) throw new FindingError('not_found');
    await client.query(
      'UPDATE findings SET status = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2',
      [tenantId, findingId, to],
    );
    await audit(
      client,
      tenantId,
      actor,
      `finding.${to === 'approved' ? 'approve' : 'reject'}`,
      findingId,
      {
        from: f.status,
      },
    );
    if (to === 'approved') {
      const opportunity = await ensureOpportunity(
        client,
        tenantId,
        actor,
        f.engagement_id,
        findingId,
      );
      return { engagementId: f.engagement_id, opportunity };
    }
    // A use case rests on several findings: it is archived only when none of them stays approved.
    const keepUseCases = (await useCaseColumn(client))
      ? `AND (o.use_case_id IS NULL OR NOT EXISTS (
           SELECT 1 FROM opportunity_findings o2 JOIN findings f2 ON f2.id = o2.finding_id
            WHERE o2.opportunity_id = o.id AND o2.finding_id <> $2 AND f2.status = 'approved'))`
      : '';
    const linked = await client.query<{ id: string }>(
      `UPDATE opportunities o SET status = 'archived', archived_at = now(), updated_at = now()
         FROM opportunity_findings ofi
        WHERE ofi.finding_id = $2 AND ofi.opportunity_id = o.id AND o.tenant_id = $1
          AND o.status <> 'archived' ${keepUseCases}
        RETURNING o.id`,
      [tenantId, findingId],
    );
    for (const o of linked.rows) {
      await client.query(
        `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
         VALUES ($1, $2, 'opportunity.archive', 'opportunity', $3, $4)`,
        [tenantId, actor, o.id, JSON.stringify({ findingId })],
      );
      await client.query(
        `UPDATE report_steps SET status = 'rejected', updated_at = now()
          WHERE tenant_id = $1 AND opportunity_id = $2 AND status <> 'rejected'`,
        [tenantId, o.id],
      );
    }
    return { engagementId: f.engagement_id, opportunity: false };
  });

// ---------------------------------------------------------------------------------------------
// The referent's review (A8)
// ---------------------------------------------------------------------------------------------

export interface ReviewItem {
  readonly id: string;
  readonly label: string;
  /** The approved sentence the report will carry (ADR 0063); never evidence or answers. */
  readonly statement: string;
  /** People behind it, or 0 when it rests on the visit only. */
  readonly people: number;
  readonly review: FindingReview | null;
}

/**
 * What the referent reviews: the approved, reportable findings of the mission, with the sentence
 * the report will carry and the count (no evidence, no answer), while the working report is in
 * review. Empty otherwise.
 */
export const reviewItemsWith = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<ReviewItem[]> => {
  if (!(await tableReady(client, 'finding_reviews'))) return [];
  const report = await client.query<{ status: string }>(
    'SELECT status FROM audit_reports WHERE tenant_id = $1 AND engagement_id = $2',
    [tenantId, engagementId],
  );
  if (report.rows[0]?.status !== 'in_review') return [];
  return reviewShortlist((await listFindingsWith(client, tenantId, engagementId)) ?? []).map(
    (f) => ({
      id: f.id,
      label: f.label,
      statement: f.statement,
      people: f.people >= MIN_GROUP_SIZE ? f.people : 0,
      review: f.review,
    }),
  );
};

/** Whether the auditor can pick the findings for the referent's review (migration 0033). */
export const canPickForReview = (tenantId: TenantId) => withTenant(tenantId, (c) => pickReady(c));

/**
 * Pick or unpick an approved finding for the referent's review (ADR 0062), at most `REVIEW_MAX`.
 * Not once the report is published.
 */
export const setForReview = (
  tenantId: TenantId,
  actor: string,
  findingId: string,
  forReview: boolean,
): Promise<void> =>
  withTenant(tenantId, async (client) => {
    if (!(await pickReady(client))) throw new FindingError('unavailable');
    const { rows } = await client.query<{ engagement_id: string; status: string }>(
      'SELECT engagement_id, status FROM findings WHERE tenant_id = $1 AND id = $2',
      [tenantId, findingId],
    );
    const f = rows[0];
    if (!f || f.status !== 'approved') throw new FindingError('not_found');
    const report = await client.query<{ status: string }>(
      'SELECT status FROM audit_reports WHERE tenant_id = $1 AND engagement_id = $2',
      [tenantId, f.engagement_id],
    );
    if (report.rows[0]?.status === 'published') throw new FindingError('locked');
    if (forReview) {
      const picked = await client.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM findings
          WHERE tenant_id = $1 AND engagement_id = $2 AND for_review AND id <> $3`,
        [tenantId, f.engagement_id, findingId],
      );
      if ((picked.rows[0]?.n ?? 0) >= REVIEW_MAX) throw new FindingError('too_many');
    }
    await client.query('UPDATE findings SET for_review = $3 WHERE tenant_id = $1 AND id = $2', [
      tenantId,
      findingId,
      forReview,
    ]);
    await audit(client, tenantId, actor, 'finding.update', findingId, { forReview });
  });

export const reviewItems = (tenantId: TenantId, engagementId: string) =>
  withTenant(tenantId, (c) => reviewItemsWith(c, tenantId, engagementId));

/** The referent confirms or disputes one finding of their mission; a new verdict replaces the old. */
export const reviewFinding = (
  tenantId: TenantId,
  actor: string,
  engagementId: string,
  findingId: string,
  verdict: 'confirmed' | 'disputed',
  comment: string,
): Promise<void> =>
  withTenant(tenantId, async (client) => {
    const items = await reviewItemsWith(client, tenantId, engagementId);
    if (!items.some((i) => i.id === findingId)) throw new FindingError('not_found');
    if (verdict === 'disputed' && comment.trim().length < 3) {
      throw new FindingError('bad_input');
    }
    await client.query(
      `INSERT INTO finding_reviews (finding_id, tenant_id, verdict, comment, reviewed_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (finding_id) DO UPDATE
         SET verdict = EXCLUDED.verdict, comment = EXCLUDED.comment,
             reviewed_by = EXCLUDED.reviewed_by, reviewed_at = now(),
             resolution = NULL, resolved_by = NULL, resolved_at = NULL`,
      [findingId, tenantId, verdict, comment.trim().slice(0, 300), actor],
    );
    await audit(
      client,
      tenantId,
      actor,
      verdict === 'confirmed' ? 'finding.confirm' : 'finding.dispute',
      findingId,
      { engagementId },
    );
  });

/** The auditor answers a dispute: corrected (the finding was changed) or kept as it is. */
export const resolveDispute = (
  tenantId: TenantId,
  actor: string,
  findingId: string,
  resolution: 'corrected' | 'kept',
): Promise<void> =>
  withTenant(tenantId, async (client) => {
    if (!(await tableReady(client, 'finding_reviews'))) throw new FindingError('not_found');
    const res = await client.query(
      `UPDATE finding_reviews SET resolution = $3, resolved_by = $4, resolved_at = now()
        WHERE tenant_id = $1 AND finding_id = $2 AND verdict = 'disputed'`,
      [tenantId, findingId, resolution, actor],
    );
    if ((res.rowCount ?? 0) === 0) throw new FindingError('not_found');
    await audit(client, tenantId, actor, 'finding.resolve', findingId, { resolution });
  });

// ---------------------------------------------------------------------------------------------
// Editing a finding (ADR 0060)
// ---------------------------------------------------------------------------------------------

/** True once migration 0031 (the `finding.update` audit verb) is applied. */
const editReady = async (client: pg.PoolClient): Promise<boolean> =>
  (
    await client.query(
      `SELECT 1 FROM pg_constraint
        WHERE conname = 'audit_log_action_check'
          AND pg_get_constraintdef(oid) LIKE '%finding.update%'`,
    )
  ).rowCount === 1;

export const canEditFindings = (tenantId: TenantId): Promise<boolean> =>
  withTenant(tenantId, editReady);

/**
 * Reword a finding (title, sentence, axis). Its evidence does not change. The opportunity made from
 * it follows, so the report's action list says the same thing. Editing a finding the referent
 * disputed answers the dispute as "corrected".
 */
export const updateFinding = (
  tenantId: TenantId,
  actor: string,
  findingId: string,
  input: { label: string; statement: string; axis: FindingAxis },
): Promise<{ engagementId: string }> =>
  withTenant(tenantId, async (client) => {
    if (!(await editReady(client))) throw new FindingError('unavailable');
    const res = await client.query<{ engagement_id: string }>(
      `UPDATE findings SET label = $3, statement = $4, axis = $5, updated_at = now()
        WHERE tenant_id = $1 AND id = $2 AND status <> 'rejected'
        RETURNING engagement_id`,
      [tenantId, findingId, input.label, input.statement, input.axis],
    );
    const engagementId = res.rows[0]?.engagement_id;
    if (!engagementId) throw new FindingError('not_found');
    // A use case keeps its own name: it rests on several findings (ADR 0064).
    const ownOnly = (await useCaseColumn(client)) ? 'AND o.use_case_id IS NULL' : '';
    await client.query(
      `UPDATE opportunities o SET title = $3, description = $4, axis = $5, updated_at = now()
         FROM opportunity_findings ofi
        WHERE ofi.finding_id = $2 AND ofi.opportunity_id = o.id AND o.tenant_id = $1
          AND o.status <> 'archived' ${ownOnly}`,
      [tenantId, findingId, input.label, input.statement, input.axis],
    );
    await audit(client, tenantId, actor, 'finding.update', findingId, { engagementId });
    if (await tableReady(client, 'finding_reviews')) {
      const resolved = await client.query(
        `UPDATE finding_reviews SET resolution = 'corrected', resolved_by = $3, resolved_at = now()
          WHERE tenant_id = $1 AND finding_id = $2 AND verdict = 'disputed' AND resolution IS NULL`,
        [tenantId, findingId, actor],
      );
      if ((resolved.rowCount ?? 0) > 0) {
        await audit(client, tenantId, actor, 'finding.resolve', findingId, {
          resolution: 'corrected',
          byEdit: true,
        });
      }
    }
    return { engagementId };
  });
