import { describe, expect, it } from 'vitest';
import { isAllowedInput, parseAnswerValue } from './answerParser';
import {
  FREE_TEXT_MAX_LENGTH,
  SYNTHETIC_QUESTIONS,
  questionByIndex,
  surveyEstimatedMinutes,
  totalQuestionCount,
} from './syntheticTemplate';

describe('survey template (questionnaire v2)', () => {
  it('has fourteen questions in a fixed order: six choices, the repeated task and its inventory, two free-text, one role', () => {
    expect(totalQuestionCount()).toBe(14);
    expect(SYNTHETIC_QUESTIONS.map((q) => q.kind)).toEqual([
      ...Array<string>(6).fill('scenario_choice'),
      'short_text',
      ...Array<string>(4).fill('single_choice'),
      ...Array<string>(2).fill('short_text'),
      'single_choice',
    ]);
    expect(surveyEstimatedMinutes()).toBeGreaterThanOrEqual(6);
    expect(surveyEstimatedMinutes()).toBeLessThanOrEqual(8);
  });

  it('has French and English text for every question', () => {
    for (const q of SYNTHETIC_QUESTIONS) {
      expect(q.prompt.fr).not.toBe(q.prompt.en);
      for (const o of q.options) expect(o.label.fr.length).toBeGreaterThan(0);
    }
  });

  it('throws for an index outside the survey', () => {
    expect(() => questionByIndex(14)).toThrow();
  });
});

describe('parseAnswerValue', () => {
  it('stores a choice by kind', () => {
    expect(parseAnswerValue('scenario_choice', 'unsure')).toEqual({
      kind: 'scenario_choice',
      choice: 'unsure',
      rationale: null,
    });
    expect(parseAnswerValue('single_choice', 'other')).toEqual({
      kind: 'single_choice',
      choice: 'other',
    });
  });

  it('stores trimmed free text and refuses empty text', () => {
    expect(parseAnswerValue('short_text', '  à la main  ')).toEqual({
      kind: 'short_text',
      text: 'à la main',
    });
    expect(() => parseAnswerValue('short_text', '   ')).toThrow();
  });
});

describe('isAllowedInput', () => {
  it('accepts only the question’s own option values for a choice', () => {
    expect(isAllowedInput(questionByIndex(0), 'check_source')).toBe(true);
    expect(isAllowedInput(questionByIndex(0), 'verify_source')).toBe(false);
    expect(isAllowedInput(questionByIndex(13), 'operations')).toBe(true);
    expect(isAllowedInput(questionByIndex(7), 'daily')).toBe(true);
  });
  it('accepts text of 1 to 400 characters for a free-text question, and nothing else', () => {
    const q = questionByIndex(6);
    expect(isAllowedInput(q, 'anything')).toBe(true);
    expect(isAllowedInput(q, 'x'.repeat(FREE_TEXT_MAX_LENGTH))).toBe(true);
    expect(isAllowedInput(q, 'x'.repeat(FREE_TEXT_MAX_LENGTH + 1))).toBe(false);
    expect(isAllowedInput(q, '   ')).toBe(false);
  });
});
