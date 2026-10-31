import type pg from 'pg';
import {
  catalogueEntry,
  emptyQualification,
  useCaseById,
  useCaseQualificationSchema,
  type TenantId,
  type UseCaseQualification,
} from '@evolai/contracts';
import { proposeUseCases, tagsInText, type UseCaseFinding } from '@evolai/domain';
import { createTranslator } from '@evolai/i18n';
import { withTenant } from './db';
import { listFindingsWith } from './findingsData';
import { isReportable } from './findingRules';
import { MIN_GROUP_SIZE } from './invitationTracking';

/**
 * Use cases of a mission (ADR 0064). The audit proposes them from the approved findings; each one
 * is an approved opportunity with a playbook id, its findings linked as evidence and its playbook
 * steps suggested. The auditor measures it during the visit; the client's referent orders them.
 * Everything here runs under `withTenant` and writes its `audit_log` row in the same transaction.
 */

/** Migration 0034 is applied. */
export const useCaseReady = async (client: pg.PoolClient): Promise<boolean> =>
  (
    await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'opportunities' AND column_name = 'use_case_id'`,
    )
  ).rowCount === 1;

const audit = (
  client: pg.PoolClient,
  tenantId: string,
  actor: string,
  action: 'opportunity.create' | 'opportunity.update',
  opportunityId: string,
  payload: Record<string, unknown>,
) =>
  client.query(
    `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
     VALUES ($1, $2, $3, 'opportunity', $4, $5)`,
    [tenantId, actor, action, opportunityId, JSON.stringify(payload)],
  );

/** Approved findings the client may see, as the matcher reads them. */
const matcherFindings = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<UseCaseFinding[]> =>
  ((await listFindingsWith(client, tenantId, engagementId)) ?? [])
    .filter((f) => f.status === 'approved' && isReportable(f, MIN_GROUP_SIZE))
    .map((f) => ({
      id: f.id,
      // A finding the auditor wrote has no rule tags: read them from its words.
      tags: [...new Set([...f.tags, ...tagsInText(`${f.label} ${f.statement}`)])],
      ruleKey: f.ruleKey,
      people: f.people >= MIN_GROUP_SIZE ? f.people : 0,
      visit: f.notes > 0,
    }));

/**
 * Propose the use cases of the mission and their steps on the working report (once each).
 * Returns how many steps were added.
 */
export const syncUseCasesWith = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
  reportId: string,
  actor: string,
  locale: 'fr' | 'en',
): Promise<number> => {
  if (!(await useCaseReady(client))) return 0;
  const proposals = proposeUseCases(await matcherFindings(client, tenantId, engagementId));
  const owners = createTranslator(locale);
  const present = new Set(
    (
      await client.query<{ catalogue_id: string }>(
        `SELECT catalogue_id FROM report_steps
          WHERE tenant_id = $1 AND report_id = $2 AND catalogue_id IS NOT NULL`,
        [tenantId, reportId],
      )
    ).rows.map((r) => r.catalogue_id),
  );
  let position =
    (
      await client.query<{ n: number }>(
        `SELECT COALESCE(max(position), 0)::int AS n FROM report_steps
          WHERE tenant_id = $1 AND report_id = $2`,
        [tenantId, reportId],
      )
    ).rows[0]?.n ?? 0;
  let added = 0;
  for (const p of proposals) {
    const u = p.useCase;
    const found = await client.query<{ id: string }>(
      `SELECT id FROM opportunities WHERE tenant_id = $1 AND engagement_id = $2 AND use_case_id = $3`,
      [tenantId, engagementId, u.id],
    );
    let opportunityId = found.rows[0]?.id;
    if (!opportunityId) {
      const made = await client.query<{ id: string }>(
        `INSERT INTO opportunities (tenant_id, engagement_id, status, title, description, axis,
                                    use_case_id, created_by)
         VALUES ($1, $2, 'approved', $3, $4, 'opportunity', $5, $6) RETURNING id`,
        [tenantId, engagementId, u.title[locale], u.approach[locale], u.id, actor],
      );
      opportunityId = (made.rows[0] as { id: string }).id;
      await audit(client, tenantId, actor, 'opportunity.create', opportunityId, {
        source: 'use_case',
        useCaseId: u.id,
      });
    }
    for (const findingId of p.findingIds) {
      await client.query(
        `INSERT INTO opportunity_findings (tenant_id, opportunity_id, finding_id)
         SELECT $1, $2, $3 WHERE NOT EXISTS (
           SELECT 1 FROM opportunity_findings WHERE opportunity_id = $2 AND finding_id = $3)`,
        [tenantId, opportunityId, findingId],
      );
    }
    for (const stepId of u.steps) {
      const e = catalogueEntry(stepId);
      if (!e || present.has(e.id)) continue;
      present.add(e.id);
      position += 1;
      const res = await client.query(
        `INSERT INTO report_steps (tenant_id, report_id, opportunity_id, catalogue_id, source, status,
                                   category, title, description, effort, impact, risk, owner, horizon,
                                   prerequisites, match_json, position)
         VALUES ($1, $2, $3, $4, 'rule', 'suggested', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT DO NOTHING`,
        [
          tenantId,
          reportId,
          opportunityId,
          e.id,
          e.category,
          e.title[locale],
          e.description[locale],
          e.effort,
          e.impact,
          e.risk,
          owners(`report.steps.ownerRole.${e.ownerRole}`),
          // Rules first; then quick steps in 30 days and the rest in 60 (same as the catalogue).
          u.pinned || (e.effort === 'low' && e.risk !== 'high') ? 'd30' : 'd60',
          JSON.stringify(e.prerequisites.map((x) => x[locale])),
          // "Why" on the step: the use case's evidence patterns.
          JSON.stringify({ tags: u.evidence, useCaseId: u.id, ownerRole: e.ownerRole }),
          position,
        ],
      );
      added += res.rowCount ?? 0;
    }
  }
  return added;
};

export interface UseCaseState {
  readonly opportunityId: string;
  readonly useCaseId: string;
  readonly qualification: UseCaseQualification;
  readonly clientRank: number | null;
  /** Ids of the approved findings it rests on. */
  readonly findingIds: readonly string[];
}

const parseQualification = (v: unknown): UseCaseQualification => {
  const r = useCaseQualificationSchema.safeParse({ ...emptyQualification, ...(v as object) });
  return r.success ? r.data : emptyQualification;
};

/** The mission's use cases, in creation order; empty before migration 0034. */
export const loadUseCasesWith = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<UseCaseState[]> => {
  if (!(await useCaseReady(client))) return [];
  const { rows } = await client.query<{
    id: string;
    use_case_id: string;
    qualification_json: unknown;
    client_rank: number | null;
    finding_ids: string[] | null;
  }>(
    `SELECT o.id, o.use_case_id, o.qualification_json, o.client_rank,
            (SELECT array_agg(ofi.finding_id::text) FROM opportunity_findings ofi
              WHERE ofi.opportunity_id = o.id) AS finding_ids
       FROM opportunities o
      WHERE o.tenant_id = $1 AND o.engagement_id = $2 AND o.use_case_id IS NOT NULL
        AND o.status IN ('approved', 'in_progress', 'delivered')
      ORDER BY o.created_at, o.id`,
    [tenantId, engagementId],
  );
  return rows
    .filter((r) => useCaseById(r.use_case_id))
    .map((r) => ({
      opportunityId: r.id,
      useCaseId: r.use_case_id,
      qualification: parseQualification(r.qualification_json),
      clientRank: r.client_rank,
      findingIds: r.finding_ids ?? [],
    }));
};

export const loadUseCases = (tenantId: TenantId, engagementId: string) =>
  withTenant(tenantId, (c) => loadUseCasesWith(c, tenantId, engagementId));

export class UseCaseError extends Error {
  constructor(readonly code: 'not_found' | 'locked' | 'unavailable' | 'bad_input') {
    super(code);
    this.name = 'UseCaseError';
  }
}

/** The opportunity is a use case of an engagement whose report is still being written. */
const editableUseCase = async (client: pg.PoolClient, tenantId: string, opportunityId: string) => {
  if (!(await useCaseReady(client))) throw new UseCaseError('unavailable');
  const { rows } = await client.query<{ engagement_id: string; status: string | null }>(
    `SELECT o.engagement_id,
            (SELECT r.status FROM audit_reports r WHERE r.tenant_id = o.tenant_id
                AND r.engagement_id = o.engagement_id) AS status
       FROM opportunities o
      WHERE o.tenant_id = $1 AND o.id = $2 AND o.use_case_id IS NOT NULL FOR UPDATE OF o`,
    [tenantId, opportunityId],
  );
  const row = rows[0];
  if (!row) throw new UseCaseError('not_found');
  if (row.status !== null && !['draft', 'in_review'].includes(row.status)) {
    throw new UseCaseError('locked');
  }
  return row.engagement_id;
};

/** What the auditor measured during the visit. The trail records which figures are set, not them. */
export const setQualification = (
  tenantId: TenantId,
  actor: string,
  opportunityId: string,
  q: UseCaseQualification,
) =>
  withTenant(tenantId, async (client) => {
    await editableUseCase(client, tenantId, opportunityId);
    const parsed = useCaseQualificationSchema.safeParse(q);
    if (!parsed.success) throw new UseCaseError('bad_input');
    await client.query(
      `UPDATE opportunities SET qualification_json = $3, updated_at = now()
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, opportunityId, JSON.stringify(parsed.data)],
    );
    await audit(client, tenantId, actor, 'opportunity.update', opportunityId, {
      qualification: {
        volume: parsed.data.volumePerWeek !== null,
        minutes: parsed.data.minutesPerUnit !== null,
      },
    });
  });

/**
 * The client's referent puts the use cases in order of priority (1 = start here). Ranks are
 * compacted to 1..n in the given order; an id missing from the list keeps no rank.
 */
export const setClientRanks = (
  tenantId: TenantId,
  actor: string,
  engagementId: string,
  orderedIds: readonly string[],
) =>
  withTenant(tenantId, async (client) => {
    const all = await loadUseCasesWith(client, tenantId, engagementId);
    if (all.length === 0) throw new UseCaseError('not_found');
    const report = await client.query<{ status: string }>(
      'SELECT status FROM audit_reports WHERE tenant_id = $1 AND engagement_id = $2',
      [tenantId, engagementId],
    );
    if (report.rows[0]?.status !== 'in_review') throw new UseCaseError('locked');
    const known = new Set(all.map((u) => u.opportunityId));
    const order = [...new Set(orderedIds)].filter((id) => known.has(id)).slice(0, 20);
    await client.query(
      `UPDATE opportunities SET client_rank = NULL, updated_at = now()
        WHERE tenant_id = $1 AND engagement_id = $2 AND use_case_id IS NOT NULL`,
      [tenantId, engagementId],
    );
    for (const [i, id] of order.entries()) {
      await client.query(
        `UPDATE opportunities SET client_rank = $3 WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id, i + 1],
      );
      await audit(client, tenantId, actor, 'opportunity.update', id, { clientRank: i + 1 });
    }
  });

/**
 * What the referent orders while the report is in review: the use cases with an accepted step,
 * rules on data left out (they always come first). Empty otherwise.
 */
export const rankItems = (tenantId: TenantId, engagementId: string) =>
  withTenant(tenantId, async (client) => {
    const report = await client.query<{ id: string; status: string; locale: 'fr' | 'en' }>(
      'SELECT id, status, locale FROM audit_reports WHERE tenant_id = $1 AND engagement_id = $2',
      [tenantId, engagementId],
    );
    const r = report.rows[0];
    if (r?.status !== 'in_review') return [];
    const all = await loadUseCasesWith(client, tenantId, engagementId);
    const titles = await client.query<{ id: string; title: string; accepted: boolean }>(
      `SELECT o.id, o.title,
              EXISTS (SELECT 1 FROM report_steps s WHERE s.opportunity_id = o.id
                         AND s.report_id = $2 AND s.status = 'accepted') AS accepted
         FROM opportunities o WHERE o.tenant_id = $1 AND o.id = ANY($3::uuid[])`,
      [tenantId, r.id, all.map((u) => u.opportunityId)],
    );
    const byId = new Map(titles.rows.map((x) => [x.id, x]));
    return all
      .filter((u) => !useCaseById(u.useCaseId)?.pinned && byId.get(u.opportunityId)?.accepted)
      .sort((a, b) => (a.clientRank ?? 99) - (b.clientRank ?? 99))
      .map((u) => ({
        id: u.opportunityId,
        title: byId.get(u.opportunityId)?.title ?? '',
        approach: useCaseById(u.useCaseId)?.approach[r.locale] ?? '',
        rank: u.clientRank,
      }));
  });
