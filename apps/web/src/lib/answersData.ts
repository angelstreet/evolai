import type pg from 'pg';
import type { EngagementId, TenantId } from '@evolai/contracts';
import { withTenant } from './db';
import { MIN_GROUP_SIZE } from './invitationTracking';

/**
 * What EvolAI staff may read of the answers (TASK-AA, TASK-AD2, ADR 0049). Ingestion already
 * anonymised every free text (ADR 0044), and nothing here is shown or exported unless at least
 * `MIN_GROUP_SIZE` people have submitted for the mission (for the brief: for the team): below
 * that, a lone answer could point at a person. The referent never reaches these functions; the
 * pages and the CSV route refuse a client session and view-as.
 */

export class AnswersGroupTooSmallError extends Error {
  constructor(readonly submitted: number) {
    super(`fewer than ${MIN_GROUP_SIZE} submissions (${submitted})`);
    this.name = 'AnswersGroupTooSmallError';
  }
}

interface AnswerDbRow {
  answer_id: string;
  respondent_pseudonym: string;
  engagement_id: string;
  team_id: string;
  question_code: string;
  question_kind: string;
  prompt: string;
  options_json: unknown;
  value_json: unknown;
  rationale: string | null;
  answered_at: string;
}

export interface AnswerLine {
  /** The stored answer (empty for the closing comment, which is not an answer row). */
  readonly answerId?: string;
  readonly pseudonym: string;
  readonly engagementId: string;
  readonly teamId: string;
  readonly questionCode: string;
  readonly question: string;
  /** `short_text` and `end_comment` hold what the person wrote; the other kinds hold a choice. */
  readonly kind: string;
  readonly value: string;
  readonly comment: string;
  readonly answeredAt: string;
}

/** Engagements of the tenant with at least `MIN_GROUP_SIZE` submitted surveys, with their count. */
export const submittedCounts = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId?: string,
): Promise<Map<string, number>> => {
  const { rows } = await client.query<{ engagement_id: string; n: string }>(
    `SELECT engagement_id, count(*)::text AS n FROM submissions
      WHERE tenant_id = $1 AND status = 'submitted' AND ($2::uuid IS NULL OR engagement_id = $2)
      GROUP BY engagement_id`,
    [tenantId, engagementId ?? null],
  );
  return new Map(rows.map((r) => [r.engagement_id, Number(r.n)]));
};

const labelOf = (options: unknown, value: string): string => {
  const list = Array.isArray(options)
    ? (options as Array<{ value?: unknown; label?: unknown }>)
    : [];
  const hit = list.find((o) => o.value === value);
  return typeof hit?.label === 'string' ? hit.label : value;
};

/** The shown form of one stored answer value. Skipped questions are an empty string. */
export const answerValueText = (value: unknown, options: unknown): string => {
  const v = (value ?? {}) as Record<string, unknown>;
  switch (v['kind']) {
    case 'single_choice':
    case 'scenario_choice':
      return typeof v['choice'] === 'string' ? labelOf(options, v['choice']) : '';
    case 'multi_choice':
      return Array.isArray(v['choices'])
        ? v['choices'].map((c) => labelOf(options, String(c))).join(' | ')
        : '';
    case 'short_text':
      return typeof v['text'] === 'string' ? v['text'] : '';
    case 'scale_5':
      return typeof v['value'] === 'number' ? String(v['value']) : '';
    case 'boolean':
      return typeof v['value'] === 'boolean' ? String(v['value']) : '';
    default:
      return '';
  }
};

/** Answers of the given engagements (all already past the minimum group), oldest first. */
export const loadAnswerLines = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementIds: readonly string[],
): Promise<AnswerLine[]> => {
  if (engagementIds.length === 0) return [];
  const { rows } = await client.query<AnswerDbRow>(
    `SELECT a.id AS answer_id, i.respondent_pseudonym, s.engagement_id, i.team_id, q.code AS question_code, q.kind AS question_kind,
            q.prompt, q.options_json, a.value_json, a.rationale, a.created_at AS answered_at
       FROM answers a
       JOIN submissions s ON s.id = a.submission_id
       JOIN invitations i ON i.id = s.invitation_id
       JOIN question_items q ON q.id = a.question_item_id
      WHERE a.tenant_id = $1 AND s.tenant_id = $1 AND s.status = 'submitted'
        AND s.engagement_id = ANY ($2::uuid[])
      ORDER BY a.created_at ASC, a.sequence ASC`,
    [tenantId, engagementIds],
  );
  const lines: AnswerLine[] = rows.map((r) => ({
    answerId: r.answer_id,
    pseudonym: r.respondent_pseudonym,
    engagementId: r.engagement_id,
    teamId: r.team_id,
    questionCode: r.question_code,
    question: r.prompt,
    kind: r.question_kind,
    value: answerValueText(r.value_json, r.options_json),
    comment: r.rationale ?? '',
    answeredAt: r.answered_at,
  }));
  const ends = await client.query<{
    respondent_pseudonym: string;
    engagement_id: string;
    team_id: string;
    end_comment: string;
    answered_at: string;
  }>(
    `SELECT i.respondent_pseudonym, s.engagement_id, i.team_id, s.end_comment, s.submitted_at AS answered_at
       FROM submissions s JOIN invitations i ON i.id = s.invitation_id
      WHERE s.tenant_id = $1 AND s.status = 'submitted' AND s.end_comment IS NOT NULL
        AND s.engagement_id = ANY ($2::uuid[])
      ORDER BY s.submitted_at ASC`,
    [tenantId, engagementIds],
  );
  for (const e of ends.rows) {
    lines.push({
      pseudonym: e.respondent_pseudonym,
      engagementId: e.engagement_id,
      teamId: e.team_id,
      questionCode: 'end_comment',
      question: '',
      kind: 'end_comment',
      value: e.end_comment,
      comment: '',
      answeredAt: e.answered_at,
    });
  }
  return lines;
};

/** The CSV columns: pseudonym, question, the anonymised value, when. Never a name or address. */
export const ANSWERS_CSV_COLUMNS = [
  'respondent_pseudonym',
  'question_code',
  'question',
  'answer',
  'comment',
  'answered_at',
] as const;

/** Rows of one mission's answers CSV; fewer than `MIN_GROUP_SIZE` submissions is a refusal. */
export const answersCsvRows = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<{ columns: string[]; values: unknown[][] }> => {
  const submitted = (await submittedCounts(client, tenantId, engagementId)).get(engagementId) ?? 0;
  if (submitted < MIN_GROUP_SIZE) throw new AnswersGroupTooSmallError(submitted);
  const lines = await loadAnswerLines(client, tenantId, [engagementId]);
  return {
    columns: [...ANSWERS_CSV_COLUMNS],
    values: lines.map((l) => [
      l.pseudonym,
      l.questionCode,
      l.question,
      l.value,
      l.comment,
      l.answeredAt,
    ]),
  };
};

export interface ChoiceCounts {
  readonly code: string;
  readonly question: string;
  /** How many people picked each option (labels as shown to the person), most picked first. */
  readonly counts: ReadonlyArray<{ label: string; n: number }>;
}

export interface AnswersView {
  readonly submitted: number;
  readonly choices: readonly ChoiceCounts[];
  /** Free texts, per question, with no link to a person and in a stable, unrelated order. */
  readonly texts: ReadonlyArray<{
    readonly code: string;
    readonly question: string;
    readonly items: readonly string[];
    /** The same texts with the answer each one is, for "Write a finding" (staff only, TASK-AJ). */
    readonly entries: ReadonlyArray<{ readonly id: string | null; readonly text: string }>;
  }>;
}

/** The role question: shown as the role mix, not as one more chart. */
export const isRoleQuestion = (code: string): boolean => /(^|_)(job_family|role)$/.test(code);

const TEXT_KINDS = new Set(['short_text', 'end_comment']);

/** Counts per choice and free texts per question. Pure; the caller has applied the minimum group. */
export const summariseAnswers = (
  lines: readonly AnswerLine[],
): Pick<AnswersView, 'choices' | 'texts'> => {
  const choiceMap = new Map<string, { question: string; counts: Map<string, number> }>();
  const textMap = new Map<
    string,
    { question: string; items: string[]; entries: { id: string | null; text: string }[] }
  >();
  const addText = (l: AnswerLine, text: string): void => {
    if (text === '') return;
    const e = textMap.get(l.questionCode) ?? { question: l.question, items: [], entries: [] };
    e.items.push(text);
    e.entries.push({ id: l.answerId || null, text });
    textMap.set(l.questionCode, e);
  };
  for (const l of lines) {
    if (TEXT_KINDS.has(l.kind)) {
      addText(l, l.value);
      continue;
    }
    if (l.value !== '') {
      const e = choiceMap.get(l.questionCode) ?? { question: l.question, counts: new Map() };
      for (const label of l.value.split(' | ')) {
        e.counts.set(label, (e.counts.get(label) ?? 0) + 1);
      }
      choiceMap.set(l.questionCode, e);
    }
    addText(l, l.comment);
  }
  return {
    choices: [...choiceMap].map(([code, e]) => ({
      code,
      question: e.question,
      counts: [...e.counts].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    })),
    texts: [...textMap].map(([code, e]) => ({
      code,
      question: e.question,
      items: [...e.items].sort((a, b) => a.localeCompare(b)),
      entries: [...e.entries].sort((a, b) => a.text.localeCompare(b.text)),
    })),
  };
};

/** Read-only view for one mission, or the count when it is below the minimum group. */
export const answersViewFor = (
  tenantId: TenantId,
  engagementId: EngagementId,
): Promise<AnswersView | { tooFew: number }> =>
  withTenant(tenantId, async (client) => {
    const submitted =
      (await submittedCounts(client, tenantId, engagementId)).get(engagementId) ?? 0;
    if (submitted < MIN_GROUP_SIZE) return { tooFew: submitted };
    const lines = await loadAnswerLines(client, tenantId, [engagementId]);
    return { submitted, ...summariseAnswers(lines) };
  });

export interface TeamBrief {
  readonly teamId: string;
  readonly teamName: string;
  readonly submitted: number;
  readonly expected: number;
  /** Fewer than `MIN_GROUP_SIZE` answers: only the counts are shown. */
  readonly hidden: boolean;
  readonly choices: readonly ChoiceCounts[];
  readonly roles: ChoiceCounts | null;
}

/** Per team: answers out of headcount, and from five answers the choice counts and the role mix. */
export const teamBriefs = (
  teams: ReadonlyArray<{ id: string; name: string; expected: number; submitted: number }>,
  lines: readonly AnswerLine[],
): TeamBrief[] =>
  teams.map((team) => {
    const hidden = team.submitted < MIN_GROUP_SIZE;
    const own = hidden ? [] : lines.filter((l) => l.teamId === team.id);
    const { choices } = summariseAnswers(own);
    return {
      teamId: team.id,
      teamName: team.name,
      submitted: team.submitted,
      expected: team.expected,
      hidden,
      choices: choices.filter((c) => !isRoleQuestion(c.code)),
      roles: choices.find((c) => isRoleQuestion(c.code)) ?? null,
    };
  });

/** The pre-visit brief of one mission: every team, gated per team. */
export const briefFor = (tenantId: TenantId, engagementId: EngagementId): Promise<TeamBrief[]> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      name: string;
      expected: number;
      submitted: number;
    }>(
      `SELECT t.id, t.name, t.expected_headcount AS expected,
              (SELECT count(*)::int FROM submissions s JOIN invitations i ON i.id = s.invitation_id
                WHERE s.tenant_id = $1 AND s.engagement_id = $2 AND s.status = 'submitted'
                  AND i.team_id = t.id) AS submitted
         FROM engagement_teams et JOIN teams t ON t.id = et.team_id
        WHERE et.engagement_id = $2 AND t.tenant_id = $1
        ORDER BY t.name`,
      [tenantId, engagementId],
    );
    const shown = rows.some((r) => r.submitted >= MIN_GROUP_SIZE);
    const lines = shown ? await loadAnswerLines(client, tenantId, [engagementId]) : [];
    return teamBriefs(rows, lines);
  });
