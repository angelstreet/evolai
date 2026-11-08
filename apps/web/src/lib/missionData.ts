import type { MissionShape, TenantId } from '@evolai/contracts';
import { listEngagements, type AdminEngagementSummary } from './adminData';
import { withServiceAccount } from './db';
import {
  missionStatus,
  nextStep,
  type MissionStatus,
  type MissionTab,
  type NextStep,
} from './missionStatus';

/** One row of the missions home (TASK-AD2): what the consultant needs to pick the next mission. */
export interface MissionRow {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly client: string;
  readonly name: string | null;
  readonly status: MissionStatus;
  readonly submitted: number;
  readonly expected: number;
  readonly closesAt: string | null;
  readonly next: { step: NextStep; tab: MissionTab };
  readonly shape: MissionShape;
}

/** Engagements of these organisations that have a published report version the client can see. */
const publishedEngagements = async (tenantIds: readonly string[]): Promise<Set<string>> => {
  if (tenantIds.length === 0) return new Set();
  return withServiceAccount(async (client) => {
    const { rows } = await client.query<{ engagement_id: string }>(
      `SELECT DISTINCT r.engagement_id FROM audit_reports r
         JOIN audit_report_versions v ON v.report_id = r.id AND v.unpublished_at IS NULL
        WHERE r.tenant_id = ANY ($1::uuid[])`,
      [tenantIds],
    );
    return new Set(rows.map((r) => r.engagement_id));
  });
};

export const toMissionRow = (s: AdminEngagementSummary, reportPublished: boolean): MissionRow => {
  const facts = {
    status: s.engagement.status,
    reportPublished,
    links: s.invitationsTotal,
    submitted: s.invitationsSubmitted,
    shape: s.shape,
  };
  return {
    id: s.engagement.id,
    tenantId: s.engagement.tenantId,
    client: s.organisation.tradingName ?? s.organisation.legalName,
    name: s.name,
    status: missionStatus(facts),
    submitted: s.invitationsSubmitted,
    expected: s.expectedHeadcount,
    closesAt: s.engagement.closesAt,
    next: nextStep(facts),
    shape: s.shape,
  };
};

/** Missions of the given organisations, archived ones left out, newest first per organisation. */
export const listMissions = async (tenantIds: readonly TenantId[]): Promise<MissionRow[]> => {
  const [lists, published] = await Promise.all([
    Promise.all(tenantIds.map((id) => listEngagements(id))),
    publishedEngagements(tenantIds),
  ]);
  return lists
    .flat()
    .filter((s) => s.engagement.status !== 'archived')
    .map((s) => toMissionRow(s, published.has(s.engagement.id)));
};

/** One mission of one organisation, or null. */
export const getMission = async (
  tenantId: TenantId,
  engagementId: string,
): Promise<MissionRow | null> => {
  const [list, published] = await Promise.all([
    listEngagements(tenantId),
    publishedEngagements([tenantId]),
  ]);
  const s = list.find((x) => x.engagement.id === engagementId);
  return s ? toMissionRow(s, published.has(s.engagement.id)) : null;
};

/** The mission and its organisation, looked up in the organisations the session may open. */
export const findMission = async (
  tenantIds: readonly TenantId[],
  engagementId: string,
): Promise<MissionRow | null> => {
  for (const tenantId of tenantIds) {
    const m = await getMission(tenantId, engagementId);
    if (m) return m;
  }
  return null;
};
