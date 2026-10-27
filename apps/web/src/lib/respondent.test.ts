import { describe, expect, it } from 'vitest';
import { estimatedMinutes, firstUnanswered, gateFor } from './respondent';

const now = new Date('2026-10-18T10:00:00Z');
const future = '2026-10-25T10:00:00.000Z';
const past = '2026-10-10T10:00:00.000Z';

describe('gateFor', () => {
  it('lets an open invitation through', () => {
    expect(gateFor({ status: 'pending', expiresAt: future }, now)).toBe('ok');
    expect(gateFor({ status: 'in_progress', expiresAt: future }, now)).toBe('ok');
  });
  it('blocks an expired invitation, by date or by status', () => {
    expect(gateFor({ status: 'pending', expiresAt: past }, now)).toBe('expired');
    expect(gateFor({ status: 'expired', expiresAt: future }, now)).toBe('expired');
  });
  it('blocks a revoked or declined invitation', () => {
    expect(gateFor({ status: 'revoked', expiresAt: future }, now)).toBe('withdrawn');
    expect(gateFor({ status: 'declined', expiresAt: future }, now)).toBe('withdrawn');
  });
  it('keeps the status view readable after a submitted invitation expires', () => {
    expect(gateFor({ status: 'submitted', expiresAt: past }, now)).toBe('ok');
  });
});

describe('firstUnanswered', () => {
  const a = { questionId: 'q', value: { kind: 'scenario_choice', choice: 'x', rationale: null } };
  it('returns the first gap, or total when complete', () => {
    expect(firstUnanswered({}, 3)).toBe(0);
    expect(firstUnanswered({ 0: a, 2: a } as never, 3)).toBe(1);
    expect(firstUnanswered({ 0: a, 1: a, 2: a } as never, 3)).toBe(3);
  });
});

describe('estimatedMinutes', () => {
  it('rounds up at 20 s per question, minimum one minute', () => {
    expect(estimatedMinutes(1)).toBe(1);
    expect(estimatedMinutes(6)).toBe(2);
    expect(estimatedMinutes(7)).toBe(3);
  });
});
