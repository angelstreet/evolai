import { z } from 'zod';
import pilotV1 from './questionnaires/pilot-v1.json' with { type: 'json' };
import pilotV2 from './questionnaires/pilot-v2.json' with { type: 'json' };
import { competencyAxisSchema, sensitivitySchema } from './template.js';

/**
 * Questionnaire definition: the versioned, in-repository source of the questions a respondent
 * sees (TASK-Z2, ADR 0046). One JSON file per version under `questionnaires/`; the survey pages,
 * the apply script (`infra/db/scripts/questionnaire.mjs`) and the AI eval all read it, so editing
 * the file is how the owner changes the questions.
 */

/** Reserved option value for "I don't know / It depends": never scored. */
export const UNSURE_VALUE = 'unsure';

/** Analysis themes a question feeds. `axis` is what is stored; `theme` is the reader's name. */
export const questionThemeSchema = z.enum(['friction', 'tooling', 'opportunity', 'context']);
export type QuestionTheme = z.infer<typeof questionThemeSchema>;

const localised = <T extends z.ZodTypeAny>(inner: T) => z.object({ fr: inner, en: inner });

export const definitionQuestionSchema = z
  .object({
    code: z
      .string()
      .min(2)
      .max(60)
      .regex(/^[a-z][a-z0-9_]*$/, 'must be snake_case starting with a letter'),
    axis: competencyAxisSchema,
    theme: questionThemeSchema,
    kind: z.enum(['scenario_choice', 'single_choice', 'short_text']),
    sensitivity: sensitivitySchema,
    /** Scoring weight; 0 keeps the answer out of the readiness score (text, role). */
    weight: z.number().min(0).max(1),
    prompt: localised(z.string().min(1).max(500)),
    helper: localised(z.string().max(500).nullable()),
    options: z
      .array(
        z.object({
          value: z.string().min(1).max(40),
          label: localised(z.string().min(1).max(200)),
        }),
      )
      .max(10),
  })
  .superRefine((q, ctx) => {
    const isText = q.kind === 'short_text';
    if (isText && q.options.length > 0) {
      ctx.addIssue({ code: 'custom', message: 'a text question has no options' });
    }
    if (!isText && q.options.length < 2) {
      ctx.addIssue({ code: 'custom', message: 'a choice question needs at least two options' });
    }
    const values = q.options.map((o) => o.value);
    if (new Set(values).size !== values.length) {
      ctx.addIssue({ code: 'custom', message: 'option values must be unique' });
    }
  });

export type DefinitionQuestion = z.infer<typeof definitionQuestionSchema>;

export const questionnaireDefinitionSchema = z
  .object({
    id: z.string().min(1).max(60),
    version: z.number().int().min(1).max(1000),
    estimatedMinutes: z.number().int().min(1).max(30),
    freeTextMaxLength: z.number().int().min(50).max(2000),
    freeTextHint: localised(z.string().min(1).max(200)),
    questions: z.array(definitionQuestionSchema).min(1).max(40),
  })
  .superRefine((d, ctx) => {
    const codes = d.questions.map((q) => q.code);
    if (new Set(codes).size !== codes.length) {
      ctx.addIssue({ code: 'custom', message: 'question codes must be unique' });
    }
  });

export type QuestionnaireDefinition = z.infer<typeof questionnaireDefinitionSchema>;

/** Parse and validate; throws a readable error when the file is edited into an invalid shape. */
export const parseQuestionnaireDefinition = (raw: unknown): QuestionnaireDefinition =>
  questionnaireDefinitionSchema.parse(raw);

/** Questionnaire v1, kept for the record: answers given on it keep their codes. */
export const PILOT_QUESTIONNAIRE_V1: QuestionnaireDefinition =
  parseQuestionnaireDefinition(pilotV1);

/**
 * The questionnaire the survey uses: v2 is v1 plus the task inventory (TASK-AJ A5, ADR 0059).
 * Validated once at import time.
 */
export const PILOT_QUESTIONNAIRE: QuestionnaireDefinition = parseQuestionnaireDefinition(pilotV2);

/** The `question_items` columns a definition question is stored as (French source text). */
export const toItemRow = (q: DefinitionQuestion) => ({
  axis: q.axis,
  code: q.code,
  kind: q.kind,
  locale: 'fr' as const,
  prompt: q.prompt.fr,
  helper: q.helper.fr,
  options: q.options.map((o) => ({ value: o.value, label: o.label.fr })),
  scoring: { weight: q.weight, reverse: false },
  sensitivity: q.sensitivity,
  retestable: false,
});
