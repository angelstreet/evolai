import type { TenantId, UserId } from '@evolai/contracts';
import { emailHash } from './authProvider';
import { issueToken } from './authTokens';
import { withServiceAccount, withTenant } from './db';

/**
 * Referents of an organisation and the owner's "invite this referent" step (TASK-U, ADR 0040).
 * The address the owner types is hashed for lookup like every other sign-in address; it is not
 * stored anywhere else, and is only held in memory to send the email when a provider is set up.
 */
export type ReferentStatus = 'none' | 'ready' | 'disabled';

export interface ReferentRow {
  readonly userId: string;
  readonly name: string;
  readonly teamName: string;
  readonly status: ReferentStatus;
}

export const listReferents = async (tenantId: TenantId): Promise<ReferentRow[]> =>
  withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{
      user_id: string;
      display_name: string;
      team_name: string;
      has_password: boolean;
      disabled: boolean;
    }>(
      `SELECT u.id AS user_id, u.display_name, t.name AS team_name,
              (u.password_hash IS NOT NULL) AS has_password, (u.disabled_at IS NOT NULL) AS disabled
         FROM memberships m
         JOIN users u ON u.id = m.user_id
         JOIN teams t ON t.id = m.team_id
        WHERE m.tenant_id = $1 AND m.role = 'team_referent'
        ORDER BY t.name, u.display_name, u.id`,
      [tenantId],
    );
    return rows.map((r) => ({
      userId: r.user_id,
      name: r.display_name,
      teamName: r.team_name,
      status: r.disabled ? 'disabled' : r.has_password ? 'ready' : 'none',
    }));
  });

export type InviteResult =
  | { ok: true; token: string; expiresAt: Date; emailChanged: boolean }
  | { ok: false; reason: 'not_referent' | 'disabled' | 'taken' };

/**
 * Create the single-use "Open my space" token for one referent of this organisation, optionally replacing their
 * sign-in address. The membership is checked against the organisation first, so an owner of one
 * organisation cannot invite a user of another. One audit row, with no address in it.
 */
export const inviteReferent = async (
  tenantId: TenantId,
  actor: UserId,
  userId: string,
  email: string | null,
  now: Date = new Date(),
): Promise<InviteResult> =>
  withServiceAccount(async (client) => {
    const m = await client.query<{ team_id: string; disabled: boolean }>(
      `SELECT m.team_id, (u.disabled_at IS NOT NULL) AS disabled
         FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.tenant_id = $1 AND m.user_id = $2 AND m.role = 'team_referent' LIMIT 1`,
      [tenantId, userId],
    );
    const row = m.rows[0];
    if (!row) return { ok: false, reason: 'not_referent' };
    if (row.disabled) return { ok: false, reason: 'disabled' };
    if (email) {
      const taken = await client.query(`SELECT 1 FROM users WHERE email_hash = $1 AND id <> $2`, [
        emailHash(email),
        userId,
      ]);
      if (taken.rows.length > 0) return { ok: false, reason: 'taken' };
      await client.query(`UPDATE users SET email_hash = $2 WHERE id = $1`, [
        userId,
        emailHash(email),
      ]);
    }
    const { token, expiresAt } = await issueToken(client, userId, 'space', now);
    await client.query(
      `INSERT INTO audit_log (tenant_id, actor_user_id, action, target_kind, target_id, payload_json)
       VALUES ($1, $2, 'referent.invite', 'user', $3, $4)`,
      [
        tenantId,
        actor,
        userId,
        JSON.stringify({ team_id: row.team_id, email_changed: Boolean(email) }),
      ],
    );
    return { ok: true, token, expiresAt, emailChanged: Boolean(email) };
  });
