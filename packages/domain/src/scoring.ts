import { UNSURE_VALUE, type Answer, type QuestionItem, type AnswerValue } from '@evolai/contracts';

/**
 * Deterministic literacy scoring (PRD \u00a76).
 *
 * Closed questions are scored without an LLM. Free-text questions return `null` for the
 * numeric contribution \u2014 narrative scoring (when added in Phase 2) is a separate signal that
 * requires human review (PRD \u00a76.1).
 *
 * The function is total: it never throws and never returns NaN. Items whose option mapping is
 * missing contribute zero \u2014 the caller decides whether that is the desired behaviour.
 */

export interface AxisScore {
  readonly axis: QuestionItem['axis'];
  /** Sum of weighted scores, clamped to [0, 1]. */
  readonly normalised: number;
  /** Count of items that contributed a numeric score. */
  readonly scoredItems: number;
  /** Count of items that contributed no numeric score (e.g. short_text without a rubric). */
  readonly skippedItems: number;
}

export interface ScoringResult {
  readonly byAxis: ReadonlyMap<QuestionItem['axis'], AxisScore>;
  /** True when no answers were provided. */
  readonly empty: boolean;
}

/**
 * `scoreOption` maps an answer to a single option's contribution in [0, 1].
 *
 * The mapping is intentionally simple: the rubric lives in the question item (PRD \u00a76.1).
 * Multi-choice answers use the *mean* of their option scores; this rewards breadth without
 * overcounting.
 */
export const scoreOption = (value: AnswerValue, item: QuestionItem): number | null => {
  // "I don't know / It depends" is an honest answer, not a low one: it is left out of the
  // ordering and of the score (TASK-Z2).
  const options = item.options.filter((o) => o.value !== UNSURE_VALUE);
  if (options.length === 0) return null;

  switch (value.kind) {
    case 'single_choice':
    case 'scenario_choice': {
      const idx = options.findIndex((o) => o.value === value.choice);
      if (idx < 0) return null;
      // Options are scored in order: index 0 \u2192 lowest contribution, last index \u2192 highest.
      const score = idx / (options.length - 1 || 1);
      return item.scoring.reverse ? 1 - score : score;
    }
    case 'multi_choice': {
      const indices = value.choices
        .map((c) => options.findIndex((o) => o.value === c))
        .filter((i) => i >= 0);
      if (indices.length === 0) return null;
      const sum = indices.reduce((acc, i) => acc + i / (options.length - 1 || 1), 0);
      const mean = sum / indices.length;
      return item.scoring.reverse ? 1 - mean : mean;
    }
    case 'boolean': {
      return value.value ? 1 : 0;
    }
    case 'scale_5': {
      const normalised = (value.value - 1) / 4;
      return item.scoring.reverse ? 1 - normalised : normalised;
    }
    case 'skipped':
    case 'short_text': {
      return null; // AI scoring lives in Phase 2.
    }
  }
};

/**
 * Compute the deterministic axis scores for a single submission. Caller passes the question items
 * keyed by id so we can apply each item's rubric.
 */
export const scoreSubmission = (
  answers: ReadonlyArray<Answer>,
  itemsById: ReadonlyMap<string, QuestionItem>,
): ScoringResult => {
  const accumulator = new Map<
    QuestionItem['axis'],
    { sum: number; count: number; skipped: number; weight: number }
  >();

  for (const answer of answers) {
    const item = itemsById.get(answer.questionItemId);
    if (!item) continue;
    const optionScore = scoreOption(answer.value, item);
    // Weight 0 keeps the answer out of the score (the contract's rule), like free text (TASK-AJ A4).
    const weighted =
      optionScore === null || item.scoring.weight === 0 ? null : optionScore * item.scoring.weight;

    const entry = accumulator.get(item.axis) ?? { sum: 0, count: 0, skipped: 0, weight: 0 };
    if (weighted === null) {
      entry.skipped += 1;
    } else {
      entry.sum += weighted;
      entry.count += 1;
      entry.weight += item.scoring.weight;
    }
    accumulator.set(item.axis, entry);
  }

  const byAxis = new Map<QuestionItem['axis'], AxisScore>();
  for (const [axis, entry] of accumulator) {
    // Only scored answers count: "I don't know" and free text neither raise nor lower the score.
    const totalWeight = entry.weight;
    const normalised = totalWeight === 0 ? 0 : Math.min(1, entry.sum / totalWeight);
    byAxis.set(axis, { axis, normalised, scoredItems: entry.count, skippedItems: entry.skipped });
  }

  return { byAxis, empty: answers.length === 0 };
};
