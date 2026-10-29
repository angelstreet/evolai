import { MIN_GROUP_SIZE } from './invitationTracking';

/**
 * Pure rules on a finding (TASK-AJ, ADR 0058 and 0059), shared by the data layer and the client
 * components (no database import here).
 */

interface FindingFacts {
  readonly status: 'draft' | 'approved' | 'rejected';
  readonly people: number;
  /** Visit notes it cites. */
  readonly notes: number;
  readonly review: { readonly verdict: string; readonly resolution: string | null } | null;
}

/** Can reach a report: enough people, or seen on the visit. */
export const isReportable = (
  f: Pick<FindingFacts, 'people' | 'notes'>,
  minPeople: number = MIN_GROUP_SIZE,
): boolean => f.people >= minPeople || f.notes > 0;

/** A dispute the auditor has not answered yet: publishing waits for it. */
export const isOpenDispute = (f: Pick<FindingFacts, 'status' | 'review'>): boolean =>
  f.status === 'approved' && f.review?.verdict === 'disputed' && f.review.resolution === null;
