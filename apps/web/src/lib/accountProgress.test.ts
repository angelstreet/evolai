import { describe, expect, it } from 'vitest';
import { EMPTY, cleanLessons, mergeProgress } from './accountProgress';

describe('account progress (ADR 0056)', () => {
  it('keeps lesson indexes 0..4 once each, sorted', () => {
    expect(cleanLessons([3, 1, 3, 9, -1, 1.5, '2', 0])).toEqual([0, 1, 3]);
  });

  it('merges as a union: nothing done is undone', () => {
    const a = { lessons: [0, 2], surveyDone: true, sent: false };
    const b = { lessons: [2, 4], surveyDone: false, sent: true };
    expect(mergeProgress(a, b)).toEqual({ lessons: [0, 2, 4], surveyDone: true, sent: true });
    expect(mergeProgress(a, EMPTY)).toEqual(a);
  });
});
