import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signInviteToken } from './invitationToken';

/**
 * TASK-AF (ADR 0052): the slug rules and the address-to-invitation branch. A visitor is an
 * invitation: no cookie gives a new anonymous row, the same browser keeps its own, and a token of
 * another team is never reused.
 */
const s = vi.hoisted(() => ({
  address: null as null | {
    tenant_id: string;
    engagement_id: string;
    team_id: string;
    status: string;
    closes_at: Date | null;
  },
  ownedReferences: new Set<string>(),
  inserted: [] as unknown[][],
}));

vi.mock('@/lib/db', () => ({
  withTenant: async () => null,
  withServiceAccount: async (fn: (c: unknown) => unknown) =>
    fn({
      query: async (sql: string, p: unknown[] = []) => {
        if (/FROM team_addresses a JOIN engagements e/.test(sql)) {
          return { rows: s.address && p[0] === 'demo-sales' ? [s.address] : [] };
        }
        if (/SELECT 1 FROM invitations/.test(sql)) {
          const rows = s.ownedReferences.has(p[0] as string) ? [{}] : [];
          return { rows, rowCount: rows.length };
        }
        if (/INSERT INTO invitations/.test(sql)) {
          s.inserted.push(p);
          return { rows: [], rowCount: 1 };
        }
        throw new Error(`unexpected sql ${sql}`);
      },
    }),
}));

const NOW = new Date('2026-10-26T10:00:00Z');
const ROW = {
  tenant_id: 't1',
  engagement_id: 'e1',
  team_id: 'team1',
  status: 'in_field',
  closes_at: new Date('2026-11-12T00:00:00Z'),
};

beforeEach(() => {
  s.address = { ...ROW };
  s.ownedReferences = new Set();
  s.inserted = [];
});

describe('slug rules', () => {
  it('builds <organisation>-<team> in lower-case ASCII', async () => {
    const { baseSlug, slugPart, isValidSlug, looksLikeSlug } = await import('./teamAddresses');
    expect(baseSlug('Demo Client', 'Sales team')).toBe('demo-sales-team');
    expect(baseSlug('synthetic-client-c', 'Équipe Ventes')).toBe('client-equipe-ventes');
    expect(slugPart('  Ça va ?! ', 20)).toBe('ca-va');
    // Whole words only (ESN rehearsal, 2026-10-30).
    expect(baseSlug('ESN pilote', 'Recrutement et RH')).toBe('esn-recrutement-et-rh');
    expect(baseSlug('ESN pilote', 'Business managers')).toBe('esn-business-managers');
    expect(slugPart('Supercalifragilistic', 10)).toBe('supercalif');
    expect(isValidSlug('demo-sales')).toBe(true);
    for (const bad of ['', 'ab', 'Demo', 'a_b', '-demo', 'demo-', 'a--b', 'x'.repeat(61)]) {
      expect(isValidSlug(bad), bad).toBe(false);
    }
    expect(looksLikeSlug('demo-sales')).toBe(true);
    expect(looksLikeSlug('iAbc.signature')).toBe(false);
  });

  it('parses the team size: empty clears, whole numbers pass, the rest is refused', async () => {
    const { parseTeamSize } = await import('./teamAddresses');
    expect(parseTeamSize('')).toBeNull();
    expect(parseTeamSize(' 12 ')).toBe(12);
    for (const bad of ['0', '-1', '1.5', 'abc', '100001']) {
      expect(parseTeamSize(bad), bad).toBeUndefined();
    }
  });
});

describe('openByAddress', () => {
  it('a fresh browser gets its own anonymous invitation, valid until close + 30 days', async () => {
    const { openByAddress } = await import('./teamAddresses');
    const a = await openByAddress('demo-sales', null, NOW);
    const b = await openByAddress('demo-sales', null, NOW);
    expect(a.kind === 'ok' && a.created).toBe(true);
    expect(b.kind === 'ok' && b.created).toBe(true);
    expect(a.kind === 'ok' && b.kind === 'ok' && a.token !== b.token).toBe(true);
    expect(s.inserted).toHaveLength(2);
    const [, tenant, engagement, team, pseudonym, , , opens, expires] = s.inserted[0] as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      Date,
      Date,
    ];
    expect([tenant, engagement, team]).toEqual(['t1', 'e1', 'team1']);
    expect(pseudonym).toMatch(/^p-[0-9a-f]{16}$/);
    expect(opens).toEqual(NOW);
    expect(expires.toISOString().slice(0, 10)).toBe('2026-12-12');
  });

  it('the same browser keeps its invitation; a token of another team is not reused', async () => {
    const { openByAddress } = await import('./teamAddresses');
    const token = signInviteToken('iOwnReference');
    s.ownedReferences.add('iOwnReference');
    const again = await openByAddress('demo-sales', token, NOW);
    expect(again).toEqual({ kind: 'ok', token, created: false });
    expect(s.inserted).toHaveLength(0);
    const other = signInviteToken('iOtherTeamReference');
    const fresh = await openByAddress('demo-sales', other, NOW);
    expect(fresh.kind === 'ok' && fresh.created).toBe(true);
    const forged = await openByAddress('demo-sales', 'iOwnReference.' + 'x'.repeat(43), NOW);
    expect(forged.kind === 'ok' && forged.created).toBe(true);
  });

  it('unknown, malformed and closed addresses create nothing', async () => {
    const { openByAddress } = await import('./teamAddresses');
    expect(await openByAddress('nobody', null, NOW)).toEqual({ kind: 'unknown' });
    expect(await openByAddress('NOT VALID', null, NOW)).toEqual({ kind: 'unknown' });
    s.address = { ...ROW, status: 'closed' };
    expect(await openByAddress('demo-sales', null, NOW)).toEqual({ kind: 'closed' });
    expect(s.inserted).toHaveLength(0);
  });

  it('a closed mission still lets the same browser see its own invitation', async () => {
    const { openByAddress } = await import('./teamAddresses');
    s.address = { ...ROW, status: 'closed' };
    s.ownedReferences.add('iOwnReference');
    const token = signInviteToken('iOwnReference');
    expect(await openByAddress('demo-sales', token, NOW)).toEqual({
      kind: 'ok',
      token,
      created: false,
    });
  });
});
