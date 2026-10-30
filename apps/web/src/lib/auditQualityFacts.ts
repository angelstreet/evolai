import { auditQuality, type AuditFacts, type AuditQuality } from '@evolai/domain';
import { isOpenDispute, isReportable, reviewShortlist } from './findingRules';
import type { StepRow } from './reportModel';

/**
 * The facts the audit-quality score reads (PRD §29, ADR 0061), from what the report screen has
 * already loaded. Pure, so the screen and the tests share it.
 */
export interface QualityInputs {
  readonly expected: number;
  readonly answered: number;
  readonly minGroup: number;
  readonly readiness: {
    readonly hiddenTeams: number;
    readonly overall: {
      readonly axes: ReadonlyArray<{ axis: string; score: number | null }>;
    } | null;
  };
  readonly visit: Readonly<Record<'interview' | 'observation' | 'workshop', number>>;
  readonly timeShown: boolean;
  readonly risksNote: string;
  readonly findings: ReadonlyArray<{
    status: 'draft' | 'approved' | 'rejected';
    source: 'auditor' | 'rule';
    ruleKey: string | null;
    forReview: boolean;
    people: number;
    notes: number;
    review: { verdict: 'confirmed' | 'disputed'; resolution: 'corrected' | 'kept' | null } | null;
  }>;
  readonly steps: readonly StepRow[];
}

export const auditFacts = (i: QualityInputs): AuditFacts => {
  const approved = i.findings.filter((f) => f.status === 'approved');
  const asked = reviewShortlist(i.findings, i.minGroup);
  return {
    expected: i.expected,
    answered: i.answered,
    hiddenTeams: i.readiness.hiddenTeams,
    minGroup: i.minGroup,
    visit: i.visit,
    timeShown: i.timeShown,
    approvedFindings: approved.length,
    reportableFindings: approved.filter((f) => isReportable(f, i.minGroup)).length,
    reviewAsked: asked.length,
    reviewedFindings: asked.filter(
      (f) => f.review?.verdict === 'confirmed' || f.review?.resolution != null,
    ).length,
    openDisputes: i.findings.filter((f) => isOpenDispute(f)).length,
    conditionsScored:
      i.readiness.overall?.axes.some((a) => a.axis === 'readiness' && a.score !== null) ?? false,
    risksNote: i.risksNote.trim().length > 0,
    acceptedSteps: i.steps
      .filter((s) => s.status === 'accepted')
      .map((s) => ({
        category: s.category,
        impact: s.impact,
        risk: s.risk,
        owner: s.owner,
        prerequisites: s.prerequisites,
        measured: s.measure?.baselineValue != null && s.measure.followUpOn != null,
      })),
  };
};

export const qualityOf = (i: QualityInputs): AuditQuality => auditQuality(auditFacts(i));
