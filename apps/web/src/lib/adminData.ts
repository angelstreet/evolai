import {
  missionShape,
  type Engagement,
  type MissionShape,
  type Organisation,
  type TenantId,
} from '@evolai/contracts';
import { withServiceAccount } from './db';
import { invitationNumbers, type InvitationNumbers } from './invitationTracking';

/**
 * Admin queries backed by the M4 schema (PRD FR-01, FR-09, \u00a714).
 *
 * The summary joins \`engagements\` with the related \`organisations\` and the engagement's
 * invitations, computing completion counts. The RLS policies from M4 would normally hide rows
 * from other tenants; we run as a service account because the admin is the operator, not the
 * respondent. The page itself enforces tenant scoping on the rendered output.
 */

export interface AdminEngagementSummary {
  readonly engagement: Engagement;
  /** The auditor's own label for the engagement, or null (the page then shows the organisation). */
  readonly name: string | null;
  readonly organisation: Organisation;
  readonly expectedHeadcount: number;
  readonly invitations: InvitationNumbers;
  /** Links invited: created minus revoked (the same number as the Invitations page). */
  readonly invitationsTotal: number;
  readonly invitationsSubmitted: number;
  readonly invitationsOpened: number;
  readonly invitationsPending: number;
  readonly invitationsRevokedOrExpired: number;
  readonly completionRatio: number;
  /** Kind and mode (ADR 0065); a team survey before migration 0035. */
  readonly shape: MissionShape;
}

interface EngagementRow {
  id: string;
  name: string | null;
  tenant_id: string;
  team_ids: string[];
  template_id: string;
  questionnaire_version_id: string;
  status: string;
  opens_at: string | null;
  closes_at: string | null;
  locale: string;
  privacy_json: unknown;
  created_at: string;
  updated_at: string | null;
  org_id: string;
  org_legal_name: string;
  org_trading_name: string | null;
  org_country: string;
  org_sector: string | null;
  org_created_at: string;
  org_updated_at: string | null;
  expected_headcount: number;
  invitation_status: Record<string, number>;
  kind: string | null;
  mode: string | null;
}

export const listTenantIds = async (): Promise<readonly TenantId[]> => {
  return withServiceAccount(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `SELECT id FROM tenants ORDER BY display_name`,
    );
    return rows.map((r) => r.id as TenantId);
  });
};

export const tenantLabel = async (tenantId: TenantId): Promise<string> => {
  return withServiceAccount(async (client) => {
    const { rows } = await client.query<{ display_name: string }>(
      `SELECT display_name FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId],
    );
    const row = rows[0];
    if (!row) return tenantId;
    return row.display_name || tenantId;
  });
};

const toEngagement = (row: EngagementRow): Engagement => ({
  id: row.id as never,
  tenantId: row.tenant_id as TenantId,
  teamIds: row.team_ids as never,
  templateId: row.template_id as never,
  questionnaireVersionId: row.questionnaire_version_id as never,
  status: row.status as Engagement['status'],
  opensAt: row.opens_at,
  closesAt: row.closes_at,
  locale: row.locale === 'fr' ? 'fr' : 'en',
  privacy: row.privacy_json as Engagement['privacy'],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toOrganisation = (row: EngagementRow): Organisation => ({
  id: row.org_id as never,
  tenantId: row.tenant_id as TenantId,
  legalName: row.org_legal_name,
  tradingName: row.org_trading_name,
  country: row.org_country,
  sector: row.org_sector,
  createdAt: row.org_created_at,
  updatedAt: row.org_updated_at,
});

export const listEngagements = async (tenantId: TenantId): Promise<AdminEngagementSummary[]> => {
  return withServiceAccount(async (client) => {
    const { rows } = await client.query<EngagementRow>(
      `SELECT e.id, e.name, e.tenant_id,
              COALESCE(
                (SELECT array_agg(et.team_id) FROM engagement_teams et WHERE et.engagement_id = e.id),
                ARRAY[]::uuid[]
              ) AS team_ids,
              e.template_id, e.questionnaire_version_id,
              e.status, e.opens_at, e.closes_at, e.locale, e.privacy_json, e.created_at, e.updated_at,
              o.id AS org_id, o.legal_name AS org_legal_name, o.trading_name AS org_trading_name,
              o.country AS org_country, o.sector AS org_sector,
              o.created_at AS org_created_at, o.updated_at AS org_updated_at,
              COALESCE(
                (SELECT SUM(t.expected_headcount) FROM engagement_teams et
                  JOIN teams t ON t.id = et.team_id
                 WHERE et.engagement_id = e.id),
                0
              )::int AS expected_headcount,
              COALESCE(
                (SELECT jsonb_object_agg(s.status, s.n)
                   FROM (SELECT i.status, COUNT(*)::int AS n FROM invitations i
                          WHERE i.tenant_id = e.tenant_id AND i.engagement_id = e.id
                          GROUP BY i.status) s),
                '{}'::jsonb
              ) AS invitation_status,
              to_jsonb(e) ->> 'kind' AS kind, to_jsonb(e) ->> 'mode' AS mode
         FROM engagements e
         JOIN organisations o ON o.tenant_id = e.tenant_id
        WHERE e.tenant_id = $1
        ORDER BY e.created_at DESC`,
      [tenantId],
    );
    return rows.map((row) => summarise(row));
  });
};

const summarise = (row: EngagementRow): AdminEngagementSummary => {
  const inv = invitationNumbers(row.invitation_status);
  const submitted = inv.completed;
  const expected = Math.max(row.expected_headcount, 1);
  return {
    engagement: toEngagement(row),
    shape: missionShape(row.kind, row.mode),
    name: row.name,
    organisation: toOrganisation(row),
    expectedHeadcount: expected,
    invitations: inv,
    invitationsTotal: inv.invited,
    invitationsSubmitted: submitted,
    invitationsOpened: inv.opened,
    invitationsPending: inv.waiting,
    invitationsRevokedOrExpired: inv.revoked + inv.lapsed,
    completionRatio: Math.min(1, submitted / expected),
  };
};

export const engagementStatusLabel = (status: Engagement['status']): string => {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'scheduled':
      return 'Scheduled';
    case 'in_field':
      return 'In field';
    case 'analysis':
      return 'Analysis';
    case 'review':
      return 'Review';
    case 'closed':
      return 'Closed';
    case 'archived':
      return 'Archived';
  }
};
