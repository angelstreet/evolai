import {
  PILOT_QUESTIONNAIRE,
  type AnswerValue,
  type DefinitionQuestion,
  type Locale,
} from '@evolai/contracts';
import type { SupportedLocale } from '@evolai/i18n';
import { parseAnswerValue } from './answerParser';

/**
 * The survey the mobile web flow shows (M5, TASK-Z2). The questions come from the versioned
 * definition in `@evolai/contracts` (`questionnaires/pilot-v2.json`), so changing the questions
 * means editing that file, not this one. The file name is historical. Plain words, one idea per
 * question, French and English side by side. No PII, no real client data.
 */

export interface SurveyQuestion {
  readonly id: string;
  readonly axis: DefinitionQuestion['axis'];
  readonly code: string;
  readonly prompt: Record<SupportedLocale, string>;
  readonly helper: Record<SupportedLocale, string | null>;
  readonly options: ReadonlyArray<{
    readonly value: string;
    readonly label: Record<SupportedLocale, string>;
  }>;
  readonly kind: DefinitionQuestion['kind'];
}

const toSurveyQuestion = (q: DefinitionQuestion): SurveyQuestion => ({
  id: q.code,
  axis: q.axis,
  code: q.code,
  prompt: q.prompt,
  helper: q.helper,
  options: q.options,
  kind: q.kind,
});

export const SYNTHETIC_QUESTIONS: ReadonlyArray<SurveyQuestion> =
  PILOT_QUESTIONNAIRE.questions.map(toSurveyQuestion);

/** Free-text answers: the cap, and the one-line reminder shown under each text box. */
export const FREE_TEXT_MAX_LENGTH = PILOT_QUESTIONNAIRE.freeTextMaxLength;
export const freeTextHint = (locale: SupportedLocale): string =>
  PILOT_QUESTIONNAIRE.freeTextHint[locale];

/** Honest length of the whole survey, in minutes, from the definition. */
export const surveyEstimatedMinutes = (): number => PILOT_QUESTIONNAIRE.estimatedMinutes;

export const totalQuestionCount = (): number => SYNTHETIC_QUESTIONS.length;

export const questionByIndex = (index: number): SurveyQuestion => {
  const q = SYNTHETIC_QUESTIONS[index];
  if (!q) throw new Error(`question index out of range: ${index}`);
  return q;
};

export const buildAnswer = (q: SurveyQuestion, input: string): AnswerValue =>
  parseAnswerValue(q.kind, input);

export const supportedLocaleOrFallback = (value: string): SupportedLocale => {
  if (value === 'fr' || value === 'en') return value;
  return 'en';
};

// Locale type re-export to keep a single import surface.
export type { Locale };
