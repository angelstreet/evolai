import { describe, expect, it } from 'vitest';
import { auditFacts, type QualityInputs } from './auditQualityFacts';
import type { StepRow } from './reportModel';

const step = (over: Partial<StepRow>): StepRow => ({
  id: 's',
  opportunityId: 'o',
  catalogueId: null,
  source: 'rule',
  status: 'accepted',
  category: 'simplify',
  title: 'T',
  description: 'D',
  effort: 'low',
  impact: 'high',
  risk: 'low',
  owner: 'Team lead',
  horizon: 'd30',
  prerequisites: [],
  tags: [],
  measure: null,
  ...over,
});

const inputs: QualityInputs = {
  expected: 10,
  answered: 8,
  minGroup: 5,
  readiness: { hiddenTeams: 0, overall: { axes: [{ axis: 'readiness', score: 40 }] } },
  visit: { interview: 1, observation: 0, workshop: 0 },
  timeShown: true,
  risksNote: ' ',
  findings: [
    {
      status: 'approved',
      source: 'rule',
      ruleKey: 'choice:a',
      forReview: false,
      people: 6,
      notes: 0,
      review: { verdict: 'confirmed', resolution: null },
    },
    {
      status: 'approved',
      source: 'auditor',
      ruleKey: null,
      forReview: false,
      people: 0,
      notes: 1,
      review: { verdict: 'disputed', resolution: null },
    },
    {
      status: 'approved',
      source: 'rule',
      ruleKey: 'tag:x',
      forReview: false,
      people: 3,
      notes: 0,
      review: { verdict: 'disputed', resolution: 'kept' },
    },
    {
      status: 'draft',
      source: 'rule',
      ruleKey: 'choice:b',
      forReview: false,
      people: 9,
      notes: 0,
      review: null,
    },
  ],
  steps: [
    step({
      measure: {
        baselineValue: 20,
        baselineUnit: 'min',
        baselineSource: 'x',
        followUpOn: '2027-01-01',
        day90Status: null,
      },
    }),
    step({ status: 'suggested' }),
  ],
};

describe('audit facts (ADR 0061)', () => {
  it('counts approved, reportable, reviewed and open disputes', () => {
    const f = auditFacts(inputs);
    expect(f.approvedFindings).toBe(3);
    expect(f.reportableFindings).toBe(2);
    // The shortlist leaves out the keyword theme and the finding under the minimum.
    expect(f.reviewAsked).toBe(2);
    expect(f.reviewedFindings).toBe(1);
    expect(f.openDisputes).toBe(1);
    expect(f.conditionsScored).toBe(true);
    expect(f.risksNote).toBe(false);
  });

  it('keeps accepted steps only, with their measure', () => {
    const f = auditFacts(inputs);
    expect(f.acceptedSteps).toHaveLength(1);
    expect(f.acceptedSteps[0]?.measured).toBe(true);
  });
});
