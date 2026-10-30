import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PILOT_QUESTIONNAIRE,
  PILOT_QUESTIONNAIRE_V1,
  PILOT_QUESTIONNAIRE_V2,
  UNSURE_VALUE,
  parseQuestionnaireDefinition,
  toItemRow,
  questionnaireDefinitionSchema,
} from './questionnaire.js';

const JUDGEMENT =
  /bonne demande|mauvaise|pas toujours la bonne|good request|wrong|not always the (right )?answer/i;

describe('pilot questionnaire v3', () => {
  const q = PILOT_QUESTIONNAIRE;

  it('is valid and has six choices, three free-text questions, the task inventory and one role question', () => {
    expect(q.questions.filter((x) => x.kind === 'scenario_choice')).toHaveLength(6);
    expect(q.questions.filter((x) => x.kind === 'short_text')).toHaveLength(3);
    expect(q.questions.filter((x) => x.kind === 'single_choice')).toHaveLength(5);
  });

  it('asks the task inventory right after the repeated task, unscored', () => {
    const codes = q.questions.map((x) => x.code);
    const at = codes.indexOf('v1_repeat_task');
    expect(codes.slice(at + 1, at + 5)).toEqual([
      'v2_task_frequency',
      'v2_task_duration',
      'v2_task_tool',
      'v2_task_data',
    ]);
    for (const x of q.questions.filter((c) => c.code.startsWith('v2_'))) {
      expect(x.weight).toBe(0);
      expect(x.options.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps every v1 question and its meaning', () => {
    const now = new Map(q.questions.map((x) => [x.code, x]));
    for (const old of PILOT_QUESTIONNAIRE_V1.questions) {
      expect(now.get(old.code)?.prompt).toEqual(old.prompt);
      expect(now.get(old.code)?.options).toEqual(old.options);
    }
    expect(q.version).toBe(PILOT_QUESTIONNAIRE_V1.version + 2);
  });

  it('keeps every v2 code, prompt and option value; only helpers and one label change (ADR 0062)', () => {
    const v2 = PILOT_QUESTIONNAIRE_V2.questions;
    expect(q.questions.map((x) => x.code)).toEqual(v2.map((x) => x.code));
    for (const [i, old] of v2.entries()) {
      const now = q.questions[i];
      expect(now?.prompt).toEqual(old.prompt);
      expect(now?.options.map((o) => o.value)).toEqual(old.options.map((o) => o.value));
      expect(now?.weight).toBe(old.weight);
    }
    const task = q.questions.find((x) => x.code === 'v1_repeat_task');
    expect(task?.helper.en).toContain('not a client assignment');
  });

  it('tags the three free-text questions with friction, tooling and opportunity', () => {
    const text = q.questions.filter((x) => x.kind === 'short_text');
    expect(text.map((x) => x.theme)).toEqual(['friction', 'tooling', 'opportunity']);
    expect(text.map((x) => x.axis)).toEqual(['practice', 'readiness', 'opportunity']);
    for (const t of text) expect(t.sensitivity).toBe('internal');
  });

  it('offers an honest "I don’t know / It depends" option on every scored choice', () => {
    for (const x of q.questions.filter((c) => c.kind === 'scenario_choice')) {
      const last = x.options[x.options.length - 1];
      expect(last?.value).toBe(UNSURE_VALUE);
      expect(last?.label.fr).toBe('Je ne sais pas / Ça dépend');
      expect(last?.label.en).toBe('I don’t know / It depends');
    }
  });

  it('has French and English for every prompt, helper, option and the hint', () => {
    for (const x of q.questions) {
      expect(x.prompt.fr.length).toBeGreaterThan(5);
      expect(x.prompt.en.length).toBeGreaterThan(5);
      for (const o of x.options) {
        expect(o.label.fr).not.toBe('');
        expect(o.label.en).not.toBe('');
      }
    }
    expect(q.freeTextHint.fr).toBe('Pas de noms, ni e-mails, ni numéros. Nous les masquons.');
    expect(q.freeTextMaxLength).toBe(400);
  });

  it('never hints at a right answer or judges', () => {
    for (const x of q.questions) {
      for (const text of [x.prompt, x.helper, ...x.options.map((o) => o.label)]) {
        expect(text.fr ?? '').not.toMatch(JUDGEMENT);
        expect(text.en ?? '').not.toMatch(JUDGEMENT);
      }
    }
  });

  it('asks the role question as coarse categories only, with no seniority and no free text', () => {
    const role = q.questions.filter((x) => x.axis === 'context' && x.kind === 'single_choice');
    expect(role).toHaveLength(1);
    expect(role[0]?.options.length).toBeLessThanOrEqual(8);
    expect(q.questions.some((x) => /senior|anciennet/i.test(x.code + x.prompt.fr))).toBe(false);
  });

  it('fits the 6 to 8 minute target', () => {
    expect(q.estimatedMinutes).toBeGreaterThanOrEqual(6);
    expect(q.estimatedMinutes).toBeLessThanOrEqual(8);
  });

  it('rejects duplicate codes, text questions with options and one-option choices', () => {
    const base = JSON.parse(JSON.stringify(q)) as typeof q;
    const dup = { ...base, questions: [base.questions[0], base.questions[0]] };
    expect(questionnaireDefinitionSchema.safeParse(dup).success).toBe(false);
    const badText = JSON.parse(JSON.stringify(base)) as typeof q;
    const textQ = badText.questions.find((x) => x.kind === 'short_text');
    if (textQ) textQ.options = base.questions[0]?.options ?? [];
    expect(questionnaireDefinitionSchema.safeParse(badText).success).toBe(false);
    const oneOption = JSON.parse(JSON.stringify(base)) as typeof q;
    if (oneOption.questions[0])
      oneOption.questions[0].options = oneOption.questions[0].options.slice(0, 1);
    expect(() => parseQuestionnaireDefinition(oneOption)).toThrow();
  });
});

describe('database script and web app read the same definition', () => {
  it('stores the same rows from the script as the app does on first use', async () => {
    const lib = (await import(
      pathToFileURL(
        join(
          dirname(fileURLToPath(import.meta.url)),
          '../../../infra/db/scripts/questionnaire-lib.mjs',
        ),
      ).href
    )) as {
      loadDefinition: () => { questions: unknown[] };
      itemRowFor: (q: unknown) => unknown;
    };
    const def = lib.loadDefinition();
    expect(def.questions).toHaveLength(PILOT_QUESTIONNAIRE.questions.length);
    PILOT_QUESTIONNAIRE.questions.forEach((q, i) => {
      expect(lib.itemRowFor(def.questions[i])).toEqual(toItemRow(q));
    });
  });
});
