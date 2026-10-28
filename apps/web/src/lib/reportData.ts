import type pg from 'pg';
import {
  IMPROVEMENT_CATALOGUE_VERSION,
  catalogueEntry,
  planItemSchema,
  reportSnapshotSchema,
  type AnswerValue,
  type Horizon,
  type Level,
  type PlanItem,
  type QuestionItem,
  type ReadinessReport,
  type ReportFinding,
  type ReportSnapshot,
  type ReportStatus,
  type TenantId,
} from '@evolai/contracts';
import {
  buildPlan,
  computeReadiness,
  defaultHorizon,
  matchImprovements,
  rankOpportunities,
  scoreSubmission,
  type ScoredSubmission,
} from '@evolai/domain';
import { linkedFindingWords, loadApprovedFindings } from './findingsData';
import { withTenant } from './db';
import { MIN_GROUP_SIZE } from './invitationTracking';
import {
  buildSnapshot,
  findingKey,
  type OpportunityInput,
  type PublishCheck,
  type StepRow,
} from './reportModel';

/**
 * Audit report data layer (TASK-V, ADR 0041).
 *
 * Every function runs under `withTenant` (row-level security) with a tenant id the caller took
 * from the session, and every write appends its `audit_log` row in the same transaction. The
 * working report is edited only while it is a draft or in review; a published report is locked
 * until the auditor starts the next version. The client surface reads only
 * `audit_report_versions` rows that are published and not withdrawn (`loadPublishedReport`).
 */

export class ReportError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'ReportError';
  }
}

/** Opportunity states that count as approved by the auditor (same as the client results). */
const APPROVED_OPPORTUNITY = ['approved', 'in_progress', 'delivered'];
const EDITABLE: readonly ReportStatus[] = ['draft', 'in_review'];

export interface ReportRow {
  readonly id: string;
  readonly engagementId: string;
  readonly status: ReportStatus;
  readonly version: number;
  readonly locale: 'fr' | 'en';
  readonly title: string;
  readonly summary: string;
  readonly summaryCitations: string[];
  readonly risksNote: string;
  readonly methodology: string;
  readonly plan: PlanItem[];
  readonly catalogueVersion: string;
  readonly aiDraft: AiDraft | null;
  readonly updatedAt: string;
}

/** A model draft of the summary (ADR 0029 metadata). Never shown to the client as is. */
export interface AiDraft {
  readonly text: string;
  readonly citations: string[];
  readonly route: string;
  readonly promptVersion: string;
  readonly generatedAt: string;
}

interface ReportDbRow {
  id: string;
  engagement_id: string;
  status: ReportStatus;
  version: number;
  locale: 'fr' | 'en';
  title: string;
  summary: string;
  summary_citations: unknown;
  risks_note: string;
  methodology: string;
  plan_json: unknown;
  catalogue_version: string;
  ai_draft_json: unknown;
  updated_at: string;
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const parsePlan = (v: unknown): PlanItem[] =>
  Array.isArray(v)
    ? v.flatMap((x) => {
        const p = planItemSchema.safeParse(x);
        return p.success ? [p.data] : [];
      })
    : [];

const parseAiDraft = (v: unknown): AiDraft | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o['text'] !== 'string' || typeof o['route'] !== 'string') return null;
  return {
    text: o['text'],
    citations: strings(o['citations']),
    route: o['route'],
    promptVersion: typeof o['promptVersion'] === 'string' ? o['promptVersion'] : '',
    generatedAt: typeof o['generatedAt'] === 'string' ? o['generatedAt'] : '',
  };
};

const REPORT_COLS = `id, engagement_id, status, version, locale, title, summary, summary_citations,
  risks_note, methodology, plan_json, catalogue_version, ai_draft_json, updated_at`;

const fromReportRow = (r: ReportDbRow): ReportRow => ({
  id: r.id,
  engagementId: r.engagement_id,
  status: r.status,
  version: r.version,
  locale: r.locale,
  title: r.title,
  summary: r.summary,
  summaryCitations: strings(r.summary_citations),
  risksNote: r.risks_note,
  methodology: r.methodology,
  plan: parsePlan(r.plan_json),
  catalogueVersion: r.catalogue_version,
  aiDraft: parseAiDraft(r.ai_draft_json),
  updatedAt: r.updated_at,
});

interface StepDbRow {
  id: string;
  opportunity_id: string;
  catalogue_id: string | null;
  source: StepRow['source'];
  status: StepRow['status'];
  category: StepRow['category'];
  title: string;
  description: string;
  effort: Level;
  impact: Level;
  risk: Level;
  owner: string;
  horizon: Horizon;
  prerequisites: unknown;
  match_json: unknown;
}

const STEP_COLS = `id, opportunity_id, catalogue_id, source, status, category, title, description,
  effort, impact, risk, owner, horizon, prerequisites, match_json`;

const fromStepRow = (r: StepDbRow): StepRow => ({
  id: r.id,
  opportunityId: r.opportunity_id,
  catalogueId: r.catalogue_id,
  source: r.source,
  status: r.status,
  category: r.category,
  title: r.title,
  description: r.description,
  effort: r.effort,
  impact: r.impact,
  risk: r.risk,
  owner: r.owner,
  horizon: r.horizon,
  prerequisites: strings(r.prerequisites),
  tags: strings((r.match_json as { tags?: unknown } | null)?.tags),
});

const audit = async (
  client: pg.PoolClient,
  tenantId: string,
  actor: string,
  action: string,
  targetKind: 'report' | 'report_step',
  targetId: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  await client.query(
    `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, actor, action, targetKind, targetId, JSON.stringify(payload)],
  );
};

// ---------------------------------------------------------------------------------------------
// Inputs: approved findings, approved opportunities, readiness
// ---------------------------------------------------------------------------------------------

export interface ReportInputs {
  readonly organisation: string;
  readonly engagementName: string | null;
  readonly locale: 'fr' | 'en';
  readonly findings: ReportFinding[];
  readonly opportunities: OpportunityInput[];
  readonly readiness: ReadinessReport;
  /** People who finished the survey (a count only; the score still needs the minimum group). */
  readonly answered: number;
}

/** Approved findings cited by at least the minimum group (TASK-AJ, ADR 0058), most people first. */
const loadFindings = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<ReportFinding[]> =>
  (await loadApprovedFindings(client, tenantId, engagementId, MIN_GROUP_SIZE)).map((f) => ({
    key: findingKey(f.axis, f.label),
    axis: f.axis,
    label: f.label,
    people: f.people,
  }));

const loadReadiness = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<ReadinessReport> => {
  const items = await client.query<{
    id: string;
    axis: QuestionItem['axis'];
    kind: QuestionItem['kind'];
    options_json: unknown;
    scoring_json: unknown;
  }>(
    `SELECT qi.id, qi.axis, qi.kind, qi.options_json, qi.scoring_json
       FROM question_items qi
      WHERE qi.tenant_id = $1
        AND qi.id IN (SELECT a.question_item_id FROM answers a
                        JOIN submissions s ON s.id = a.submission_id
                       WHERE s.tenant_id = $1 AND s.engagement_id = $2)`,
    [tenantId, engagementId],
  );
  const itemsById = new Map<string, QuestionItem>(
    items.rows.map((r) => {
      const scoring = (r.scoring_json ?? {}) as { weight?: unknown; reverse?: unknown };
      return [
        r.id,
        {
          id: r.id,
          axis: r.axis,
          kind: r.kind,
          options: Array.isArray(r.options_json) ? r.options_json : [],
          scoring: {
            weight: typeof scoring.weight === 'number' ? scoring.weight : 1,
            reverse: scoring.reverse === true,
          },
        } as unknown as QuestionItem,
      ];
    }),
  );
  const answers = await client.query<{
    submission_id: string;
    team_id: string;
    question_item_id: string;
    value_json: AnswerValue;
  }>(
    `SELECT s.id AS submission_id, i.team_id, a.question_item_id, a.value_json
       FROM submissions s
       JOIN invitations i ON i.id = s.invitation_id
       JOIN answers a ON a.submission_id = s.id
      WHERE s.tenant_id = $1 AND s.engagement_id = $2 AND s.status = 'submitted'`,
    [tenantId, engagementId],
  );
  const bySubmission = new Map<string, { teamId: string; answers: unknown[] }>();
  for (const r of answers.rows) {
    const e = bySubmission.get(r.submission_id) ?? { teamId: r.team_id, answers: [] };
    e.answers.push({ questionItemId: r.question_item_id, value: r.value_json });
    bySubmission.set(r.submission_id, e);
  }
  // Per-person axis scores exist only inside this function; only group aggregates leave it.
  const scored: ScoredSubmission[] = [...bySubmission.values()].map((s) => {
    const result = scoreSubmission(s.answers as Parameters<typeof scoreSubmission>[0], itemsById);
    const axes: Record<string, number> = {};
    for (const [axis, v] of result.byAxis) if (v.scoredItems > 0) axes[axis] = v.normalised;
    return { teamId: s.teamId, axes };
  });
  const teams = await client.query<{ id: string; name: string }>(
    `SELECT t.id, t.name FROM engagement_teams et JOIN teams t ON t.id = et.team_id
      WHERE et.tenant_id = $1 AND et.engagement_id = $2`,
    [tenantId, engagementId],
  );
  return computeReadiness(scored, new Map(teams.rows.map((t) => [t.id, t.name])), MIN_GROUP_SIZE);
};

const loadInputsWith = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<ReportInputs | null> => {
  const eng = await client.query<{
    locale: 'fr' | 'en';
    name: string | null;
    organisation: string | null;
  }>(
    `SELECT e.locale, COALESCE(e.name, (SELECT tp.name FROM templates tp WHERE tp.id = e.template_id)) AS name,
            (SELECT COALESCE(o.trading_name, o.legal_name) FROM organisations o
              WHERE o.tenant_id = e.tenant_id ORDER BY o.created_at LIMIT 1) AS organisation
       FROM engagements e WHERE e.tenant_id = $1 AND e.id = $2`,
    [tenantId, engagementId],
  );
  const e = eng.rows[0];
  if (!e) return null;
  const opps = await client.query<{
    id: string;
    title: string;
    axis: string | null;
    impact_score: string | null;
  }>(
    `SELECT id, title, axis, impact_score FROM opportunities
      WHERE tenant_id = $1 AND engagement_id = $2 AND status = ANY($3::text[])
      ORDER BY created_at, id`,
    [tenantId, engagementId, APPROVED_OPPORTUNITY],
  );
  return {
    organisation: e.organisation ?? '',
    engagementName: e.name,
    locale: e.locale,
    findings: await loadFindings(client, tenantId, engagementId),
    opportunities: opps.rows.map((o) => ({
      id: o.id,
      title: o.title,
      axis: o.axis,
      impactScore: o.impact_score === null ? null : Number(o.impact_score),
    })),
    readiness: await loadReadiness(client, tenantId, engagementId),
    answered: Number(
      (
        await client.query<{ n: string }>(
          `SELECT count(*) AS n FROM submissions
            WHERE tenant_id = $1 AND engagement_id = $2 AND status = 'submitted'`,
          [tenantId, engagementId],
        )
      ).rows[0]?.n ?? 0,
    ),
  };
};

export const loadReportInputs = (tenantId: TenantId, engagementId: string) =>
  withTenant(tenantId, (c) => loadInputsWith(c, tenantId, engagementId));

// ---------------------------------------------------------------------------------------------
// Working report
// ---------------------------------------------------------------------------------------------

export interface ReportListRow {
  readonly engagementId: string;
  readonly engagementName: string | null;
  readonly engagementStatus: string;
  readonly reportId: string | null;
  readonly status: ReportStatus | null;
  readonly version: number | null;
  readonly visibleVersion: number | null;
  readonly updatedAt: string | null;
}

/** Engagements of the tenant with their report state, newest first. */
export const listReports = (tenantId: TenantId): Promise<ReportListRow[]> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      engagement_id: string;
      name: string | null;
      engagement_status: string;
      report_id: string | null;
      status: ReportStatus | null;
      version: number | null;
      visible_version: number | null;
      updated_at: string | null;
    }>(
      `SELECT e.id AS engagement_id, COALESCE(e.name, tp.name) AS name, e.status AS engagement_status,
              r.id AS report_id, r.status, r.version, r.updated_at,
              (SELECT max(v.version) FROM audit_report_versions v
                WHERE v.report_id = r.id AND v.unpublished_at IS NULL) AS visible_version
         FROM engagements e
         JOIN templates tp ON tp.id = e.template_id
         LEFT JOIN audit_reports r ON r.engagement_id = e.id AND r.tenant_id = e.tenant_id
        WHERE e.tenant_id = $1 AND e.status <> 'archived'
        ORDER BY e.created_at DESC, e.id`,
      [tenantId],
    );
    return rows.map((r) => ({
      engagementId: r.engagement_id,
      engagementName: r.name,
      engagementStatus: r.engagement_status,
      reportId: r.report_id,
      status: r.status,
      version: r.version,
      visibleVersion: r.visible_version,
      updatedAt: r.updated_at,
    }));
  });

export interface ReportBundle {
  readonly report: ReportRow;
  readonly steps: StepRow[];
  readonly inputs: ReportInputs;
  /** Published version the client sees right now, if any. */
  readonly visibleVersion: number | null;
}

const loadReportRow = async (
  client: pg.PoolClient,
  tenantId: string,
  reportId: string,
  lock = false,
): Promise<ReportRow | null> => {
  const { rows } = await client.query<ReportDbRow>(
    `SELECT ${REPORT_COLS} FROM audit_reports WHERE tenant_id = $1 AND id = $2${lock ? ' FOR UPDATE' : ''}`,
    [tenantId, reportId],
  );
  return rows[0] ? fromReportRow(rows[0]) : null;
};

const loadSteps = async (
  client: pg.PoolClient,
  tenantId: string,
  reportId: string,
): Promise<StepRow[]> => {
  const { rows } = await client.query<StepDbRow>(
    `SELECT ${STEP_COLS} FROM report_steps WHERE tenant_id = $1 AND report_id = $2
      ORDER BY position, created_at, id`,
    [tenantId, reportId],
  );
  return rows.map(fromStepRow);
};

/** The engagement's report with its steps and inputs, or null when none was started. */
export const loadReportForEngagement = (
  tenantId: TenantId,
  engagementId: string,
): Promise<ReportBundle | null> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<ReportDbRow>(
      `SELECT ${REPORT_COLS} FROM audit_reports WHERE tenant_id = $1 AND engagement_id = $2`,
      [tenantId, engagementId],
    );
    if (!rows[0]) return null;
    const report = fromReportRow(rows[0]);
    const inputs = await loadInputsWith(client, tenantId, engagementId);
    if (!inputs) return null;
    const visible = await client.query<{ version: number | null }>(
      `SELECT max(version) AS version FROM audit_report_versions
        WHERE tenant_id = $1 AND report_id = $2 AND unpublished_at IS NULL`,
      [tenantId, report.id],
    );
    return {
      report,
      steps: await loadSteps(client, tenantId, report.id),
      inputs,
      visibleVersion: visible.rows[0]?.version ?? null,
    };
  });

/** Language the report is written in, or null when it does not exist in this tenant. */
export const loadReportLocale = (tenantId: TenantId, reportId: string) =>
  withTenant(
    tenantId,
    async (client) => (await loadReportRow(client, tenantId, reportId))?.locale ?? null,
  );

/** Insert the rule-based suggestions for every approved opportunity; returns how many were new. */
const suggestWith = async (
  client: pg.PoolClient,
  tenantId: string,
  reportId: string,
  locale: 'fr' | 'en',
  opportunities: readonly OpportunityInput[],
): Promise<number> => {
  let added = 0;
  const pos = await client.query<{ n: number }>(
    `SELECT COALESCE(max(position), 0)::int AS n FROM report_steps WHERE tenant_id = $1 AND report_id = $2`,
    [tenantId, reportId],
  );
  let position = pos.rows[0]?.n ?? 0;
  for (const o of opportunities) {
    const linked = await client.query<{ payload_json: unknown }>(
      `SELECT a.payload_json FROM opportunities op JOIN analyses a ON a.id = op.analysis_id
        WHERE op.tenant_id = $1 AND op.id = $2 AND a.approved_at IS NOT NULL`,
      [tenantId, o.id],
    );
    const fromFindings = await linkedFindingWords(client, tenantId, o.id);
    const labels = [
      ...fromFindings.labels,
      ...linked.rows.flatMap((r) => {
        const themes = (r.payload_json as { themes?: unknown } | null)?.themes;
        return Array.isArray(themes)
          ? themes.flatMap((t) =>
              typeof (t as { label?: unknown }).label === 'string'
                ? [(t as { label: string }).label]
                : [],
            )
          : [];
      }),
    ];
    const description = await client.query<{ description: string }>(
      'SELECT description FROM opportunities WHERE tenant_id = $1 AND id = $2',
      [tenantId, o.id],
    );
    const matches = matchImprovements({
      title: o.title,
      description: description.rows[0]?.description ?? '',
      axis: o.axis,
      findingLabels: labels,
      tags: fromFindings.tags,
    });
    for (const m of matches) {
      position += 1;
      const e = m.entry;
      const res = await client.query(
        `INSERT INTO report_steps (tenant_id, report_id, opportunity_id, catalogue_id, source, status,
                                   category, title, description, effort, impact, risk, owner, horizon,
                                   prerequisites, match_json, position)
         VALUES ($1, $2, $3, $4, 'rule', 'suggested', $5, $6, $7, $8, $9, $10, '', $11, $12, $13, $14)
         ON CONFLICT DO NOTHING`,
        [
          tenantId,
          reportId,
          o.id,
          e.id,
          e.category,
          e.title[locale],
          e.description[locale],
          e.effort,
          e.impact,
          e.risk,
          defaultHorizon(e.effort, e.risk),
          JSON.stringify(e.prerequisites.map((p) => p[locale])),
          JSON.stringify({ tags: m.tags, score: m.score, ownerRole: e.ownerRole }),
          position,
        ],
      );
      added += res.rowCount ?? 0;
    }
  }
  return added;
};

/** Start the engagement's report (once) and propose steps for every approved opportunity. */
export const createReport = (
  tenantId: TenantId,
  actor: string,
  engagementId: string,
  defaults: { title: (org: string) => string; methodology: string },
): Promise<string> =>
  withTenant(tenantId, async (client) => {
    const inputs = await loadInputsWith(client, tenantId, engagementId);
    if (!inputs) throw new ReportError('not_found');
    const existing = await client.query<{ id: string }>(
      'SELECT id FROM audit_reports WHERE tenant_id = $1 AND engagement_id = $2',
      [tenantId, engagementId],
    );
    if (existing.rows[0]) return existing.rows[0].id;
    const ins = await client.query<{ id: string }>(
      `INSERT INTO audit_reports (tenant_id, engagement_id, locale, title, methodology,
                                  catalogue_version, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING id`,
      [
        tenantId,
        engagementId,
        inputs.locale,
        defaults.title(inputs.engagementName ?? inputs.organisation).slice(0, 200),
        defaults.methodology,
        IMPROVEMENT_CATALOGUE_VERSION,
        actor,
      ],
    );
    const id = ins.rows[0]?.id as string;
    await audit(client, tenantId, actor, 'report.create', 'report', id, { engagementId });
    const added = await suggestWith(client, tenantId, id, inputs.locale, inputs.opportunities);
    await audit(client, tenantId, actor, 'report.suggest', 'report', id, { added });
    return id;
  });

/** Lock the report row and refuse unless it can be edited. */
const editable = async (
  client: pg.PoolClient,
  tenantId: string,
  reportId: string,
): Promise<ReportRow> => {
  const r = await loadReportRow(client, tenantId, reportId, true);
  if (!r) throw new ReportError('not_found');
  if (!EDITABLE.includes(r.status)) throw new ReportError('locked');
  return r;
};

const touch = (client: pg.PoolClient, tenantId: string, reportId: string, actor: string) =>
  client.query(
    'UPDATE audit_reports SET updated_at = now(), updated_by = $3 WHERE tenant_id = $1 AND id = $2',
    [tenantId, reportId, actor],
  );

/** Propose steps again, for opportunities approved since the report was started. */
export const suggestSteps = (tenantId: TenantId, actor: string, reportId: string) =>
  withTenant(tenantId, async (client) => {
    const r = await editable(client, tenantId, reportId);
    const inputs = await loadInputsWith(client, tenantId, r.engagementId);
    if (!inputs) throw new ReportError('not_found');
    const added = await suggestWith(client, tenantId, reportId, r.locale, inputs.opportunities);
    await touch(client, tenantId, reportId, actor);
    await audit(client, tenantId, actor, 'report.suggest', 'report', reportId, { added });
    return added;
  });

export interface SectionsInput {
  readonly title: string;
  readonly summary: string;
  readonly summaryCitations: readonly string[];
  readonly risksNote: string;
  readonly methodology: string;
}

export const updateSections = (
  tenantId: TenantId,
  actor: string,
  reportId: string,
  s: SectionsInput,
) =>
  withTenant(tenantId, async (client) => {
    await editable(client, tenantId, reportId);
    await client.query(
      `UPDATE audit_reports SET title = $3, summary = $4, summary_citations = $5, risks_note = $6,
              methodology = $7, updated_at = now(), updated_by = $8
        WHERE tenant_id = $1 AND id = $2`,
      [
        tenantId,
        reportId,
        s.title,
        s.summary,
        JSON.stringify([...new Set(s.summaryCitations)]),
        s.risksNote,
        s.methodology,
        actor,
      ],
    );
    // The trail records what changed, not the text itself.
    await audit(client, tenantId, actor, 'report.update', 'report', reportId, {
      fields: ['title', 'summary', 'summaryCitations', 'risksNote', 'methodology'],
      citations: s.summaryCitations.length,
    });
  });

export interface StepInput {
  readonly title: string;
  readonly description: string;
  readonly effort: Level;
  readonly impact: Level;
  readonly risk: Level;
  readonly owner: string;
  readonly horizon: Horizon;
}

const stepReport = async (client: pg.PoolClient, tenantId: string, stepId: string) => {
  const { rows } = await client.query<{ report_id: string }>(
    'SELECT report_id FROM report_steps WHERE tenant_id = $1 AND id = $2',
    [tenantId, stepId],
  );
  const reportId = rows[0]?.report_id;
  if (!reportId) throw new ReportError('not_found');
  await editable(client, tenantId, reportId);
  return reportId;
};

export const updateStep = (tenantId: TenantId, actor: string, stepId: string, s: StepInput) =>
  withTenant(tenantId, async (client) => {
    const reportId = await stepReport(client, tenantId, stepId);
    await client.query(
      `UPDATE report_steps SET title = $3, description = $4, effort = $5, impact = $6, risk = $7,
              owner = $8, horizon = $9, updated_at = now()
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, stepId, s.title, s.description, s.effort, s.impact, s.risk, s.owner, s.horizon],
    );
    await touch(client, tenantId, reportId, actor);
    await audit(client, tenantId, actor, 'report_step.update', 'report_step', stepId, {
      reportId,
      effort: s.effort,
      impact: s.impact,
      risk: s.risk,
      horizon: s.horizon,
    });
  });

export const setStepStatus = (
  tenantId: TenantId,
  actor: string,
  stepId: string,
  decision: 'accepted' | 'rejected' | 'suggested',
) =>
  withTenant(tenantId, async (client) => {
    const reportId = await stepReport(client, tenantId, stepId);
    await client.query(
      `UPDATE report_steps SET status = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2`,
      [tenantId, stepId, decision],
    );
    await touch(client, tenantId, reportId, actor);
    const action =
      decision === 'accepted'
        ? 'report_step.accept'
        : decision === 'rejected'
          ? 'report_step.reject'
          : 'report_step.update';
    await audit(client, tenantId, actor, action, 'report_step', stepId, { reportId, decision });
  });

/**
 * Add a step to an approved opportunity: from the catalogue, or written by the auditor. A step the
 * auditor writes may come without an opportunity (`null`): the audit may have none approved, so
 * the step gets an approved opportunity of its own, titled like the step.
 */
export const addStep = (
  tenantId: TenantId,
  actor: string,
  reportId: string,
  givenOpportunityId: string | null,
  from: { catalogueId: string } | { custom: StepInput & { category: StepRow['category'] } },
) =>
  withTenant(tenantId, async (client) => {
    const r = await editable(client, tenantId, reportId);
    let opportunityId = givenOpportunityId;
    if (opportunityId === null) {
      if (!('custom' in from)) throw new ReportError('not_found');
      const made = await client.query<{ id: string }>(
        `INSERT INTO opportunities (tenant_id, engagement_id, status, title, description, created_by)
         VALUES ($1, $2, 'approved', $3, $4, $5) RETURNING id`,
        [
          tenantId,
          r.engagementId,
          from.custom.title.padEnd(3, '.'),
          from.custom.description,
          actor,
        ],
      );
      opportunityId = (made.rows[0] as { id: string }).id;
      await client.query(
        `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
         VALUES ($1, $2, 'opportunity.create', 'opportunity', $3, $4)`,
        [tenantId, actor, opportunityId, JSON.stringify({ reportId, source: 'report_step' })],
      );
    }
    const opp = await client.query(
      `SELECT 1 FROM opportunities WHERE tenant_id = $1 AND id = $2 AND engagement_id = $3
          AND status = ANY($4::text[])`,
      [tenantId, opportunityId, r.engagementId, APPROVED_OPPORTUNITY],
    );
    if (opp.rowCount === 0) throw new ReportError('not_found');
    let values: unknown[];
    if ('catalogueId' in from) {
      const e = catalogueEntry(from.catalogueId);
      if (!e) throw new ReportError('not_found');
      values = [
        e.id,
        'rule',
        e.category,
        e.title[r.locale],
        e.description[r.locale],
        e.effort,
        e.impact,
        e.risk,
        '',
        defaultHorizon(e.effort, e.risk),
        JSON.stringify(e.prerequisites.map((p) => p[r.locale])),
        JSON.stringify({ tags: [], ownerRole: e.ownerRole, picked: true }),
      ];
    } else {
      const c = from.custom;
      values = [
        null,
        'auditor',
        c.category,
        c.title,
        c.description,
        c.effort,
        c.impact,
        c.risk,
        c.owner,
        c.horizon,
        '[]',
        '{}',
      ];
    }
    const ins = await client.query<{ id: string }>(
      `INSERT INTO report_steps (tenant_id, report_id, opportunity_id, catalogue_id, source, status,
                                 category, title, description, effort, impact, risk, owner, horizon,
                                 prerequisites, match_json, position)
       VALUES ($1, $2, $3, $4, $5, 'accepted', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
               (SELECT COALESCE(max(position), 0) + 1 FROM report_steps WHERE report_id = $2))
       ON CONFLICT DO NOTHING RETURNING id`,
      [tenantId, reportId, opportunityId, ...values],
    );
    const id = ins.rows[0]?.id;
    if (!id) throw new ReportError('duplicate');
    await touch(client, tenantId, reportId, actor);
    await audit(client, tenantId, actor, 'report_step.add', 'report_step', id, {
      reportId,
      opportunityId,
      catalogueId: 'catalogueId' in from ? from.catalogueId : null,
    });
    return id;
  });

/** Words of the plan checkpoints (PRD §30.3), from the caller's i18n. */
export type Checkpoints = Readonly<Record<Horizon, { text: string; owner: string }>>;

/** Rebuild the 30/60/90 plan from the accepted steps (replaces the current plan). */
export const generatePlan = (
  tenantId: TenantId,
  actor: string,
  reportId: string,
  checkpoints: Checkpoints,
) =>
  withTenant(tenantId, async (client) => {
    await editable(client, tenantId, reportId);
    const steps = (await loadSteps(client, tenantId, reportId)).filter(
      (s) => s.status === 'accepted',
    );
    const plan = buildPlan(steps, checkpoints);
    await client.query(
      `UPDATE audit_reports SET plan_json = $3, updated_at = now(), updated_by = $4
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, reportId, JSON.stringify(plan), actor],
    );
    await audit(client, tenantId, actor, 'report.plan', 'report', reportId, {
      items: plan.length,
      generated: true,
    });
    return plan.length;
  });

export const savePlan = (tenantId: TenantId, actor: string, reportId: string, plan: PlanItem[]) =>
  withTenant(tenantId, async (client) => {
    await editable(client, tenantId, reportId);
    const clean = plan.flatMap((p) => {
      const ok = planItemSchema.safeParse(p);
      return ok.success && ok.data.text.trim() ? [ok.data] : [];
    });
    await client.query(
      `UPDATE audit_reports SET plan_json = $3, updated_at = now(), updated_by = $4
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, reportId, JSON.stringify(clean.slice(0, 60)), actor],
    );
    await audit(client, tenantId, actor, 'report.plan', 'report', reportId, {
      items: clean.length,
      generated: false,
    });
  });

/** Copy the model draft into the summary (still a draft the auditor edits). */
export const applyAiDraft = (tenantId: TenantId, actor: string, reportId: string) =>
  withTenant(tenantId, async (client) => {
    const r = await editable(client, tenantId, reportId);
    if (!r.aiDraft) throw new ReportError('no_draft');
    await client.query(
      `UPDATE audit_reports SET summary = $3, summary_citations = $4, updated_at = now(), updated_by = $5
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, reportId, r.aiDraft.text, JSON.stringify(r.aiDraft.citations), actor],
    );
    await audit(client, tenantId, actor, 'report.update', 'report', reportId, {
      fields: ['summary', 'summaryCitations'],
      fromAiDraft: r.aiDraft.route,
    });
  });

// ---------------------------------------------------------------------------------------------
// Workflow: review, publish, unpublish, next version
// ---------------------------------------------------------------------------------------------

export const setReviewState = (
  tenantId: TenantId,
  actor: string,
  reportId: string,
  to: 'draft' | 'in_review',
) =>
  withTenant(tenantId, async (client) => {
    const r = await editable(client, tenantId, reportId);
    if (r.status === to) return;
    await client.query(
      `UPDATE audit_reports SET status = $3, updated_at = now(), updated_by = $4
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, reportId, to, actor],
    );
    await audit(client, tenantId, actor, 'report.submit', 'report', reportId, {
      from: r.status,
      to,
      version: r.version,
    });
  });

/** Names to hide and free text people wrote, to keep them out of a published report. */
const leakSources = async (client: pg.PoolClient, tenantId: string, engagementId: string) => {
  const terms = await client.query<{ term: string }>(
    'SELECT term FROM ai_redaction_terms WHERE tenant_id = $1',
    [tenantId],
  );
  const free = await client.query<{ text: string | null }>(
    `SELECT a.value_json->>'text' AS text FROM answers a JOIN submissions s ON s.id = a.submission_id
      WHERE s.tenant_id = $1 AND s.engagement_id = $2 AND a.value_json->>'kind' = 'short_text'
     UNION ALL
     SELECT a.rationale FROM answers a JOIN submissions s ON s.id = a.submission_id
      WHERE s.tenant_id = $1 AND s.engagement_id = $2 AND a.rationale IS NOT NULL
     UNION ALL
     SELECT s.end_comment FROM submissions s
      WHERE s.tenant_id = $1 AND s.engagement_id = $2 AND s.end_comment IS NOT NULL`,
    [tenantId, engagementId],
  );
  return {
    redactionTerms: terms.rows.map((r) => r.term),
    freeTexts: free.rows.flatMap((r) => (r.text ? [r.text] : [])),
  };
};

/** The snapshot publishing would freeze now, or why it cannot be published (preview + gate). */
const checkWith = async (
  client: pg.PoolClient,
  tenantId: string,
  r: ReportRow,
  publishedAt: string,
): Promise<PublishCheck> => {
  const inputs = await loadInputsWith(client, tenantId, r.engagementId);
  if (!inputs) return { ok: false, code: 'invalid' };
  const steps = await loadSteps(client, tenantId, r.id);
  return buildSnapshot(
    {
      version: r.version,
      locale: r.locale,
      title: r.title,
      organisation: inputs.organisation,
      publishedAt,
      summary: r.summary,
      summaryCitations: r.summaryCitations,
      readiness: inputs.readiness,
      findings: inputs.findings,
      opportunities: inputs.opportunities,
      steps,
      risksNote: r.risksNote,
      methodology: r.methodology,
      plan: r.plan,
      minGroupSize: MIN_GROUP_SIZE,
      catalogueVersion: r.catalogueVersion,
    },
    await leakSources(client, tenantId, r.engagementId),
  );
};

/** Preview: exactly what publishing would show the client, without publishing. */
export const previewReport = (tenantId: TenantId, reportId: string): Promise<PublishCheck> =>
  withTenant(tenantId, async (client) => {
    const r = await loadReportRow(client, tenantId, reportId);
    if (!r) return { ok: false, code: 'invalid' };
    return checkWith(client, tenantId, r, new Date().toISOString());
  });

/**
 * Publish: requires an explicit confirmation (checked by the action), a report in review, and a
 * snapshot that passes the gate. Earlier visible versions are replaced by this one.
 */
export const publishReport = (tenantId: TenantId, actor: string, reportId: string) =>
  withTenant(tenantId, async (client) => {
    const r = await loadReportRow(client, tenantId, reportId, true);
    if (!r) throw new ReportError('not_found');
    if (r.status !== 'in_review') throw new ReportError('not_in_review');
    const check = await checkWith(client, tenantId, r, new Date().toISOString());
    if (!check.ok) throw new ReportError(check.code);
    await client.query(
      `UPDATE audit_report_versions SET unpublished_at = now(), unpublished_by = $3
        WHERE tenant_id = $1 AND report_id = $2 AND unpublished_at IS NULL`,
      [tenantId, reportId, actor],
    );
    await client.query(
      `INSERT INTO audit_report_versions (tenant_id, report_id, engagement_id, version, snapshot_json, published_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, reportId, r.engagementId, r.version, JSON.stringify(check.snapshot), actor],
    );
    await client.query(
      `UPDATE audit_reports SET status = 'published', updated_at = now(), updated_by = $3
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, reportId, actor],
    );
    await audit(client, tenantId, actor, 'report.publish', 'report', reportId, {
      version: r.version,
      findings: check.snapshot.findings.length,
      steps: check.snapshot.steps.length,
    });
    return r.version;
  });

/** Withdraw what the client sees. The working report goes back to draft. */
export const unpublishReport = (tenantId: TenantId, actor: string, reportId: string) =>
  withTenant(tenantId, async (client) => {
    const r = await loadReportRow(client, tenantId, reportId, true);
    if (!r) throw new ReportError('not_found');
    const res = await client.query(
      `UPDATE audit_report_versions SET unpublished_at = now(), unpublished_by = $3
        WHERE tenant_id = $1 AND report_id = $2 AND unpublished_at IS NULL`,
      [tenantId, reportId, actor],
    );
    if ((res.rowCount ?? 0) === 0) throw new ReportError('not_published');
    if (r.status === 'published') {
      await client.query(
        `UPDATE audit_reports SET status = 'draft', updated_at = now(), updated_by = $3
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, reportId, actor],
      );
    }
    await audit(client, tenantId, actor, 'report.unpublish', 'report', reportId, {
      version: r.version,
    });
  });

/** Edit a published report: the next version starts as a draft; the client keeps the old one. */
export const startNewVersion = (tenantId: TenantId, actor: string, reportId: string) =>
  withTenant(tenantId, async (client) => {
    const r = await loadReportRow(client, tenantId, reportId, true);
    if (!r) throw new ReportError('not_found');
    if (r.status !== 'published') throw new ReportError('not_published');
    await client.query(
      `UPDATE audit_reports SET status = 'draft', version = version + 1, updated_at = now(), updated_by = $3
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, reportId, actor],
    );
    await audit(client, tenantId, actor, 'report.new_version', 'report', reportId, {
      version: r.version + 1,
    });
    return r.version + 1;
  });

// ---------------------------------------------------------------------------------------------
// Client side: only the published, not withdrawn snapshot
// ---------------------------------------------------------------------------------------------

export interface PublishedReport {
  readonly snapshot: ReportSnapshot;
  readonly reportId: string;
}

/** The snapshot the client may read for this engagement, or null. Never a draft. */
export const loadPublishedReport = (
  tenantId: TenantId,
  engagementId: string,
): Promise<PublishedReport | null> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ report_id: string; snapshot_json: unknown }>(
      `SELECT report_id, snapshot_json FROM audit_report_versions
        WHERE tenant_id = $1 AND engagement_id = $2 AND unpublished_at IS NULL
        ORDER BY published_at DESC, version DESC LIMIT 1`,
      [tenantId, engagementId],
    );
    const row = rows[0];
    if (!row) return null;
    const parsed = reportSnapshotSchema.safeParse(row.snapshot_json);
    return parsed.success ? { snapshot: parsed.data, reportId: row.report_id } : null;
  });

/** Trail of a download, so the auditor knows the report left the app (no content logged). */
export const logReportExport = (
  tenantId: TenantId,
  actor: string,
  reportId: string,
  meta: { version: number; format: 'pdf'; surface: 'admin' | 'client' },
) =>
  withTenant(tenantId, (client) =>
    audit(client, tenantId, actor, 'report.export', 'report', reportId, { ...meta }),
  );

/** Ranked list used by the auditor screen before publishing (same rule as the snapshot). */
export const rankForScreen = (inputs: ReportInputs, steps: readonly StepRow[]) => {
  const accepted = steps.filter((s) => s.status === 'accepted');
  return rankOpportunities(
    inputs.opportunities.map((o) => ({
      ...o,
      steps: accepted.filter((s) => s.opportunityId === o.id),
    })),
  );
};
