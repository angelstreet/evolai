import type { AnswerValue, QuestionItem, ReadinessAxis } from '@evolai/contracts';
import { scoreOption } from './scoring.js';

/**
 * Readiness rubric by question code (ADR 0061). The v2 survey scored Knowledge only, so every
 * report said "No answer" for Use and Conditions. These questions were already asked; the rubric
 * gives them a score without adding a question. It lives in code, keyed by code (codes are never
 * reused), so it applies to answers already given and to every tenant at once; published reports
 * are snapshots and do not change.
 *
 * One answer may feed two axes (the main tool says how far AI is used and how well the work is
 * tooled). Values left out of a map are not scored, like "unsure".
 */
export interface RubricEntry {
  readonly axis: ReadinessAxis;
  readonly scores: Readonly<Record<string, number>>;
}

export const READINESS_RUBRIC: Readonly<Record<string, readonly RubricEntry[]>> = {
  // Knowledge: what AI does well and badly, and how to check it.
  v1_source_check: [{ axis: 'literacy', scores: { use_as_is: 0, reread: 0.5, check_source: 1 } }],
  v1_data_sharing: [
    { axis: 'literacy', scores: { paste_directly: 0, remove_names: 0.5, check_rules: 1 } },
  ],
  v1_repeat_data: [{ axis: 'literacy', scores: { ai_assistant: 0, simple_automation: 1 } }],
  // Use: how often and how well AI is used at work.
  v1_request_style: [
    { axis: 'practice', scores: { one_line: 0, some_context: 0.5, full_brief: 1 } },
  ],
  v2_task_tool: [
    {
      axis: 'practice',
      scores: { ai_assistant: 1, spreadsheet: 0, email: 0, business_app: 0, paper: 0 },
    },
    // Conditions: tools, data, rules and support in place.
    {
      axis: 'readiness',
      scores: { paper: 0, email: 0.25, spreadsheet: 0.5, business_app: 1, ai_assistant: 1 },
    },
  ],
  v1_repeat_time: [
    { axis: 'readiness', scores: { gt_6h: 0, '3_6h': 1 / 3, '1_3h': 2 / 3, lt_1h: 1 } },
  ],
};

/** One answer with its question: the code picks the rubric, the item is the fallback. */
export interface CodedAnswer {
  readonly code: string;
  readonly value: AnswerValue;
  readonly item: QuestionItem;
}

/**
 * One person's axis scores in 0..1: the weighted mean of their scored answers per axis. Codes in
 * the rubric use it (weight 1); other codes keep the item's own scoring (weight 0 = not scored).
 * An axis with no scored answer is absent.
 */
export const scoreReadinessAnswers = (
  answers: readonly CodedAnswer[],
): Partial<Record<string, number>> => {
  const acc = new Map<string, { sum: number; weight: number }>();
  const add = (axis: string, score: number, weight: number) => {
    const e = acc.get(axis) ?? { sum: 0, weight: 0 };
    e.sum += score * weight;
    e.weight += weight;
    acc.set(axis, e);
  };
  for (const a of answers) {
    const rubric = READINESS_RUBRIC[a.code];
    if (rubric) {
      if (a.value.kind !== 'single_choice' && a.value.kind !== 'scenario_choice') continue;
      const choice = a.value.choice;
      for (const entry of rubric) {
        const score = entry.scores[choice];
        if (typeof score === 'number') add(entry.axis, score, 1);
      }
      continue;
    }
    const score = scoreOption(a.value, a.item);
    if (score !== null && a.item.scoring.weight > 0) add(a.item.axis, score, a.item.scoring.weight);
  }
  const out: Partial<Record<string, number>> = {};
  for (const [axis, e] of acc) if (e.weight > 0) out[axis] = Math.min(1, e.sum / e.weight);
  return out;
};
