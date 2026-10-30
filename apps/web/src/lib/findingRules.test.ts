import { describe, expect, it } from 'vitest';
import { isOpenDispute, isReportable, REVIEW_MAX, reviewShortlist } from './findingRules';

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

  it('sends the picked findings to the referent, or picks up to seven without word themes', () => {
    const f = (id: string, over: Record<string, unknown> = {}) => ({
      id,
      status: 'approved' as const,
      source: 'rule' as const,
      ruleKey: `choice:${id}`,
      forReview: false,
      people: 6,
      notes: 0,
      review: null,
      ...over,
    });
    const many = Array.from({ length: 9 }, (_, i) => f(`c${i}`, { people: 6 + i }));
    const auto = reviewShortlist([
      ...many,
      f('word', { ruleKey: 'tag:writing_drafting', people: 20 }),
      f('visit', { source: 'auditor', ruleKey: null, people: 0, notes: 1 }),
      f('draft', { status: 'draft', people: 30 }),
    ]);
    expect(auto).toHaveLength(REVIEW_MAX);
    expect(auto[0]?.id).toBe('visit');
    expect(auto.map((x) => x.id)).not.toContain('word');
    const picked = reviewShortlist([...many, f('word', { ruleKey: 'tag:x', forReview: true })]);
    expect(picked.map((x) => x.id)).toEqual(['word']);
  });
});
