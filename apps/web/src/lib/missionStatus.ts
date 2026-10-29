import type { Engagement } from '@evolai/contracts';
import { MIN_GROUP_SIZE } from './invitationTracking';

/**
 * Mission status and the one next step (TASK-AD2, ADR 0049). Four words for the consultant, derived
 * from the engagement status and whether a report is published; one next step per mission, so the
 * missions list and the mission header always offer exactly one action.
 */
export type MissionStatus = 'draft' | 'open' | 'closed' | 'published';

export type NextStep = 'createLinks' | 'followAnswers' | 'readBrief' | 'writeReport';

/** Mission tab a next step opens. */
export type MissionTab = 'overview' | 'invitations' | 'answers' | 'visit' | 'report' | 'settings';

export interface MissionFacts {
  readonly status: Engagement['status'];
  readonly reportPublished: boolean;
  /** Links created and not revoked. */
  readonly links: number;
  readonly submitted: number;
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
      if (f.links === 0) return { step: 'createLinks', tab: 'invitations' };
      return f.submitted >= MIN_GROUP_SIZE
        ? { step: 'readBrief', tab: 'overview' }
        : { step: 'followAnswers', tab: 'invitations' };
    default:
      return { step: 'writeReport', tab: 'report' };
  }
};

/** Path of a mission tab, keeping the organisation. */
export const missionHref = (engagementId: string, tab: MissionTab, tenantId: string): string =>
  `/admin/engagements/${engagementId}${tab === 'overview' ? '' : `/${tab}`}?tenant=${encodeURIComponent(tenantId)}`;
