import { describe, expect, it } from 'vitest';
import { estimateSaving, proposeUseCases, type UseCaseFinding } from './useCaseMatching.js';

const f = (id: string, o: Partial<UseCaseFinding>): UseCaseFinding => ({
  id,
  tags: [],
  ruleKey: null,
  people: 5,
  visit: false,
  ...o,
});

describe('proposeUseCases', () => {
  it('puts the client-data rule first, then task use cases by people', () => {
    const out = proposeUseCases([
      f('a', { tags: ['policy_unclear'], ruleKey: 'choice:v1_data_sharing', people: 7 }),
      f('b', { tags: ['cv_profiles'], ruleKey: 'tag:cv_profiles', people: 7 }),
      f('c', { tags: ['tender_response'], ruleKey: 'tag:tender_response', people: 9 }),
      f('d', { tags: ['cv_profiles'], visit: true, people: 0 }),
    ]);
    expect(out.map((u) => u.useCase.id)).toEqual([
      'uc.ai_data_charter',
      'uc.tender_drafting',
      'uc.cv_tailoring',
    ]);
    expect(out[2]!.findingIds).toEqual(['b', 'd']);
  });

  it('does not propose a task use case from choice answers alone', () => {
    const out = proposeUseCases([
      f('a', { tags: ['manual_reentry'], ruleKey: 'choice:v2_task_tool', people: 16 }),
      f('b', { tags: ['writing_drafting'], ruleKey: 'choice:v1_request_style', people: 8 }),
    ]);
    expect(out).toEqual([]);
  });

  it('keeps at most the limit', () => {
    const tags = [
      'cv_profiles',
      'tender_response',
      'timesheet_billing',
      'staffing',
      'recruiting',
      'reporting',
    ] as const;
    const out = proposeUseCases(
      tags.map((t, i) => f(String(i), { tags: [t], ruleKey: `tag:${t}` })),
      4,
    );
    expect(out).toHaveLength(4);
  });
});

describe('estimateSaving', () => {
  it('computes hours a week and the saved range, to the half hour', () => {
    const e = estimateSaving('uc.cv_tailoring', { volumePerWeek: 12, minutesPerUnit: 45 });
    expect(e.hoursPerWeek).toBe(9);
    expect(e.savedLow).toBe(3.5);
    expect(e.savedHigh).toBe(5.5);
    expect(e.ratesVersion).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('is empty until measured, and has no saving for rules', () => {
    expect(
      estimateSaving('uc.cv_tailoring', { volumePerWeek: null, minutesPerUnit: 45 }).hoursPerWeek,
    ).toBeNull();
    const rule = estimateSaving('uc.ai_data_charter', { volumePerWeek: 1, minutesPerUnit: 60 });
    expect(rule.savedLow).toBeNull();
  });
});
