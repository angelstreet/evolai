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

/** At most this many findings go to the referent's review (ADR 0062). */
export const REVIEW_MAX = 7;

/** Can reach a report: enough people, or seen on the visit. */
export const isReportable = (
  f: Pick<FindingFacts, 'people' | 'notes'>,
  minPeople: number = MIN_GROUP_SIZE,
): boolean => f.people >= minPeople || f.notes > 0;

/** A dispute the auditor has not answered yet: publishing waits for it. */
export const isOpenDispute = (f: Pick<FindingFacts, 'status' | 'review'>): boolean =>
  f.status === 'approved' && f.review?.verdict === 'disputed' && f.review.resolution === null;

interface ShortlistFacts extends FindingFacts {
  readonly source: 'auditor' | 'rule';
  /** `tag:…` marks a keyword theme from the free texts. */
  readonly ruleKey: string | null;
  readonly forReview: boolean;
}

/**
 * The findings the referent reviews (ADR 0062): the ones the auditor picked, or, with none picked,
 * up to seven approved findings that can reach the report, written ones and visit ones first, then
 * most people. Keyword themes are left out: the referent cannot judge "a word comes up".
 */
export const reviewShortlist = <T extends ShortlistFacts>(
  findings: readonly T[],
  minPeople: number = MIN_GROUP_SIZE,
): T[] => {
  const approved = findings.filter((f) => f.status === 'approved' && isReportable(f, minPeople));
  const picked = approved.filter((f) => f.forReview);
  if (picked.length > 0) return picked.slice(0, REVIEW_MAX);
  const rank = (f: T) => (f.source === 'auditor' || f.notes > 0 ? 0 : 1);
  return approved
    .filter((f) => !f.ruleKey?.startsWith('tag:'))
    .sort((a, b) => rank(a) - rank(b) || b.people - a.people)
    .slice(0, REVIEW_MAX);
};
