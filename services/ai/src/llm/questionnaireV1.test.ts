import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PILOT_QUESTIONNAIRE, toItemRow } from '@evolai/contracts';
import { answerPlainText, runPipeline } from '../pipeline.js';
import type { AnswerRow, PipelineInput, QuestionItemRow } from '../pipeline.js';
import { runLlmPipeline } from './llmPipeline.js';
import { MockProvider } from './providers.js';
import type { GoldItem } from './evaluate.js';
import { TENANT_A, testConfig } from './testFixtures.js';

/**
 * The pipeline on the real shape of questionnaire v1 data (TASK-Z2): item rows as stored by
 * `toItemRow`, answers as the survey stores them (`{kind, choice}` / `{kind, text}`).
 */
const SUBMISSION = '00000000-0000-4000-8000-000000000002';
const items = new Map<string, QuestionItemRow>(
  PILOT_QUESTIONNAIRE.questions.map((q) => {
    const r = toItemRow(q);
    return [
      `item-${q.code}`,
      {
        id: `item-${q.code}`,
        tenant_id: TENANT_A,
        axis: r.axis,
        code: r.code,
        kind: r.kind,
        locale: r.locale,
        prompt: r.prompt,
        options_json: r.options,
        scoring_json: r.scoring,
        sensitivity: r.sensitivity,
      },
    ];
  }),
);

const TEXTS = {
  v1_repeat_task:
    'Chaque lundi, je recopie les commandes du mail vers le tableur, à la main. Environ 3 heures.',
  v1_missing_tool: 'Il me manque un accès direct à la base des stocks.',
  v1_assistant_wish: 'Un assistant qui rédige le brouillon du compte rendu de réunion.',
};

const answerRows: AnswerRow[] = [
  {
    code: 'v1_source_check',
    value: { kind: 'scenario_choice', choice: 'check_source', rationale: null },
  },
  {
    code: 'v1_request_style',
    value: { kind: 'scenario_choice', choice: 'unsure', rationale: null },
  },
  { code: 'v1_repeat_time', value: { kind: 'scenario_choice', choice: '3_6h', rationale: null } },
  { code: 'v1_repeat_task', value: { kind: 'short_text', text: TEXTS.v1_repeat_task } },
  { code: 'v1_missing_tool', value: { kind: 'short_text', text: TEXTS.v1_missing_tool } },
  { code: 'v1_assistant_wish', value: { kind: 'short_text', text: TEXTS.v1_assistant_wish } },
  { code: 'v1_job_family', value: { kind: 'single_choice', choice: 'finance_legal_hr' } },
].map((a, i) => ({
  id: `ans-${a.code}`,
  tenant_id: TENANT_A,
  submission_id: SUBMISSION,
  question_item_id: `item-${a.code}`,
  value_json: a.value,
  sequence: i,
}));

const input: PipelineInput = {
  submission: {
    id: SUBMISSION,
    tenant_id: TENANT_A,
    engagement_id: '00000000-0000-4000-8000-0000000000e1',
    invitation_id: '00000000-0000-4000-8000-0000000000c1',
    status: 'submitted',
    locale: 'fr',
    started_at: '2026-10-15T00:00:00Z',
    submitted_at: '2026-10-15T00:07:00Z',
  },
  answers: answerRows,
  questionItems: items,
};
const now = () => new Date('2026-10-15T10:00:00Z');

describe('answerPlainText', () => {
  const item = (code: string) => items.get(`item-${code}`) as QuestionItemRow;
  it('gives the words of a free-text answer and the label of a choice, never JSON', () => {
    expect(answerPlainText(item('v1_repeat_task'), { kind: 'short_text', text: 'abc' })).toBe(
      'abc',
    );
    expect(
      answerPlainText(item('v1_source_check'), {
        kind: 'scenario_choice',
        choice: 'check_source',
        rationale: null,
      }),
    ).toBe('Je vérifie ailleurs');
    expect(answerPlainText(item('v1_source_check'), 'use_as_is')).toBe('Je l’utilise telle quelle');
    expect(
      answerPlainText(item('v1_source_check'), {
        kind: 'scenario_choice',
        choice: 'unsure',
        rationale: null,
      }),
    ).toBe('Je ne sais pas / Ça dépend');
  });
});

describe('analysis of questionnaire v1 answers', () => {
  it('model path: themes and draft opportunities cite the respondent’s own words', async () => {
    const provider = new MockProvider(testConfig());
    const res = await runLlmPipeline(input, { provider, config: testConfig(), now });
    const p = res.payload;
    expect(p.themes.map((t) => t.id)).toEqual(
      expect.arrayContaining(['repetitive-work', 'missing-tool', 'assistant-wish']),
    );
    expect(p.opportunities?.length ?? 0).toBeGreaterThan(0);
    const words = new Map(
      answerRows.map((r) => [
        r.id,
        answerPlainText(items.get(r.question_item_id) as QuestionItemRow, r.value_json),
      ]),
    );
    const cited = (p.opportunities ?? []).flatMap((o) => o.evidence);
    expect(cited.length).toBeGreaterThan(0);
    for (const c of cited) {
      // A verbatim part of what the person answered, not of the stored JSON.
      expect(words.get(c.sourceId)).toContain(c.quote);
    }
    // At least one opportunity rests on a free-text answer, in the person's own words.
    expect(cited.some((c) => Object.values(TEXTS).some((t) => t.includes(c.quote)))).toBe(true);
    expect(p.sensitivity).toBe('internal');
    // The model saw plain words: no stored-JSON keys in what was sent.
    const sent = provider.requests.map((r) => r.user).join('\n');
    expect(sent).toContain(TEXTS.v1_missing_tool);
    expect(sent).not.toMatch(/"kind"|short_text|scenario_choice/);
  });

  it('leaves skipped questions out: nothing is cited or sent for them', async () => {
    const skipped: AnswerRow = {
      id: 'ans-skipped',
      tenant_id: TENANT_A,
      submission_id: SUBMISSION,
      question_item_id: 'item-v1_job_family',
      value_json: { kind: 'skipped' },
      sequence: 99,
    };
    const withSkip: PipelineInput = { ...input, answers: [...answerRows, skipped] };
    const provider = new MockProvider(testConfig());
    const res = await runLlmPipeline(withSkip, { provider, config: testConfig(), now });
    expect(res.payload.evidence.some((c) => c.sourceId === 'ans-skipped')).toBe(false);
    expect(provider.requests.map((r) => r.user).join('\n')).not.toContain('skipped');
    const rule = runPipeline(withSkip);
    expect(JSON.stringify(rule)).not.toContain('ans-skipped');
  });

  it('rule-based path: free text becomes themes with a verbatim citation, choices stay choices', () => {
    const p = runPipeline(input);
    const practice = p.themes.find((t) => t.axis === 'practice');
    const readiness = p.themes.find((t) => t.axis === 'readiness');
    const opportunity = p.themes.find((t) => t.axis === 'opportunity');
    expect(readiness?.summary).toBe('1 free-text answer(s)');
    expect(opportunity?.evidence[0]?.quote).toBe(TEXTS.v1_assistant_wish);
    expect(practice?.evidence.map((c) => c.quote)).toContain(TEXTS.v1_repeat_task);
    // "I don't know" is neither a high nor a low signal for contradictions.
    expect(p.contradictions).toEqual([]);
  });
});

describe('gold fixtures for questionnaire v1', () => {
  const gold = (
    JSON.parse(readFileSync(new URL('../../eval/gold.json', import.meta.url), 'utf8')) as {
      items: GoldItem[];
    }
  ).items;
  const v1 = gold.filter((g) => g.answers.some((a) => a.code));

  it('covers about a dozen respondents in French and English', () => {
    expect(v1.length).toBeGreaterThanOrEqual(12);
    expect(new Set(v1.map((g) => g.locale))).toEqual(new Set(['fr', 'en']));
  });

  it('uses the definition’s own question text and axis, so a reworded question fails here', () => {
    for (const g of v1) {
      for (const a of g.answers) {
        const q = PILOT_QUESTIONNAIRE.questions.find((x) => x.code === a.code);
        expect(q, `${g.id}: unknown code ${a.code}`).toBeDefined();
        expect(a.question).toBe(q?.prompt[g.locale]);
        expect(a.axis).toBe(q?.axis);
      }
    }
  });
});
