/**
 * Audit-quality score (PRD §29, ADR 0061): an internal check that the audit itself rests on enough
 * evidence before the client reads it. Seven dimensions scored 0..5 from what the app already
 * records, weighted as in the PRD; `Σ(weight × score / 5)` on 0..100. Not shown to the client and
 * not a certification.
 */

export const QUALITY_DIMENSIONS = [
  'coverage',
  'fidelity',
  'evidence',
  'practicality',
  'governance',
  'validation',
  'measurement',
] as const;
export type QualityDimension = (typeof QUALITY_DIMENSIONS)[number];

export const QUALITY_WEIGHTS: Readonly<Record<QualityDimension, number>> = {
  coverage: 0.15,
  fidelity: 0.2,
  evidence: 0.2,
  practicality: 0.15,
  governance: 0.1,
  validation: 0.1,
  measurement: 0.1,
};

export interface QualityStep {
  readonly category: string;
  readonly impact: 'low' | 'medium' | 'high';
  readonly risk: 'low' | 'medium' | 'high';
  readonly owner: string;
  readonly prerequisites: readonly string[];
  readonly measured: boolean;
}

export interface AuditFacts {
  /** People invited to answer (team headcounts); 0 when unknown. */
  readonly expected: number;
  readonly answered: number;
  readonly hiddenTeams: number;
  readonly minGroup: number;
  readonly visit: {
    readonly interview: number;
    readonly observation: number;
    readonly workshop: number;
  };
  /** The time-on-tasks figure is shown (enough inventory answers). */
  readonly timeShown: boolean;
  readonly approvedFindings: number;
  readonly reportableFindings: number;
  /** Findings sent to the referent's review (the shortlist, ADR 0062). */
  readonly reviewAsked: number;
  /** Of those, the ones the referent confirmed, or disputed and the auditor answered. */
  readonly reviewedFindings: number;
  readonly openDisputes: number;
  /** The Conditions axis of the readiness score has a value. */
  readonly conditionsScored: boolean;
  readonly risksNote: boolean;
  readonly acceptedSteps: readonly QualityStep[];
}

export type QualityGate = 'ready' | 'gaps' | 'discover' | 'unscored';
export type QualityNoGo = 'automation_without_owner' | 'open_dispute';

export interface AuditQuality {
  readonly score: number | null;
  readonly gate: QualityGate;
  readonly noGo: readonly QualityNoGo[];
  readonly dimensions: ReadonlyArray<{
    dimension: QualityDimension;
    score: number;
    weight: number;
  }>;
}

const clamp5 = (n: number) => Math.max(0, Math.min(5, Math.round(n * 10) / 10));
const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

const dimensionScore = (d: QualityDimension, f: AuditFacts): number => {
  const steps = f.acceptedSteps;
  switch (d) {
    case 'coverage': {
      // 70% answering is the pilot target (G1); a hidden team costs a point.
      const rate =
        f.expected > 0 ? share(f.answered, f.expected) : f.answered >= f.minGroup ? 0.5 : 0;
      return clamp5(5 * Math.min(1, rate / 0.7) - (f.hiddenTeams > 0 ? 1 : 0));
    }
    case 'fidelity':
      // The work seen, not only described: an observation or workshop counts twice.
      return clamp5(f.visit.interview + 2 * (f.visit.observation + f.visit.workshop));
    case 'evidence':
      return clamp5((f.timeShown ? 2 : 0) + 3 * share(f.reportableFindings, f.approvedFindings));
    case 'practicality':
      return clamp5(
        5 *
          share(
            steps.filter((s) => s.owner.trim() && s.prerequisites.length > 0).length,
            steps.length,
          ),
      );
    case 'governance': {
      const risky = steps.filter((s) => s.risk !== 'low');
      const covered =
        risky.length === 0
          ? steps.length > 0
            ? 1
            : 0
          : share(risky.filter((s) => s.prerequisites.length > 0).length, risky.length);
      return clamp5((f.risksNote ? 2 : 0) + 2 * covered + (f.conditionsScored ? 1 : 0));
    }
    case 'validation':
      return clamp5(5 * share(f.reviewedFindings, f.reviewAsked));
    case 'measurement':
      return clamp5(5 * share(steps.filter((s) => s.measured).length, steps.length));
  }
};

export const auditQuality = (f: AuditFacts): AuditQuality => {
  const dimensions = QUALITY_DIMENSIONS.map((dimension) => ({
    dimension,
    score: dimensionScore(dimension, f),
    weight: QUALITY_WEIGHTS[dimension],
  }));
  const noGo: QualityNoGo[] = [];
  if (
    f.acceptedSteps.some((s) => s.category === 'automate' && s.impact === 'high' && !s.owner.trim())
  )
    noGo.push('automation_without_owner');
  if (f.openDisputes > 0) noGo.push('open_dispute');
  // Without the minimum group of answers there is no evidence to grade.
  if (f.answered < f.minGroup) return { score: null, gate: 'unscored', noGo, dimensions };
  const score = Math.round(dimensions.reduce((s, d) => s + (d.weight * d.score) / 5, 0) * 100);
  const gate: QualityGate = score >= 80 ? 'ready' : score >= 60 ? 'gaps' : 'discover';
  return { score, gate, noGo, dimensions };
};
