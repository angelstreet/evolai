import { describe, expect, it } from 'vitest';
import { isOpenDispute, isReportable } from './findingRules';

describe('finding rules (TASK-AJ A6, A8)', () => {
  it('reaches a report with enough people or with a visit note', () => {
    expect(isReportable({ people: 5, notes: 0 })).toBe(true);
    expect(isReportable({ people: 4, notes: 0 })).toBe(false);
    expect(isReportable({ people: 0, notes: 1 })).toBe(true);
  });

  it('blocks publishing only on an approved finding with an unanswered dispute', () => {
    const review = (resolution: string | null) => ({ verdict: 'disputed', resolution });
    expect(isOpenDispute({ status: 'approved', review: review(null) })).toBe(true);
    expect(isOpenDispute({ status: 'approved', review: review('kept') })).toBe(false);
    expect(isOpenDispute({ status: 'rejected', review: review(null) })).toBe(false);
    expect(
      isOpenDispute({ status: 'approved', review: { verdict: 'confirmed', resolution: null } }),
    ).toBe(false);
    expect(isOpenDispute({ status: 'approved', review: null })).toBe(false);
  });
});
