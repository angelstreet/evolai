import { describe, expect, it } from 'vitest';
import type { QuestionItem } from '@evolai/contracts';
import { READINESS_RUBRIC, scoreReadinessAnswers, type CodedAnswer } from './readinessRubric.js';

const item = (axis: string, weight: number, values: string[]): QuestionItem =>
  ({
    axis,
    kind: 'single_choice',
    options: values.map((value) => ({ value, label: value })),
    scoring: { weight, reverse: false },
  }) as unknown as QuestionItem;

const answer = (code: string, choice: string, it = item('context', 0, [])): CodedAnswer => ({
  code,
  value: { kind: 'single_choice', choice },
  item: it,
});

describe('readiness rubric (ADR 0061)', () => {
  it('scores Knowledge, Use and Conditions from the questions already asked', () => {
    const axes = scoreReadinessAnswers([
      answer('v1_source_check', 'check_source'),
      answer('v1_data_sharing', 'remove_names'),
      answer('v1_request_style', 'some_context'),
      answer('v2_task_tool', 'ai_assistant'),
      answer('v1_repeat_time', 'gt_6h'),
    ]);
    expect(axes['literacy']).toBeCloseTo(0.75);
    expect(axes['practice']).toBeCloseTo(0.75);
    expect(axes['readiness']).toBeCloseTo(0.5);
  });

  it('leaves "unsure" and "something else" out of the score', () => {
    const axes = scoreReadinessAnswers([
      answer('v2_task_tool', 'other'),
      answer('v1_repeat_time', 'unsure'),
    ]);
    expect(axes).toEqual({});
  });

  it('keeps the item scoring for codes outside the rubric', () => {
    const own = item('literacy', 1, ['low', 'mid', 'high']);
    const zero = item('practice', 0, ['a', 'b']);
    const axes = scoreReadinessAnswers([
      answer('x_custom', 'high', own),
      answer('x_text', 'b', zero),
    ]);
    expect(axes).toEqual({ literacy: 1 });
  });

  it('every score is in 0..1', () => {
    for (const entries of Object.values(READINESS_RUBRIC))
      for (const e of entries)
        for (const v of Object.values(e.scores)) expect(v >= 0 && v <= 1).toBe(true);
  });
});
