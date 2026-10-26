import { randomBytes, randomUUID } from 'node:crypto';
import type { TenantId } from '@evolai/contracts';
import type pg from 'pg';
import { withServiceAccount, withTenant } from './db';
import { signInviteToken, verifyInviteToken, InvalidInviteToken } from './invitationToken';

/**
 * One survey address per team (TASK-AF, ADR 0051). The address `/s/<slug>` is public to whoever
 * the referent forwards it to; opening it in a browser without the cookie creates one anonymous
 * invitation (a visitor *is* an invitation), so answers, progress and the minimum group rule are
 * the ones that already exist. Nothing here stores a name, an address or a per-person state.
 */

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LINK_DAYS_AFTER_CLOSE = 30;
const OPENABLE = new Set(['draft', 'scheduled', 'in_field']);

/** Lower-case ASCII words joined by `-`, at most `max` characters, without accents. */
export const slugPart = (raw: string, max: number): string =>
  raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');

/** `<organisation-short>-<team-short>`, e.g. `demo-sales` for "Demo Client" and "Sales team". */
export const baseSlug = (organisation: string, team: string): string => {
  const org = slugPart(organisation.replace(/^synthetic-/i, ''), 12).split('-')[0] ?? '';
  const parts = [org, slugPart(team, 16)].filter(Boolean).join('-');
  const slug = parts.length >= 3 ? parts : `team-${slugPart(team, 16) || 'x'}`;
  return slug.slice(0, 40);
};

export const isValidSlug = (slug: string): boolean =>
  slug.length >= 3 && slug.length <= 60 && SLUG_SHAPE.test(slug);

/** A route segment that is not an invitation token (those always contain a dot). */
export const looksLikeSlug = (segment: string): boolean =>
  !segment.includes('.') && isValidSlug(segment);

export interface TeamAddress {
  readonly id: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly slug: string;
  readonly expectedSize: number | null;
}

const listWith = async (
  client: pg.PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<TeamAddress[]> => {
  const { rows } = await client.query<{
    id: string;
    team_id: string;
    team_name: string;
    slug: string;
    expected_size: number | null;
  }>(
    `SELECT a.id, a.team_id, t.name AS team_name, a.slug, a.expected_size
       FROM team_addresses a JOIN teams t ON t.id = a.team_id
      WHERE a.tenant_id = $1 AND a.engagement_id = $2 ORDER BY t.name, a.id`,
    [tenantId, engagementId],
  );
  return rows.map((r) => ({
    id: r.id,
    teamId: r.team_id,
    teamName: r.team_name,
    slug: r.slug,
    expectedSize: r.expected_size,
  }));
};

/**
 * Every team of the engagement has an address. Created on first read, with a slug derived from
 * the organisation and the team name; a taken slug gets `-2`, `-3`, … Safe to call repeatedly.
 */
export const ensureTeamAddresses = async (
  tenantId: TenantId,
  engagementId: string,
): Promise<TeamAddress[]> =>
  withServiceAccount(async (client) => {
    const missing = await client.query<{ team_id: string; team_name: string; org: string }>(
      `SELECT et.team_id, t.name AS team_name, tn.display_name AS org
         FROM engagement_teams et
         JOIN teams t ON t.id = et.team_id
         JOIN tenants tn ON tn.id = et.tenant_id
        WHERE et.tenant_id = $1 AND et.engagement_id = $2
          AND NOT EXISTS (SELECT 1 FROM team_addresses a
                           WHERE a.engagement_id = et.engagement_id AND a.team_id = et.team_id)
        ORDER BY t.name`,
      [tenantId, engagementId],
    );
    for (const row of missing.rows) {
      const base = baseSlug(row.org, row.team_name);
      for (let n = 1; n < 50; n += 1) {
        const slug = n === 1 ? base : `${base}-${n}`;
        const res = await client.query(
          `INSERT INTO team_addresses (tenant_id, engagement_id, team_id, slug)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [tenantId, engagementId, row.team_id, slug],
        );
        if ((res.rowCount ?? 0) > 0) break;
        // Another request may have created this team's row meanwhile: stop retrying then.
        const done = await client.query(
          `SELECT 1 FROM team_addresses WHERE engagement_id = $1 AND team_id = $2`,
          [engagementId, row.team_id],
        );
        if ((done.rowCount ?? 0) > 0) break;
      }
    }
    return listWith(client, tenantId, engagementId);
  });

export type AddressUpdate =
  | { ok: true }
  | { ok: false; reason: 'bad_slug' | 'taken' | 'not_found' };

/** Auditor: rename the address of one team. The old address stops working. */
export const setSlug = async (
  tenantId: TenantId,
  engagementId: string,
  teamId: string,
  rawSlug: string,
): Promise<AddressUpdate> => {
  const slug = rawSlug.trim().toLowerCase();
  if (!isValidSlug(slug)) return { ok: false, reason: 'bad_slug' };
  return withTenant(tenantId, async (client) => {
    const taken = await client.query(
      `SELECT 1 FROM team_addresses WHERE slug = $1 AND NOT (engagement_id = $2 AND team_id = $3)`,
      [slug, engagementId, teamId],
    );
    if ((taken.rowCount ?? 0) > 0) return { ok: false as const, reason: 'taken' as const };
    const res = await client.query(
      `UPDATE team_addresses SET slug = $4
        WHERE tenant_id = $1 AND engagement_id = $2 AND team_id = $3`,
      [tenantId, engagementId, teamId, slug],
    );
    return (res.rowCount ?? 0) > 0
      ? { ok: true as const }
      : { ok: false as const, reason: 'not_found' as const };
  });
};

/** Referent or auditor: how many people are in the team (1 to 100000), or null to clear it. */
export const parseTeamSize = (raw: unknown): number | null | undefined => {
  const text = String(raw ?? '').trim();
  if (text === '') return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : undefined;
};

export const setExpectedSize = async (
  tenantId: TenantId,
  engagementId: string,
  teamId: string,
  size: number | null,
): Promise<boolean> =>
  withTenant(tenantId, async (client) => {
    const res = await client.query(
      `UPDATE team_addresses SET expected_size = $4
        WHERE tenant_id = $1 AND engagement_id = $2 AND team_id = $3`,
      [tenantId, engagementId, teamId, size],
    );
    return (res.rowCount ?? 0) > 0;
  });

export type OpenResult =
  | { kind: 'ok'; token: string; created: boolean }
  | { kind: 'closed' }
  | { kind: 'unknown' };

/** Cookie holding this browser's invitation token for one address. Scoped to `/s/`. */
export const addressCookieName = (slug: string): string => `evolai_r_${slug}`;

/**
 * Resolve an address to the visitor's invitation. A valid cookie token of the same team is reused
 * (the same browser keeps its answers); otherwise a new anonymous invitation is created. A closed
 * mission is "closed", an unknown slug is "unknown"; neither reveals anything else.
 */
export const openByAddress = async (
  slug: string,
  cookieToken: string | null,
  now: Date = new Date(),
): Promise<OpenResult> => {
  if (!isValidSlug(slug)) return { kind: 'unknown' };
  return withServiceAccount(async (client) => {
    const found = await client.query<{
      tenant_id: string;
      engagement_id: string;
      team_id: string;
      status: string;
      closes_at: Date | string | null;
    }>(
      `SELECT a.tenant_id, a.engagement_id, a.team_id, e.status, e.closes_at
         FROM team_addresses a JOIN engagements e ON e.id = a.engagement_id
        WHERE a.slug = $1`,
      [slug],
    );
    const addr = found.rows[0];
    if (!addr) return { kind: 'unknown' as const };

    if (cookieToken) {
      try {
        const { reference } = verifyInviteToken(cookieToken);
        const own = await client.query(
          `SELECT 1 FROM invitations
            WHERE token_reference = $1 AND engagement_id = $2 AND team_id = $3`,
          [reference, addr.engagement_id, addr.team_id],
        );
        if ((own.rowCount ?? 0) > 0) {
          return { kind: 'ok' as const, token: cookieToken, created: false };
        }
      } catch (err) {
        if (!(err instanceof InvalidInviteToken)) throw err;
      }
    }

    if (!OPENABLE.has(addr.status)) return { kind: 'closed' as const };
    const closes = addr.closes_at ? new Date(addr.closes_at) : now;
    const expires = new Date(
      Math.max(closes.getTime(), now.getTime()) + LINK_DAYS_AFTER_CLOSE * 86_400_000,
    );
    const reference = `i${randomBytes(18).toString('base64url')}`;
    const token = signInviteToken(reference);
    await client.query(
      `INSERT INTO invitations (id, tenant_id, engagement_id, team_id, respondent_pseudonym,
                                status, token_reference, token_signature, opens_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'opened', $6, $7, $8, $9)`,
      [
        randomUUID(),
        addr.tenant_id,
        addr.engagement_id,
        addr.team_id,
        `p-${randomBytes(8).toString('hex')}`,
        reference,
        token.split('.')[1],
        now,
        expires,
      ],
    );
    return { kind: 'ok' as const, token, created: true };
  });
};

/** Absolute team address for a base URL. */
export const addressUrl = (baseUrl: string, slug: string): string =>
  `${baseUrl.replace(/\/+$/, '')}/s/${slug}`;
