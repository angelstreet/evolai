import type { Engagement, MissionShape } from '@evolai/contracts';
import { MIN_GROUP_SIZE } from './invitationTracking';

/**
 * Mission status and the one next step (TASK-AD2, ADR 0049). Four words for the consultant, derived
 * from the engagement status and whether a report is published; one next step per mission, so the
 * missions list and the mission header always offer exactly one action.
 */
export type MissionStatus = 'draft' | 'open' | 'closed' | 'published';

export type NextStep =
  | 'createLinks'
  | 'followAnswers'
  | 'readBrief'
  | 'runInterviews'
  | 'writeReport';

/** Mission tab a next step opens. */
export type MissionTab = 'overview' | 'invitations' | 'answers' | 'visit' | 'report' | 'settings';

export interface MissionFacts {
  readonly status: Engagement['status'];
  readonly reportPublished: boolean;
  /** Links created and not revoked. */
  readonly links: number;
  readonly submitted: number;
  /** Kind and mode (ADR 0065); absent means a team survey. */
  readonly shape?: MissionShape;
}

export const missionStatus = (
  f: Pick<MissionFacts, 'status' | 'reportPublished'>,
): MissionStatus => {
  if (f.reportPublished) return 'published';
  switch (f.status) {
    case 'draft':
    case 'scheduled':
      return 'draft';
    case 'in_field':
      return 'open';
    default:
      return 'closed';
  }
};

/**
 * The single next step. A draft mission is launched from Settings before links exist, so its
 * "Create links" opens Settings; an open mission without links opens Invitations.
 */
export const nextStep = (f: MissionFacts): { step: NextStep; tab: MissionTab } => {
  switch (missionStatus(f)) {
    case 'draft':
      return { step: 'createLinks', tab: 'settings' };
    case 'open':
      if (f.shape?.mode === 'interview') return { step: 'runInterviews', tab: 'visit' };
      if (f.links === 0) return { step: 'createLinks', tab: 'invitations' };
      return f.submitted >= MIN_GROUP_SIZE
        ? { step: 'readBrief', tab: 'overview' }
        : { step: 'followAnswers', tab: 'invitations' };
    default:
      return { step: 'writeReport', tab: 'report' };
  }
};

/**
 * Tabs of a mission (ADR 0065). A team survey has them all. A team interview has no links to send,
 * so no Team tab. A governance audit has no team answers either: overview, visit notes, report,
 * settings.
 */
export const missionTabs = (shape: MissionShape): readonly MissionTab[] => {
  if (shape.kind === 'governance') return ['overview', 'visit', 'report', 'settings'];
  if (shape.mode === 'interview') return ['overview', 'answers', 'visit', 'report', 'settings'];
  return ['overview', 'invitations', 'answers', 'visit', 'report', 'settings'];
};

/** Message key of the kind-and-mode label shown in the mission header and settings. */
export const missionShapeKey = (
  shape: MissionShape,
):
  | 'admin.missions.shape.team.interview'
  | 'admin.missions.shape.team.survey'
  | 'admin.missions.shape.governance.interview' =>
  shape.kind === 'governance'
    ? 'admin.missions.shape.governance.interview'
    : shape.mode === 'interview'
      ? 'admin.missions.shape.team.interview'
      : 'admin.missions.shape.team.survey';

/** Path of a mission tab, keeping the organisation. */
export const missionHref = (engagementId: string, tab: MissionTab, tenantId: string): string =>
  `/admin/engagements/${engagementId}${tab === 'overview' ? '' : `/${tab}`}?tenant=${encodeURIComponent(tenantId)}`;
