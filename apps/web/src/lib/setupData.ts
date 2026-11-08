import { randomUUID } from 'node:crypto';
import {
  DEFAULT_MISSION_SHAPE,
  missionShape,
  type MissionShape,
  type TenantId,
  type UserId,
} from '@evolai/contracts';
import type pg from 'pg';
import { withTenant } from './db';
import {
  SetupError,
  dayEnd,
  dayOf,
  dayStart,
  parseName,
  parseTeamSize,
  type EngagementInput,
} from './setupForm';

/**
 * Audit set-up (TASK-T, ADR 0038): engagements and teams, created and edited by the auditor.
 * Everything runs in one tenant transaction (RLS), and every write leaves one `audit_log` row.
 * Nothing here touches respondents, invitations or answers.
 */

type TargetKind = 'engagement' | 'team';

const audit = async (
  client: pg.PoolClient,
  tenantId: string,
  actor: string,
  action: string,
  targetKind: TargetKind,
  targetId: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  await client.query(
    `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, actor, action, targetKind, targetId, JSON.stringify(payload)],
  );
};

export interface TeamSetup {
  readonly id: string;
  readonly name: string;
  readonly expectedHeadcount: number;
  readonly engagementCount: number;
}

export const listTeamsSetup = async (tenantId: TenantId): Promise<TeamSetup[]> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      name: string;
      expected_headcount: number;
      engagement_count: string;
    }>(
      `SELECT t.id, t.name, t.expected_headcount,
              (SELECT count(*) FROM engagement_teams et WHERE et.team_id = t.id) AS engagement_count
         FROM teams t WHERE t.tenant_id = $1 ORDER BY t.name, t.id`,
      [tenantId],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      expectedHeadcount: r.expected_headcount,
      engagementCount: Number(r.engagement_count),
    }));
  });

/** The organisation's default department, created on first use (teams need one). */
const defaultDepartment = async (
  client: pg.PoolClient,
  tenantId: string,
): Promise<{ organisationId: string; departmentId: string }> => {
  const org = await client.query<{ id: string }>(
    `SELECT id FROM organisations WHERE tenant_id = $1 ORDER BY created_at, id LIMIT 1`,
    [tenantId],
  );
  const organisationId = org.rows[0]?.id;
  if (!organisationId) throw new SetupError('not_found');
  const dep = await client.query<{ id: string }>(
    `SELECT id FROM departments WHERE tenant_id = $1 AND organisation_id = $2
      ORDER BY (code = 'general') DESC, created_at, id LIMIT 1`,
    [tenantId, organisationId],
  );
  if (dep.rows[0]) return { organisationId, departmentId: dep.rows[0].id };
  const departmentId = randomUUID();
  await client.query(
    `INSERT INTO departments (id, tenant_id, organisation_id, name, code)
     VALUES ($1, $2, $3, 'General', 'general')`,
    [departmentId, tenantId, organisationId],
  );
  return { organisationId, departmentId };
};

export const createTeam = async (
  tenantId: TenantId,
  actor: UserId,
  input: { name: string; expectedHeadcount: number },
): Promise<string> =>
  withTenant(tenantId, async (client) => {
    const name = parseName(input.name);
    const size = parseTeamSize(input.expectedHeadcount);
    if (!name) throw new SetupError('bad_name');
    if (size === null) throw new SetupError('bad_size');
    const { organisationId, departmentId } = await defaultDepartment(client, tenantId);
    const id = randomUUID();
    await client.query(
      `INSERT INTO teams (id, tenant_id, organisation_id, department_id, name, expected_headcount)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, tenantId, organisationId, departmentId, name, size],
    );
    await audit(client, tenantId, actor, 'team.create', 'team', id, { size });
    return id;
  });

export const updateTeam = async (
  tenantId: TenantId,
  actor: UserId,
  teamId: string,
  input: { name: string; expectedHeadcount: number },
): Promise<void> =>
  withTenant(tenantId, async (client) => {
    const name = parseName(input.name);
    const size = parseTeamSize(input.expectedHeadcount);
    if (!name) throw new SetupError('bad_name');
    if (size === null) throw new SetupError('bad_size');
    const res = await client.query(
      `UPDATE teams SET name = $3, expected_headcount = $4, updated_at = now()
        WHERE tenant_id = $1 AND id = $2`,
      [tenantId, teamId, name, size],
    );
    if (res.rowCount === 0) throw new SetupError('not_found');
    await audit(client, tenantId, actor, 'team.update', 'team', teamId, { size });
  });

export interface EngagementSetup {
  readonly id: string;
  readonly name: string | null;
  readonly organisationName: string;
  readonly locale: 'fr' | 'en';
  readonly status: string;
  readonly opensOn: string;
  readonly closesOn: string;
  readonly teamIds: readonly string[];
  readonly expectedHeadcount: number;
  readonly invitationCount: number;
  readonly shape: MissionShape;
}

export const getEngagementSetup = async (
  tenantId: TenantId,
  engagementId: string,
): Promise<EngagementSetup | null> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      name: string | null;
      org_name: string;
      locale: string;
      status: string;
      opens_at: string | null;
      closes_at: string | null;
      team_ids: string[];
      expected_headcount: number;
      invitation_count: string;
      kind: string | null;
      mode: string | null;
    }>(
      `SELECT e.id, e.name, COALESCE(o.trading_name, o.legal_name) AS org_name, e.locale, e.status,
              e.opens_at, e.closes_at,
              COALESCE((SELECT array_agg(et.team_id) FROM engagement_teams et
                         WHERE et.engagement_id = e.id), ARRAY[]::uuid[]) AS team_ids,
              COALESCE((SELECT SUM(t.expected_headcount) FROM engagement_teams et
                          JOIN teams t ON t.id = et.team_id
                         WHERE et.engagement_id = e.id), 0)::int AS expected_headcount,
              (SELECT count(*) FROM invitations i WHERE i.engagement_id = e.id) AS invitation_count,
              to_jsonb(e) ->> 'kind' AS kind, to_jsonb(e) ->> 'mode' AS mode
         FROM engagements e
         JOIN organisations o ON o.tenant_id = e.tenant_id
        WHERE e.tenant_id = $1 AND e.id = $2
        ORDER BY o.created_at, o.id LIMIT 1`,
      [tenantId, engagementId],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      organisationName: r.org_name,
      locale: r.locale === 'fr' ? 'fr' : 'en',
      status: r.status,
      opensOn: dayOf(r.opens_at ? new Date(r.opens_at).toISOString() : null),
      closesOn: dayOf(r.closes_at ? new Date(r.closes_at).toISOString() : null),
      teamIds: r.team_ids,
      expectedHeadcount: r.expected_headcount,
      invitationCount: Number(r.invitation_count),
      shape: missionShape(r.kind, r.mode),
    };
  });

const attachTeams = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
  teamIds: readonly string[],
): Promise<void> => {
  if (teamIds.length > 0) {
    const known = await client.query<{ id: string }>(
      `SELECT id FROM teams WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
      [tenantId, teamIds],
    );
    if (known.rows.length !== teamIds.length) throw new SetupError('bad_id');
  }
  await client.query(
    `DELETE FROM engagement_teams WHERE tenant_id = $1 AND engagement_id = $2
        AND NOT (team_id = ANY($3::uuid[]))`,
    [tenantId, engagementId, teamIds],
  );
  for (const teamId of teamIds) {
    await client.query(
      `INSERT INTO engagement_teams (engagement_id, team_id, tenant_id) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [engagementId, teamId, tenantId],
    );
  }
};

/** Migration 0035 (mission kind and mode, ADR 0065) is applied. */
export const missionKindReady = async (client: pg.PoolClient): Promise<boolean> =>
  (
    await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'engagements' AND column_name = 'kind'`,
    )
  ).rowCount === 1;

/** Whether the new-mission form may offer interview and governance missions yet. */
export const missionKindAvailable = (tenantId: TenantId): Promise<boolean> =>
  withTenant(tenantId, missionKindReady);

const DEFAULT_PRIVACY = {
  minResponsesForGroupBreakdown: 5,
  managerSeesIndividualMaturity: false,
  benchmarkCandidate: false,
};

/** New engagements reuse the questionnaire of the organisation's latest one (or its newest version). */
export const createEngagement = async (
  tenantId: TenantId,
  actor: UserId,
  input: EngagementInput,
): Promise<string> =>
  withTenant(tenantId, async (client) => {
    const latest = await client.query<{
      template_id: string;
      questionnaire_version_id: string;
      privacy_json: Record<string, unknown>;
    }>(
      `SELECT template_id, questionnaire_version_id, privacy_json FROM engagements
        WHERE tenant_id = $1 ORDER BY created_at DESC, id LIMIT 1`,
      [tenantId],
    );
    let templateId = latest.rows[0]?.template_id;
    let versionId = latest.rows[0]?.questionnaire_version_id;
    if (!templateId || !versionId) {
      const v = await client.query<{ template_id: string; id: string }>(
        `SELECT template_id, id FROM questionnaire_versions WHERE tenant_id = $1
          ORDER BY frozen_at DESC, id LIMIT 1`,
        [tenantId],
      );
      templateId = v.rows[0]?.template_id;
      versionId = v.rows[0]?.id;
    }
    if (!templateId || !versionId) throw new SetupError('no_template');
    const privacy = {
      ...DEFAULT_PRIVACY,
      ...(latest.rows[0]?.privacy_json ?? {}),
      noticeLocale: input.locale,
    };
    const id = randomUUID();
    const shape = input.shape ?? DEFAULT_MISSION_SHAPE;
    const ready = await missionKindReady(client);
    // Before migration 0035 only a team survey can be stored; anything else fails closed.
    if (!ready && (shape.kind !== 'team' || shape.mode !== 'survey')) {
      throw new SetupError('kind_not_ready');
    }
    await client.query(
      `INSERT INTO engagements (id, tenant_id, name, template_id, questionnaire_version_id, status,
                                opens_at, closes_at, locale, privacy_json)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9)`,
      [
        id,
        tenantId,
        input.name,
        templateId,
        versionId,
        dayStart(input.opensOn),
        dayEnd(input.closesOn),
        input.locale,
        JSON.stringify(privacy),
      ],
    );
    if (ready) {
      await client.query(
        `UPDATE engagements SET kind = $3, mode = $4 WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id, shape.kind, shape.mode],
      );
    }
    await attachTeams(client, tenantId, id, input.teamIds);
    await audit(client, tenantId, actor, 'engagement.create', 'engagement', id, {
      teams: input.teamIds.length,
      locale: input.locale,
      kind: shape.kind,
      mode: shape.mode,
    });
    return id;
  });

/** Teams can change until the engagement is closed; the name, language and dates until then too. */
export const updateEngagement = async (
  tenantId: TenantId,
  actor: UserId,
  engagementId: string,
  input: EngagementInput,
): Promise<void> =>
  withTenant(tenantId, async (client) => {
    const cur = await client.query<{ status: string; privacy_json: Record<string, unknown> }>(
      `SELECT status, privacy_json FROM engagements WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
      [tenantId, engagementId],
    );
    const row = cur.rows[0];
    if (!row) throw new SetupError('not_found');
    if (['closed', 'archived'].includes(row.status)) throw new SetupError('bad_status');
    await client.query(
      `UPDATE engagements SET name = $3, opens_at = $4, closes_at = $5, locale = $6,
              privacy_json = $7, updated_at = now()
        WHERE tenant_id = $1 AND id = $2`,
      [
        tenantId,
        engagementId,
        input.name,
        dayStart(input.opensOn),
        dayEnd(input.closesOn),
        input.locale,
        JSON.stringify({ ...row.privacy_json, noticeLocale: input.locale }),
      ],
    );
    await attachTeams(client, tenantId, engagementId, input.teamIds);
    await audit(client, tenantId, actor, 'engagement.update', 'engagement', engagementId, {
      teams: input.teamIds.length,
    });
  });

export type StatusChange = 'launch' | 'close';

/** draft or scheduled -> in_field (launch, needs at least one team); in_field -> closed (close). */
export const changeEngagementStatus = async (
  tenantId: TenantId,
  actor: UserId,
  engagementId: string,
  change: StatusChange,
): Promise<string> =>
  withTenant(tenantId, async (client) => {
    const cur = await client.query<{ status: string }>(
      `SELECT status FROM engagements WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
      [tenantId, engagementId],
    );
    const status = cur.rows[0]?.status;
    if (!status) throw new SetupError('not_found');
    const next =
      change === 'launch' && ['draft', 'scheduled'].includes(status)
        ? 'in_field'
        : change === 'close' && status === 'in_field'
          ? 'closed'
          : null;
    if (!next) throw new SetupError('bad_status');
    if (change === 'launch') {
      const n = await client.query<{ n: string }>(
        `SELECT count(*) AS n FROM engagement_teams WHERE tenant_id = $1 AND engagement_id = $2`,
        [tenantId, engagementId],
      );
      if (Number(n.rows[0]?.n ?? 0) === 0) throw new SetupError('no_teams');
    }
    await client.query(
      `UPDATE engagements SET status = $3, updated_at = now() WHERE tenant_id = $1 AND id = $2`,
      [tenantId, engagementId, next],
    );
    await audit(client, tenantId, actor, `engagement.${change}`, 'engagement', engagementId, {
      from: status,
      to: next,
    });
    return next;
  });
