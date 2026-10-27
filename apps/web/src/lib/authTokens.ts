import { createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import { withServiceAccount } from './db';
import { hashPassword } from './password';
import { passwordProblem, type PasswordProblem } from './passwordPolicy';

/**
 * Single-use set-password and reset tokens (TASK-U, ADR 0040). The link carries 32 random bytes;
 * only their SHA-256 is stored, so a database read cannot be replayed as a link. Time is passed in
 * (never read inside SQL) so expiry is testable. A token is spent by one atomic UPDATE, so two
 * parallel requests cannot both win.
 */
export type TokenKind = 'invite' | 'reset' | 'space';

/** Owner-made links are sent by hand, so they live longer than a self-service reset. */
export const TOKEN_TTL_MINUTES: Record<TokenKind, number> = {
  invite: 72 * 60,
  reset: 60,
  // "Open my space" (TASK-AF, ADR 0052): the referent's welcome email, single use.
  space: 30 * 24 * 60,
};

export const tokenDigest = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const newToken = (): string => randomBytes(32).toString('base64url');

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;
export const looksLikeToken = (v: string): boolean => TOKEN_SHAPE.test(v);

/** Issue a token for a user; any earlier unused token of the same user is spent first. */
export const issueToken = async (
  client: pg.PoolClient,
  userId: string,
  kind: TokenKind,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> => {
  await client.query(`UPDATE auth_tokens SET used_at = $2 WHERE user_id = $1 AND used_at IS NULL`, [
    userId,
    now,
  ]);
  const token = newToken();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MINUTES[kind] * 60_000);
  // A space token is stored as an 'invite' with purpose 'space' (migration 0027).
  await client.query(
    `INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at, created_at, purpose)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      kind === 'space' ? 'invite' : kind,
      tokenDigest(token),
      expiresAt,
      now,
      kind === 'space' ? 'space' : 'password',
    ],
  );
  return { token, expiresAt };
};

export interface TokenPeek {
  readonly userId: string;
  readonly kind: TokenKind;
}

/** Is this link still usable? Read only; does not spend it. */
export const peekToken = async (
  token: string,
  now: Date = new Date(),
): Promise<TokenPeek | null> => {
  if (!looksLikeToken(token)) return null;
  return withServiceAccount(async (client) => {
    const { rows } = await client.query<{ user_id: string; kind: TokenKind }>(
      `SELECT t.user_id, t.kind FROM auth_tokens t JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = $1 AND t.purpose = 'password' AND t.used_at IS NULL
          AND t.expires_at > $2 AND u.disabled_at IS NULL`,
      [tokenDigest(token), now],
    );
    const row = rows[0];
    return row ? { userId: row.user_id, kind: row.kind } : null;
  });
};

export type SetPasswordResult =
  | { ok: true; userId: string; kind: TokenKind; displayName: string }
  | { ok: false; reason: 'invalid' | PasswordProblem };

/**
 * Spend the token and set the password in one transaction. The password is checked first, so a
 * typo does not burn the link; a bad, used, expired or disabled-user token is just "invalid".
 */
export const setPasswordWithToken = async (
  token: string,
  password: string,
  again: string,
  now: Date = new Date(),
): Promise<SetPasswordResult> => {
  const problem = passwordProblem(password, again);
  if (problem) return { ok: false, reason: problem };
  if (!looksLikeToken(token)) return { ok: false, reason: 'invalid' };
  const hash = await hashPassword(password);
  return withServiceAccount(async (client) => {
    const spent = await client.query<{ user_id: string; kind: TokenKind }>(
      `UPDATE auth_tokens t SET used_at = $2
        WHERE t.token_hash = $1 AND t.purpose = 'password' AND t.used_at IS NULL
          AND t.expires_at > $2
          AND EXISTS (SELECT 1 FROM users u WHERE u.id = t.user_id AND u.disabled_at IS NULL)
        RETURNING t.user_id, t.kind`,
      [tokenDigest(token), now],
    );
    const row = spent.rows[0];
    if (!row) return { ok: false as const, reason: 'invalid' as const };
    const user = await client.query<{ display_name: string }>(
      `UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING display_name`,
      [row.user_id, hash],
    );
    // Any other open link of this person dies with the new password.
    await client.query(
      `UPDATE auth_tokens SET used_at = $2 WHERE user_id = $1 AND used_at IS NULL`,
      [row.user_id, now],
    );
    return {
      ok: true as const,
      userId: row.user_id,
      kind: row.kind,
      displayName: user.rows[0]?.display_name ?? '',
    };
  });
};

/**
 * Spend an "Open my space" token (TASK-AF): one atomic UPDATE, so a second use or a parallel one
 * finds nothing. Only `space` tokens qualify; a set-password or reset link cannot open a session.
 */
export const spendSpaceToken = async (
  token: string,
  now: Date = new Date(),
): Promise<{ userId: string; displayName: string } | null> => {
  if (!looksLikeToken(token)) return null;
  return withServiceAccount(async (client) => {
    const spent = await client.query<{ user_id: string }>(
      `UPDATE auth_tokens t SET used_at = $2
        WHERE t.token_hash = $1 AND t.purpose = 'space' AND t.used_at IS NULL AND t.expires_at > $2
          AND EXISTS (SELECT 1 FROM users u WHERE u.id = t.user_id AND u.disabled_at IS NULL)
        RETURNING t.user_id`,
      [tokenDigest(token), now],
    );
    const row = spent.rows[0];
    if (!row) return null;
    const user = await client.query<{ display_name: string }>(
      `SELECT display_name FROM users WHERE id = $1`,
      [row.user_id],
    );
    return { userId: row.user_id, displayName: user.rows[0]?.display_name ?? '' };
  });
};
