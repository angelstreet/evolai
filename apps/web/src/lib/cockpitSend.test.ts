import { describe, expect, it } from 'vitest';
import { toInputs } from './cockpitSend';
import { SYNTHETIC_QUESTIONS } from './syntheticTemplate';

describe('toInputs (front page answers to survey inputs)', () => {
  it('maps an option index to its value, keeps words, and skips what is missing or out of range', () => {
    const [choice, text] = [
      SYNTHETIC_QUESTIONS.findIndex((q) => q.kind !== 'short_text'),
      SYNTHETIC_QUESTIONS.findIndex((q) => q.kind === 'short_text'),
    ];
    const c = SYNTHETIC_QUESTIONS[choice];
    const tq = SYNTHETIC_QUESTIONS[text];
    if (!c || !tq || c.kind === 'short_text') throw new Error('template changed');
    const inputs = toInputs({ [c.code]: 1, [tq.code]: '  Copying orders by hand  ' });
    expect(inputs[choice]).toBe(c.options[1]?.value);
    expect(inputs[text]).toBe('Copying orders by hand');
    expect(inputs.filter((v) => v !== null)).toHaveLength(2);
    expect(toInputs({ [c.code]: 99, [tq.code]: '   ' })).toEqual(
      SYNTHETIC_QUESTIONS.map(() => null),
    );
  });
});
