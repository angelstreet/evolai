import type pg from 'pg';
import { evidenceTagSchema, type EvidenceTag, type TenantId } from '@evolai/contracts';
import {
  proposeFindings,
  type FindingAxis,
  type FindingProposal,
  type MissionAnswer,
} from '@evolai/domain';
import { answerValueText, submittedCounts } from './answersData';
import { withTenant } from './db';
import { MIN_GROUP_SIZE } from './invitationTracking';

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
 * Until migration 0029 is applied the reads answer `unavailable` and pages show nothing new.
 */

export const FINDING_AXES: readonly FindingAxis[] = [
  'literacy',
  'practice',
  'readiness',
  'opportunity',
  'context',
];

export type FindingStatus = 'draft' | 'approved' | 'rejected';

export interface FindingRow {
  readonly id: string;
  readonly axis: FindingAxis;
  readonly label: string;
  readonly statement: string;
  readonly status: FindingStatus;
  readonly source: 'auditor' | 'rule';
  readonly tags: readonly EvidenceTag[];
  readonly people: number;
  readonly opportunityId: string | null;
}

export class FindingError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'FindingError';
  }
}

/** Postgres "relation does not exist": migration 0029 is not applied yet. */
const missingTable = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === '42P01';

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

const SELECT_FINDINGS = `
  SELECT f.id, f.axis, f.label, f.statement, f.status, f.source, f.tags,
         (SELECT count(DISTINCT a.submission_id)::int FROM finding_evidence fe
            JOIN answers a ON a.id = fe.answer_id
            JOIN submissions s ON s.id = a.submission_id AND s.status = 'submitted'
           WHERE fe.finding_id = f.id) AS people,
         (SELECT ofi.opportunity_id FROM opportunity_findings ofi
            JOIN opportunities o ON o.id = ofi.opportunity_id AND o.status <> 'archived'
           WHERE ofi.finding_id = f.id LIMIT 1) AS opportunity_id
    FROM findings f
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
  opportunity_id: string | null;
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
  opportunityId: r.opportunity_id,
});

/** Every finding of the mission, rejected ones last; `null` before migration 0029. */
export const listFindingsWith = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<FindingRow[] | null> => {
  await client.query('SAVEPOINT findings_read');
  try {
    const { rows } = await client.query<DbFinding>(
      `${SELECT_FINDINGS}
       ORDER BY CASE f.status WHEN 'approved' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, f.created_at, f.id`,
      [tenantId, engagementId],
    );
    await client.query('RELEASE SAVEPOINT findings_read');
    return rows.map(fromDb);
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT findings_read');
    if (missingTable(err)) return null;
    throw err;
  }
};

export const listFindings = (tenantId: TenantId, engagementId: string) =>
  withTenant(tenantId, (c) => listFindingsWith(c, tenantId, engagementId));

/** What a report and the client may show: approved findings cited by at least `minPeople`. */
export const loadApprovedFindings = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
  minPeople: number = MIN_GROUP_SIZE,
): Promise<{ axis: string; label: string; people: number }[]> =>
  ((await listFindingsWith(client, tenantId, engagementId)) ?? [])
    .filter((f) => f.status === 'approved' && f.people >= minPeople)
    .sort((a, b) => b.people - a.people || a.label.localeCompare(b.label))
    .map((f) => ({ axis: f.axis, label: f.label, people: f.people }));

/** Labels and evidence patterns of the approved findings an opportunity was made from. */
export const linkedFindingWords = async (
  client: pg.PoolClient,
  tenantId: string,
  opportunityId: string,
): Promise<{ labels: string[]; tags: EvidenceTag[] }> => {
  await client.query('SAVEPOINT findings_linked');
  try {
    const { rows } = await client.query<{ label: string; statement: string; tags: unknown }>(
      `SELECT f.label, f.statement, f.tags FROM opportunity_findings ofi
         JOIN findings f ON f.id = ofi.finding_id AND f.status = 'approved'
        WHERE ofi.tenant_id = $1 AND ofi.opportunity_id = $2`,
      [tenantId, opportunityId],
    );
    await client.query('RELEASE SAVEPOINT findings_linked');
    return {
      labels: rows.flatMap((r) => [r.label, r.statement]),
      tags: [...new Set(rows.flatMap((r) => cleanTags(r.tags)))],
    };
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT findings_linked');
    if (missingTable(err)) return { labels: [], tags: [] };
    throw err;
  }
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
  const [f] = (
    await client.query<DbFinding>(`${SELECT_FINDINGS} AND f.id = $3`, [
      tenantId,
      engagementId,
      findingId,
    ])
  ).rows;
  if (!f || f.status !== 'approved' || Number(f.people) < MIN_GROUP_SIZE || f.opportunity_id) {
    return false;
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
}

/**
 * A finding the auditor writes from the Answers tab. Writing it is the approval: it is saved
 * approved, with the ticked answers as evidence (only answers of this mission's finished surveys).
 */
export const createFinding = (
  tenantId: TenantId,
  actor: string,
  engagementId: string,
  input: NewFinding,
): Promise<{ id: string; people: number }> =>
  withTenant(tenantId, async (client) => {
    await minimumMet(client, tenantId, engagementId);
    const rows = await loadEvidenceRows(client, tenantId, engagementId);
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
    if (evidence.length === 0) throw new FindingError('no_evidence');
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
    const people = new Set(evidence.map((r) => r.submission_id)).size;
    await audit(client, tenantId, actor, 'finding.create', id, {
      engagementId,
      answers: evidence.length,
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
    const linked = await client.query<{ id: string }>(
      `UPDATE opportunities o SET status = 'archived', archived_at = now(), updated_at = now()
         FROM opportunity_findings ofi
        WHERE ofi.finding_id = $2 AND ofi.opportunity_id = o.id AND o.tenant_id = $1
          AND o.status <> 'archived'
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
