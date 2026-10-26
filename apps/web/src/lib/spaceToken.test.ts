import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * TASK-AF (ADR 0051): "Open my space" tokens are `space` tokens, single use, expiring, hashed at
 * rest, and a set-password or reset token can never open a session. The in-memory client answers
 * the statements with the same conditions as the SQL.
 */
interface Tok {
  user_id: string;
  kind: string;
  purpose: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
}
const db = vi.hoisted(() => ({
  tokens: [] as Tok[],
  disabled: new Set<string>(),
}));

vi.mock('@/lib/db', () => {
  const client = {
    query: async (sql: string, p: unknown[] = []) => {
      if (/^\s*UPDATE auth_tokens SET used_at = \$2 WHERE user_id = \$1/.test(sql)) {
        for (const t of db.tokens) if (t.user_id === p[0] && !t.used_at) t.used_at = p[1] as Date;
        return { rows: [], rowCount: 0 };
      }
      if (/INSERT INTO auth_tokens/.test(sql)) {
        db.tokens.push({
          user_id: p[0] as string,
          kind: p[1] as string,
          purpose: p[5] as string,
          token_hash: p[2] as string,
          expires_at: p[3] as Date,
          used_at: null,
        });
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE auth_tokens t SET used_at = \$2/.test(sql)) {
        const t = db.tokens.find(
          (x) =>
            x.token_hash === p[0] &&
            x.purpose === 'space' &&
            !x.used_at &&
            x.expires_at > (p[1] as Date) &&
            !db.disabled.has(x.user_id),
        );
        if (!t) return { rows: [], rowCount: 0 };
        t.used_at = p[1] as Date;
        return { rows: [{ user_id: t.user_id }], rowCount: 1 };
      }
      if (/SELECT display_name FROM users/.test(sql)) {
        return { rows: [{ display_name: 'Demo Referent' }], rowCount: 1 };
      }
      throw new Error(`unexpected sql ${sql}`);
    },
  };
  return { withServiceAccount: async (fn: (c: unknown) => unknown) => fn(client) };
});

const USER = '77777777-7777-4777-8777-777777777777';
const NOW = new Date('2026-10-26T10:00:00Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);

beforeEach(() => {
  db.tokens = [];
  db.disabled = new Set();
});

describe('space token', () => {
  it('lives 30 days and opens once', async () => {
    const { issueToken, spendSpaceToken, TOKEN_TTL_MINUTES } = await import('./authTokens');
    expect(TOKEN_TTL_MINUTES.space).toBe(30 * 24 * 60);
    const { withServiceAccount } = await import('@/lib/db');
    const { token } = await withServiceAccount((c) => issueToken(c, USER, 'space', NOW));
    expect(db.tokens[0]?.token_hash).not.toBe(token);
    expect(db.tokens[0]).toMatchObject({ kind: 'invite', purpose: 'space' });
    expect(await spendSpaceToken(token, later(60_000))).toEqual({
      userId: USER,
      displayName: 'Demo Referent',
    });
    expect(await spendSpaceToken(token, later(120_000))).toBeNull();
  });

  it('is refused after 30 days, for a disabled user and for a malformed value', async () => {
    const { tokenDigest, spendSpaceToken } = await import('./authTokens');
    const token = 'a'.repeat(43);
    db.tokens.push({
      user_id: USER,
      kind: 'invite',
      purpose: 'space',
      token_hash: tokenDigest(token),
      expires_at: later(30 * 86_400_000),
      used_at: null,
    });
    expect(await spendSpaceToken(token, later(31 * 86_400_000))).toBeNull();
    db.disabled.add(USER);
    expect(await spendSpaceToken(token, later(1000))).toBeNull();
    expect(await spendSpaceToken('short', later(1000))).toBeNull();
  });

  it('a set-password or reset token cannot open a session', async () => {
    const { tokenDigest, spendSpaceToken } = await import('./authTokens');
    for (const kind of ['invite', 'reset']) {
      const token = (kind === 'invite' ? 'b' : 'c').repeat(43);
      db.tokens.push({
        user_id: USER,
        kind,
        purpose: 'password',
        token_hash: tokenDigest(token),
        expires_at: later(86_400_000),
        used_at: null,
      });
      expect(await spendSpaceToken(token, later(1000))).toBeNull();
    }
  });
});
