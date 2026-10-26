import { randomBytes } from 'node:crypto';
import type { TenantId, UserId } from '@evolai/contracts';
import type pg from 'pg';
import { withServiceAccount, withTenant } from './db';
import { signInviteToken } from './invitationToken';
import { decryptAddress } from './invitationCrypto';
import {
  applyMinGroup,
  engagementTotals,
  isReminderDue,
  parseReminderDays,
  surveyLink,
  MAX_REMINDERS_PER_RUN,
  type EngagementTotals,
  type TeamCounts,
  type TeamProgressRow,
} from './invitationTracking';
import { parseContact } from './referentView';

/**
 * Invitation administration (FR-03, ADR 0033). Everything here is tenant-scoped (withTenant, RLS)
 * except the optional delivery addresses, which live in a service-account-only table.
 *
 * Privacy rules enforced in this file:
 *  - default mode stores no email address and no name;
 *  - progress is computed from `invitations` only, never joined to submissions or answers;
 *  - the only per-invitation listing is "not yet completed", with a short opaque code, no status,
 *    and it is for the auditor only; a team referent has one address per team and no list of
 *    people at all (TASK-AF, ADR 0051).
 */

const SYSTEM_ACTOR = '00000000-0000-4000-8000-000000000000';
const OPEN_STATUSES = "('pending','opened','in_progress')";

export class InvitationError extends Error {
  public constructor(
    public readonly code:
      | 'engagement_not_found'
      | 'engagement_closed'
      | 'team_not_in_engagement'
      | 'bad_count'
      | 'bad_expiry'
      | 'email_off'
      | 'not_found'
      | 'not_open'
      | 'duplicate_batch',
  ) {
    super(code);
    this.name = 'InvitationError';
  }
}

export interface EngagementSettings {
  readonly emailDelivery: boolean;
  readonly reminderDays: readonly number[];
  readonly status: string;
  readonly locale: 'fr' | 'en';
  /** Closing day of the survey (ISO day), or null when not set. */
  readonly closesOn: string | null;
  /** Contact person named in the referent's messages (one line), or null. */
  readonly contact: string | null;
}

const newReference = (): string => `i${randomBytes(18).toString('base64url')}`;

export const tokenFor = (reference: string): string => signInviteToken(reference);

const audit = async (
  client: pg.PoolClient,
  tenantId: string,
  actor: string,
  action: string,
  targetKind: 'invitation' | 'engagement',
  targetId: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  await client.query(
    `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tenantId, actor, action, targetKind, targetId, JSON.stringify(payload)],
  );
};

export const getSettings = async (
  tenantId: TenantId,
  engagementId: string,
): Promise<EngagementSettings | null> =>
  withTenant(tenantId, async (client) => readSettings(client, tenantId, engagementId));

const readSettings = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<EngagementSettings | null> => {
  const { rows } = await client.query<{
    status: string;
    locale: string;
    privacy_json: Record<string, unknown>;
    closes_on: string | null;
  }>(
    `SELECT status, locale, privacy_json, to_char(closes_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS closes_on
       FROM engagements WHERE tenant_id = $1 AND id = $2`,
    [tenantId, engagementId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    emailDelivery: row.privacy_json['emailDelivery'] === true,
    reminderDays: parseReminderDays(row.privacy_json['reminderDays']),
    status: row.status,
    locale: row.locale === 'fr' ? 'fr' : 'en',
    closesOn: row.closes_on,
    contact: parseContact(row.privacy_json['contact']),
  };
};

export const listEngagementTeams = async (
  tenantId: TenantId,
  engagementId: string,
): Promise<{ id: string; name: string }[]> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ id: string; name: string }>(
      `SELECT t.id, t.name FROM engagement_teams et JOIN teams t ON t.id = et.team_id
        WHERE et.tenant_id = $1 AND et.engagement_id = $2 ORDER BY t.name`,
      [tenantId, engagementId],
    );
    return rows;
  });

export const updateSettings = async (
  tenantId: TenantId,
  engagementId: string,
  actor: UserId,
  patch: {
    emailDelivery: boolean;
    reminderDays: readonly number[];
    closesOn: string | null;
    contact: string | null;
  },
): Promise<void> =>
  withTenant(tenantId, async (client) => {
    // Closing date: end of that day, UTC. The contact is one line of free text the auditor types.
    const res = await client.query(
      `UPDATE engagements
          SET privacy_json = privacy_json || $3::jsonb,
              closes_at = CASE WHEN $4::date IS NULL THEN NULL
                               ELSE ($4::date + interval '1 day' - interval '1 second') AT TIME ZONE 'UTC' END,
              updated_at = now()
        WHERE tenant_id = $1 AND id = $2`,
      [
        tenantId,
        engagementId,
        JSON.stringify({
          emailDelivery: patch.emailDelivery,
          reminderDays: patch.reminderDays,
          contact: patch.contact ?? '',
        }),
        patch.closesOn,
      ],
    );
    if (res.rowCount === 0) throw new InvitationError('engagement_not_found');
    // The contact may name a person: the trail records only whether it is set.
    await audit(client, tenantId, actor, 'invitation.settings', 'engagement', engagementId, {
      emailDelivery: patch.emailDelivery,
      reminderDays: patch.reminderDays,
      closesOn: patch.closesOn,
      contactSet: patch.contact !== null,
    });
  });

export interface Progress {
  readonly teams: TeamProgressRow[];
  readonly totals: EngagementTotals | null;
}

/**
 * Raw counts per team from `invitations` alone (revoked invitations are not counted as invited).
 * Callers apply a minimum group rule before anything is shown: `applyMinGroup` for the auditor,
 * `referentParticipation` for a team referent.
 */
export const teamCounts = async (tenantId: TenantId, engagementId: string): Promise<TeamCounts[]> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      team_id: string;
      team_name: string;
      invited: number;
      opened: number;
      started: number;
      completed: number;
      last_activity_on: string | null;
    }>(
      `SELECT i.team_id, t.name AS team_name,
              COUNT(*)::int AS invited,
              COUNT(*) FILTER (WHERE i.status IN ('opened','in_progress','submitted'))::int AS opened,
              COUNT(*) FILTER (WHERE i.status IN ('in_progress','submitted'))::int AS started,
              COUNT(*) FILTER (WHERE i.status = 'submitted')::int AS completed,
              to_char(MAX(i.last_activity_on), 'YYYY-MM-DD') AS last_activity_on
         FROM invitations i JOIN teams t ON t.id = i.team_id
        WHERE i.tenant_id = $1 AND i.engagement_id = $2 AND i.status <> 'revoked'
        GROUP BY i.team_id, t.name ORDER BY t.name`,
      [tenantId, engagementId],
    );
    return rows.map((r) => ({
      teamId: r.team_id,
      teamName: r.team_name,
      invited: r.invited,
      opened: r.opened,
      started: r.started,
      completed: r.completed,
      lastActivityOn: r.last_activity_on,
    }));
  });

/** Headcount the auditor expects and the links made, so the page can set them side by side. */
export const linkTotals = async (
  tenantId: TenantId,
  engagementId: string,
): Promise<{ expected: number; created: number; revoked: number }> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ expected: number; created: number; revoked: number }>(
      `SELECT COALESCE((SELECT SUM(t.expected_headcount) FROM engagement_teams et
                          JOIN teams t ON t.id = et.team_id
                         WHERE et.tenant_id = $1 AND et.engagement_id = $2), 0)::int AS expected,
              COUNT(*)::int AS created,
              COUNT(*) FILTER (WHERE i.status = 'revoked')::int AS revoked
         FROM invitations i WHERE i.tenant_id = $1 AND i.engagement_id = $2`,
      [tenantId, engagementId],
    );
    return rows[0] ?? { expected: 0, created: 0, revoked: 0 };
  });

/** Auditor progress: counts per team with the minimum group rule, and engagement totals. */
export const progress = async (tenantId: TenantId, engagementId: string): Promise<Progress> => {
  const counts = await teamCounts(tenantId, engagementId);
  return { teams: applyMinGroup(counts), totals: engagementTotals(counts) };
};

export interface OpenInvitation {
  readonly id: string;
  readonly code: string;
  readonly teamName: string;
  readonly expiresOn: string;
  readonly link: string;
}

/** Links of invitations not yet completed (and not revoked), for export and for resending. */
export const listOpen = async (
  tenantId: TenantId,
  engagementId: string,
  baseUrl: string,
): Promise<OpenInvitation[]> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      token_reference: string;
      team_name: string;
      expires_on: string;
    }>(
      `SELECT i.id, i.token_reference, t.name AS team_name, to_char(i.expires_at, 'YYYY-MM-DD') AS expires_on
         FROM invitations i JOIN teams t ON t.id = i.team_id
        WHERE i.tenant_id = $1 AND i.engagement_id = $2 AND i.status IN ${OPEN_STATUSES}
        ORDER BY t.name, i.created_at, i.id`,
      [tenantId, engagementId],
    );
    return rows.map((r) => ({
      id: r.id,
      code: r.token_reference.slice(-6),
      teamName: r.team_name,
      expiresOn: r.expires_on,
      link: surveyLink(baseUrl, tokenFor(r.token_reference)),
    }));
  });

interface DueRow {
  id: string;
  token_reference: string;
  team_name: string;
  status: string;
  created_on: string;
  expires_at: string;
  reminder_count: number;
}

const loadDue = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
  schedule: readonly number[],
  now: Date,
): Promise<DueRow[]> => {
  const { rows } = await client.query<DueRow>(
    `SELECT i.id, i.token_reference, t.name AS team_name, i.status,
            to_char(i.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS created_on,
            i.expires_at, i.reminder_count
       FROM invitations i JOIN teams t ON t.id = i.team_id
      WHERE i.tenant_id = $1 AND i.engagement_id = $2 AND i.status IN ${OPEN_STATUSES}
        AND i.expires_at > now() AND i.reminder_count < $3
      ORDER BY i.created_at, i.id`,
    [tenantId, engagementId, schedule.length],
  );
  return rows.filter((r) =>
    isReminderDue(
      {
        status: r.status,
        createdOn: r.created_on,
        expiresAt: r.expires_at,
        reminderCount: r.reminder_count,
      },
      schedule,
      now,
    ),
  );
};

/** No-email mode: the auditor's reminder list (never shown to a referent, ADR 0039). */
export const reminderList = async (
  tenantId: TenantId,
  engagementId: string,
  baseUrl: string,
  now: Date = new Date(),
): Promise<OpenInvitation[]> =>
  withTenant(tenantId, async (client) => {
    const settings = await readSettings(client, tenantId, engagementId);
    if (!settings) return [];
    const due = await loadDue(client, tenantId, engagementId, settings.reminderDays, now);
    return due.map((r) => ({
      id: r.id,
      code: r.token_reference.slice(-6),
      teamName: r.team_name,
      expiresOn: r.expires_at.slice(0, 10),
      link: surveyLink(baseUrl, tokenFor(r.token_reference)),
    }));
  });

/** Admin confirms the list was resent: consumes the current reminder step. Idempotent. */
export const markReminded = async (
  tenantId: TenantId,
  engagementId: string,
  actor: UserId,
  now: Date = new Date(),
): Promise<number> =>
  withTenant(tenantId, async (client) => {
    const settings = await readSettings(client, tenantId, engagementId);
    if (!settings) throw new InvitationError('engagement_not_found');
    const due = await loadDue(client, tenantId, engagementId, settings.reminderDays, now);
    if (due.length === 0) return 0;
    await client.query(
      `UPDATE invitations SET reminder_count = reminder_count + 1, last_reminder_on = current_date,
              updated_at = now()
        WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
      [tenantId, due.map((d) => d.id)],
    );
    await audit(client, tenantId, actor, 'invitation.remind', 'engagement', engagementId, {
      mode: 'list',
      count: due.length,
    });
    return due.length;
  });

export interface BatchSummary {
  readonly batchId: string;
  readonly createdOn: string;
  readonly total: number;
  readonly open: number;
}

/** Link batches of an engagement, newest first (counts only: no per-link status leaves this list). */
export const listBatches = async (
  tenantId: TenantId,
  engagementId: string,
): Promise<BatchSummary[]> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      batch_id: string;
      created_on: string;
      total: string;
      open: string;
    }>(
      `SELECT batch_id, to_char(min(created_at), 'YYYY-MM-DD') AS created_on, count(*) AS total,
              count(*) FILTER (WHERE status IN ${OPEN_STATUSES}) AS open
         FROM invitations
        WHERE tenant_id = $1 AND engagement_id = $2 AND batch_id IS NOT NULL
        GROUP BY batch_id ORDER BY min(created_at) DESC LIMIT 50`,
      [tenantId, engagementId],
    );
    return rows.map((r) => ({
      batchId: r.batch_id,
      createdOn: r.created_on,
      total: Number(r.total),
      open: Number(r.open),
    }));
  });

/** Withdraw every open link of one batch. Completed links are untouched. Returns how many stopped. */
export const revokeBatch = async (
  tenantId: TenantId,
  engagementId: string,
  batchId: string,
  actor: UserId,
): Promise<number> => {
  const ids = await withTenant(tenantId, async (client) => {
    const res = await client.query<{ id: string }>(
      `UPDATE invitations SET status = 'revoked', revoked_at = now(), updated_at = now()
        WHERE tenant_id = $1 AND engagement_id = $2 AND batch_id = $3 AND status IN ${OPEN_STATUSES}
        RETURNING id`,
      [tenantId, engagementId, batchId],
    );
    if (res.rows.length === 0) throw new InvitationError('not_open');
    await audit(client, tenantId, actor, 'invitation.revoke_batch', 'engagement', engagementId, {
      batchId,
      count: res.rows.length,
    });
    return res.rows.map((r) => r.id);
  });
  for (const id of ids) await purgeDelivery(tenantId, id);
  return ids.length;
};

export const revoke = async (
  tenantId: TenantId,
  invitationId: string,
  actor: UserId,
): Promise<void> =>
  withTenant(tenantId, async (client) => {
    const res = await client.query<{ engagement_id: string }>(
      `UPDATE invitations SET status = 'revoked', revoked_at = now(), updated_at = now()
        WHERE tenant_id = $1 AND id = $2 AND status IN ${OPEN_STATUSES}
        RETURNING engagement_id`,
      [tenantId, invitationId],
    );
    if (res.rowCount === 0) throw new InvitationError('not_open');
    await audit(client, tenantId, actor, 'invitation.revoke', 'invitation', invitationId, {
      engagementId: res.rows[0]?.engagement_id,
    });
  }).then(() => purgeDelivery(tenantId, invitationId));

export const extend = async (
  tenantId: TenantId,
  invitationId: string,
  actor: UserId,
  days: number,
): Promise<void> => {
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new InvitationError('bad_expiry');
  await withTenant(tenantId, async (client) => {
    const res = await client.query(
      `UPDATE invitations
          SET expires_at = GREATEST(expires_at, now()) + make_interval(days => $3),
              status = CASE WHEN status = 'expired' THEN 'pending' ELSE status END,
              updated_at = now()
        WHERE tenant_id = $1 AND id = $2 AND status IN ('pending','opened','in_progress','expired')`,
      [tenantId, invitationId, days],
    );
    if (res.rowCount === 0) throw new InvitationError('not_open');
    await audit(client, tenantId, actor, 'invitation.extend', 'invitation', invitationId, { days });
  });
  await withServiceAccount((c) =>
    c.query(
      `UPDATE invitation_deliveries d SET purge_after = i.expires_at + interval '1 day'
         FROM invitations i WHERE d.invitation_id = i.id AND i.id = $1 AND i.tenant_id = $2`,
      [invitationId, tenantId],
    ),
  );
};

/** Lost link: a new reference replaces the old one, so the old link stops working at once. */
export const regenerate = async (
  tenantId: TenantId,
  invitationId: string,
  actor: UserId,
  baseUrl: string,
): Promise<string> =>
  withTenant(tenantId, async (client) => {
    const reference = newReference();
    const token = tokenFor(reference);
    const res = await client.query(
      `UPDATE invitations SET token_reference = $3, token_signature = $4, updated_at = now()
        WHERE tenant_id = $1 AND id = $2 AND status IN ${OPEN_STATUSES}`,
      [tenantId, invitationId, reference, token.split('.')[1]],
    );
    if (res.rowCount === 0) throw new InvitationError('not_open');
    await audit(client, tenantId, actor, 'invitation.regenerate', 'invitation', invitationId, {});
    return surveyLink(baseUrl, token);
  });

export const purgeDelivery = async (tenantId: string, invitationId: string): Promise<void> => {
  await withServiceAccount((c) =>
    c.query(`DELETE FROM invitation_deliveries WHERE tenant_id = $1 AND invitation_id = $2`, [
      tenantId,
      invitationId,
    ]),
  );
};

export { SYSTEM_ACTOR, decryptAddress, MAX_REMINDERS_PER_RUN };

/** Export helper: list the links and write one audit row (counts only). */
export const withAudit = async (
  tenantId: string,
  engagementId: string,
  actor: string,
  kind: 'all' | 'reminders',
  baseUrl: string,
): Promise<OpenInvitation[]> => {
  const rows =
    kind === 'reminders'
      ? await reminderList(tenantId as TenantId, engagementId, baseUrl, new Date())
      : await listOpen(tenantId as TenantId, engagementId, baseUrl);
  await auditExport(tenantId, engagementId, actor, kind, rows.length);
  return rows;
};

const auditExport = async (
  tenantId: string,
  engagementId: string,
  actor: string,
  kind: 'all' | 'reminders' | 'team',
  count: number,
  teams?: number,
): Promise<void> =>
  withTenant(tenantId as TenantId, (client) =>
    audit(client, tenantId, actor, 'invitation.export', 'engagement', engagementId, {
      kind,
      count,
      ...(teams !== undefined ? { teams } : {}),
    }),
  );
