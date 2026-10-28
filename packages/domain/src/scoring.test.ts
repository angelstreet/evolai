import { describe, expect, it } from 'vitest';
import { scoreSubmission } from './scoring.js';
import type { Answer, QuestionItem, QuestionItemId, TenantId } from '@evolai/contracts';
import { parseAnswerId, parseQuestionItemId, parseSubmissionId } from './ids.js';

const TENANT = '550e8400-e29b-41d4-a716-446655440000' as TenantId;
const SUB = parseSubmissionId('550e8400-e29b-41d4-a716-446655440001');
const ITEM_A = parseQuestionItemId('550e8400-e29b-41d4-a716-446655440010');
const ITEM_B = parseQuestionItemId('550e8400-e29b-41d4-a716-446655440011');
const ITEM_C = parseQuestionItemId('550e8400-e29b-41d4-a716-446655440012');
const ITEM_TEXT = parseQuestionItemId('550e8400-e29b-41d4-a716-446655440013');

const itemLiteracyA: QuestionItem = {
  id: ITEM_A,
  tenantId: TENANT,
  axis: 'literacy',
  code: 'verification_basics',
  kind: 'scenario_choice',
  locale: 'fr',
  prompt: 'Source checking',
  helper: null,
  options: [
    { value: 'use_it', label: 'Use it as-is' },
    { value: 'check_source', label: 'Verify against an authoritative source' },
  ],
  scoring: { weight: 1, reverse: false },
  sensitivity: 'internal',
  retestable: true,
  createdAt: '2026-10-14T19:00:00.000Z',
  updatedAt: null,
};

const itemLiteracyB: QuestionItem = {
  ...itemLiteracyA,
  id: ITEM_B,
  code: 'data_safety',
  prompt: 'Data safety',
  options: [
    { value: 'paste_anyway', label: 'Paste client records' },
    { value: 'check_policy', label: 'Check data classification policy' },
  ],
};

const itemPractice: QuestionItem = {
  ...itemLiteracyA,
  id: ITEM_C,
  axis: 'practice',
  code: 'frequency_of_use',
  prompt: 'Frequency of use',
};

const itemShortText: QuestionItem = {
  ...itemLiteracyA,
  id: ITEM_TEXT,
  axis: 'literacy',
  code: 'open_question',
  kind: 'short_text',
  options: [],
};

const items = new Map<string, QuestionItem>([
  [ITEM_A as unknown as string, itemLiteracyA],
  [ITEM_B as unknown as string, itemLiteracyB],
  [ITEM_C as unknown as string, itemPractice],
  [ITEM_TEXT as unknown as string, itemShortText],
]);

const makeAnswer = (
  questionItemId: QuestionItemId,
  value: Answer['value'],
  idSuffix: string,
): Answer => ({
  id: parseAnswerId(`550e8400-e29b-41d4-a716-44665544${idSuffix}`),
  tenantId: TENANT,
  submissionId: SUB,
  questionItemId,
  value,
  confidence: 4,
  rationale: null,
  durationMs: null,
  sequence: 1,
  createdAt: '2026-10-14T19:00:00.000Z',
  updatedAt: null,
});

describe('scoreSubmission', () => {
  it('marks an empty submission as empty', () => {
    const result = scoreSubmission([], items);
    expect(result.empty).toBe(true);
    expect(result.byAxis.size).toBe(0);
  });

  it('aggregates per axis and clamps the normalised score to [0, 1]', () => {
    const answers = [
      makeAnswer(
        ITEM_A,
        { kind: 'scenario_choice', choice: 'check_source', rationale: null },
        '0100',
      ),
      makeAnswer(
        ITEM_B,
        { kind: 'scenario_choice', choice: 'check_policy', rationale: null },
        '0200',
      ),
    ];
    const result = scoreSubmission(answers, items);
    const literacy = result.byAxis.get('literacy');
    expect(literacy).toBeDefined();
    expect(literacy?.scoredItems).toBe(2);
    expect(literacy?.skippedItems).toBe(0);
    expect(literacy?.normalised).toBe(1);
  });

  it('honours reverse scoring', () => {
    const reversed: QuestionItem = {
      ...itemLiteracyA,
      id: parseQuestionItemId('550e8400-e29b-41d4-a716-446655440099'),
      code: 'reversed_item',
      scoring: { weight: 1, reverse: true },
    };
    const items2 = new Map<string, QuestionItem>([[reversed.id as unknown as string, reversed]]);
    const answers = [
      makeAnswer(
        reversed.id,
        { kind: 'scenario_choice', choice: 'use_it', rationale: null },
        '0300',
      ),
    ];
    const result = scoreSubmission(answers, items2);
    expect(result.byAxis.get('literacy')?.normalised).toBe(1); // 1 - 0
  });

  it('does not score "I don\u2019t know" as the top option and leaves it out of the average', () => {
    const withUnsure: QuestionItem = {
      ...itemLiteracyA,
      options: [
        ...itemLiteracyA.options,
        { value: 'unsure', label: 'I don\u2019t know / It depends' },
      ],
    };
    const map = new Map<string, QuestionItem>([
      [ITEM_A as unknown as string, withUnsure],
      [ITEM_B as unknown as string, itemLiteracyB],
    ]);
    const unsure = scoreSubmission(
      [makeAnswer(ITEM_A, { kind: 'scenario_choice', choice: 'unsure', rationale: null }, '0500')],
      map,
    );
    expect(unsure.byAxis.get('literacy')?.scoredItems).toBe(0);
    expect(unsure.byAxis.get('literacy')?.skippedItems).toBe(1);
    // One scored answer (lowest option) and one "unsure": the score is the scored one alone.
    const mixed = scoreSubmission(
      [
        makeAnswer(ITEM_A, { kind: 'scenario_choice', choice: 'unsure', rationale: null }, '0501'),
        makeAnswer(
          ITEM_B,
          { kind: 'scenario_choice', choice: 'check_policy', rationale: null },
          '0502',
        ),
      ],
      map,
    );
    expect(mixed.byAxis.get('literacy')?.normalised).toBe(1);
  });

  it('treats multi_choice as the mean of the chosen option indices', () => {
    const items3 = new Map<string, QuestionItem>([[ITEM_A as unknown as string, itemLiteracyA]]);
    const answers = [
      makeAnswer(ITEM_A, { kind: 'multi_choice', choices: ['use_it', 'check_source'] }, '0400'),
    ];
    const result = scoreSubmission(answers, items3);
    expect(result.byAxis.get('literacy')?.normalised).toBe(0.5);
  });

  it('counts short_text items as skipped, not scored', () => {
    const answers = [
      makeAnswer(ITEM_TEXT, { kind: 'short_text', text: 'r\u00e9ponse libre' }, '0500'),
    ];
    const result = scoreSubmission(answers, items);
    expect(result.byAxis.get('literacy')?.scoredItems).toBe(0);
    expect(result.byAxis.get('literacy')?.skippedItems).toBe(1);
  });

  it('keeps practice separate from literacy', () => {
    const answers = [
      makeAnswer(ITEM_A, { kind: 'scenario_choice', choice: 'use_it', rationale: null }, '0600'),
      makeAnswer(
        ITEM_C,
        { kind: 'scenario_choice', choice: 'check_source', rationale: null },
        '0700',
      ),
    ];
    const result = scoreSubmission(answers, items);
    expect(result.byAxis.get('literacy')?.normalised).toBe(0);
    expect(result.byAxis.get('practice')?.normalised).toBe(1);
  });
  it('leaves a weight-0 item out of the score (TASK-AJ A4)', () => {
    const unscored: QuestionItem = { ...itemPractice, scoring: { weight: 0, reverse: false } };
    const result = scoreSubmission(
      [
        {
          id: parseAnswerId('550e8400-e29b-41d4-a716-446655440099'),
          tenantId: TENANT,
          submissionId: SUB,
          questionItemId: ITEM_C,
          value: { kind: 'scenario_choice', choice: 'check_source' },
          confidence: null,
          rationale: null,
          durationMs: null,
          sequence: 0,
          createdAt: '2026-10-14T19:00:00.000Z',
        } as Answer,
      ],
      new Map([[ITEM_C as string, unscored]]),
    );
    expect(result.byAxis.get('practice')).toMatchObject({ scoredItems: 0, skippedItems: 1 });
  });
});
