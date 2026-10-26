import type { TenantId } from '@evolai/contracts';
import { aggregateFindings } from '@evolai/domain';
import { withTenant } from './db';
import { teamCounts } from './invitationData';
import { MIN_GROUP_SIZE, parseReminderDays } from './invitationTracking';
import { parseContact, referentParticipation, type Participation } from './referentView';

/**
 * Data for the client surface (TASK-P, ADR 0035). Every query runs under `withTenant` with the
 * tenant and teams taken from the session's effective context, never from the URL, so a guessed
 * id from another tenant or team returns nothing (row-level security plus explicit filters).
 *
 * What a team referent may see (PRD §4.3, §15): counts for their own teams (with the minimum
 * group and minimum answered rules), every link of their team with no status, and what the
 * auditor approved. Never an answer, never an individual result, never a per-link status: the
 * referent knows which link went to whom (ADR 0039).
 */

export interface ClientSurvey {
  readonly engagementId: string;
  /** Engagement label: the template name ("Pilot ..."). */
  readonly name: string;
  readonly status: string;
  readonly teams: readonly { id: string; name: string }[];
  /** Closing day (ISO), or null when the auditor has not set one. */
  readonly closesOn: string | null;
  /** Contact person for the messages, as configured by the auditor, or null. */
  readonly contact: string | null;
  /** Reminder schedule (days after the first link), used when there is no closing date. */
  readonly reminderDays: readonly number[];
}

/** Most recent non-archived engagement that includes one of the referent's teams. */
export const loadClientSurvey = async (
  tenantId: string,
  teamIds: readonly string[],
): Promise<ClientSurvey | null> =>
  withTenant(tenantId as TenantId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      name: string;
      status: string;
      closes_on: string | null;
      privacy_json: Record<string, unknown>;
    }>(
      `SELECT e.id, tp.name, e.status, e.privacy_json,
              to_char(e.closes_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS closes_on
         FROM engagements e
         JOIN templates tp ON tp.id = e.template_id
        WHERE e.tenant_id = $1 AND e.status <> 'archived'
          AND EXISTS (SELECT 1 FROM engagement_teams et
                       WHERE et.engagement_id = e.id AND et.team_id = ANY($2::uuid[]))
        ORDER BY e.created_at DESC, e.id
        LIMIT 1`,
      [tenantId, teamIds],
    );
    const row = rows[0];
    if (!row) return null;
    const teams = await client.query<{ id: string; name: string }>(
      `SELECT t.id, t.name FROM engagement_teams et JOIN teams t ON t.id = et.team_id
        WHERE et.tenant_id = $1 AND et.engagement_id = $2 AND et.team_id = ANY($3::uuid[])
        ORDER BY t.name`,
      [tenantId, row.id, teamIds],
    );
    return {
      engagementId: row.id,
      name: row.name,
      status: row.status,
      teams: teams.rows,
      closesOn: row.closes_on,
      contact: parseContact(row.privacy_json['contact']),
      reminderDays: parseReminderDays(row.privacy_json['reminderDays']),
    };
  });

/** Names of the referent's teams, for titles, even before any survey exists. */
export const loadTeamNames = async (
  tenantId: string,
  teamIds: readonly string[],
): Promise<string[]> =>
  withTenant(tenantId as TenantId, async (client) => {
    const { rows } = await client.query<{ name: string }>(
      `SELECT name FROM teams WHERE tenant_id = $1 AND id = ANY($2::uuid[]) ORDER BY name`,
      [tenantId, teamIds],
    );
    return rows.map((r) => r.name);
  });

/**
 * Participation of the referent's teams, one row per team of the survey (a team nobody has opened
 * yet shows 0). Raw counts stay in this function: only what `referentParticipation` allows
 * leaves it.
 */
export const referentProgress = async (
  tenantId: string,
  survey: Pick<ClientSurvey, 'engagementId' | 'teams'>,
  teamIds: readonly string[],
  expectedSize: ReadonlyMap<string, number | null> = new Map(),
): Promise<Participation[]> => {
  const counts = await teamCounts(tenantId as TenantId, survey.engagementId);
  return survey.teams
    .filter((team) => teamIds.includes(team.id))
    .map((team) => {
      const c = counts.find((r) => r.teamId === team.id);
      // M of "N of M answered" (TASK-AF): the size the referent stated, never below the number of
      // people who opened the team address, so the line cannot read "14 of 12".
      const visitors = c?.invited ?? 0;
      return referentParticipation({
        teamId: team.id,
        teamName: team.name,
        invited: Math.max(expectedSize.get(team.id) ?? 0, visitors),
        started: c?.started ?? 0,
        completed: c?.completed ?? 0,
      });
    });
};

/** Day the first link of the referent's teams was created (ISO), or null: anchors reminders. */
export const firstLinkOn = async (
  tenantId: string,
  engagementId: string,
  teamIds: readonly string[],
): Promise<string | null> =>
  withTenant(tenantId as TenantId, async (client) => {
    const { rows } = await client.query<{ first_on: string | null }>(
      `SELECT to_char(MIN(created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS first_on
         FROM invitations
        WHERE tenant_id = $1 AND engagement_id = $2 AND team_id = ANY($3::uuid[])
          AND status <> 'revoked'`,
      [tenantId, engagementId, teamIds],
    );
    return rows[0]?.first_on ?? null;
  });

/** Earliest expiry day (ISO) among the referent's links still waiting for an answer, or null. */
export const earliestLinkExpiryOn = async (
  tenantId: string,
  engagementId: string,
  teamIds: readonly string[],
): Promise<string | null> =>
  withTenant(tenantId as TenantId, async (client) => {
    const { rows } = await client.query<{ first_on: string | null }>(
      `SELECT to_char(MIN(expires_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS first_on
         FROM invitations
        WHERE tenant_id = $1 AND engagement_id = $2 AND team_id = ANY($3::uuid[])
          AND status IN ('pending','opened','in_progress')`,
      [tenantId, engagementId, teamIds],
    );
    return rows[0]?.first_on ?? null;
  });

export interface PublishedTheme {
  readonly axis: string;
  readonly label: string;
  readonly people: number;
}

export interface PublishedOpportunity {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly axis: string | null;
}

export interface PublishedResults {
  readonly themes: readonly PublishedTheme[];
  readonly opportunities: readonly PublishedOpportunity[];
}

const PUBLISHED_OPPORTUNITY = ['approved', 'in_progress', 'delivered'];

/** Pure aggregation of approved analyses into themes (shared rule, `@evolai/domain`). */
export const aggregateThemes = (
  analyses: readonly { submissionId: string; payload: unknown }[],
  minPeople: number = MIN_GROUP_SIZE,
): PublishedTheme[] => aggregateFindings(analyses, minPeople);

/** Only what the auditor approved: approved analyses (aggregated) and published opportunities. */
export const loadPublishedResults = async (
  tenantId: string,
  engagementId: string,
): Promise<PublishedResults> =>
  withTenant(tenantId as TenantId, async (client) => {
    const analyses = await client.query<{ submission_id: string; payload_json: unknown }>(
      `SELECT submission_id, payload_json FROM analyses
        WHERE tenant_id = $1 AND engagement_id = $2 AND approved_at IS NOT NULL`,
      [tenantId, engagementId],
    );
    const opps = await client.query<{
      id: string;
      title: string;
      status: string;
      axis: string | null;
    }>(
      `SELECT id, title, status, axis FROM opportunities
        WHERE tenant_id = $1 AND engagement_id = $2 AND status = ANY($3::text[])
        ORDER BY created_at, id`,
      [tenantId, engagementId, PUBLISHED_OPPORTUNITY],
    );
    return {
      themes: aggregateThemes(
        analyses.rows.map((r) => ({ submissionId: r.submission_id, payload: r.payload_json })),
      ),
      opportunities: opps.rows,
    };
  });

/**
 * Has anybody of the referent's teams submitted? A yes or a no only, never a count: the space
 * shows the "learn the audit" nudge while the answer is no (TASK-AF).
 */
export const anyAnswerSubmitted = async (
  tenantId: string,
  engagementId: string,
  teamIds: readonly string[],
): Promise<boolean> =>
  withTenant(tenantId as TenantId, async (client) => {
    const { rows } = await client.query(
      `SELECT 1 FROM invitations
        WHERE tenant_id = $1 AND engagement_id = $2 AND team_id = ANY($3::uuid[])
          AND status = 'submitted' LIMIT 1`,
      [tenantId, engagementId, teamIds],
    );
    return rows.length > 0;
  });
