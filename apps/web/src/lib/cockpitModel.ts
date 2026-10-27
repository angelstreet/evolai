/**
 * Pure model of the front-page cockpit (TASK-AH): the seven steps, what is done, what is next.
 * Steps = the five lessons, answering the survey, then sending it. Kept free of React so it is
 * unit-tested.
 */
export const LESSON_KEYS = ['why', 'how', 'questions', 'results', 'videos'] as const;
export type LessonKey = (typeof LESSON_KEYS)[number];

export const STAGE_KEYS = ['journey', 'learn', 'survey', 'report', 'materials'] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export const TOTAL_STEPS = LESSON_KEYS.length + 2;

export type StepTarget = { kind: 'lesson'; index: number } | { kind: 'survey' } | { kind: 'send' };

export interface Step {
  readonly target: StepTarget;
  readonly done: boolean;
}

export interface Progress {
  readonly lessonsSeen: ReadonlySet<number>;
  /** Index of the open question; equal to the question count once the survey is finished. */
  readonly questionIndex: number;
  readonly questionCount: number;
  readonly sent: boolean;
}

export const stepList = (p: Progress): Step[] => [
  ...LESSON_KEYS.map((_, index) => ({
    target: { kind: 'lesson', index } as const,
    done: p.lessonsSeen.has(index),
  })),
  { target: { kind: 'survey' }, done: p.questionIndex >= p.questionCount },
  { target: { kind: 'send' }, done: p.sent },
];

export const stepsDone = (p: Progress): number => stepList(p).filter((s) => s.done).length;

export const nextStep = (p: Progress): Step | undefined => stepList(p).find((s) => !s.done);

/** Wrap a stage index into 0..4 (the ‹ › control loops). */
export const wrapStage = (i: number): number =>
  ((i % STAGE_KEYS.length) + STAGE_KEYS.length) % STAGE_KEYS.length;

/** Answered = a choice index or a non-blank text. */
export type CockpitAnswers = Readonly<Record<string, number | string>>;
export const answeredCount = (answers: CockpitAnswers): number =>
  Object.values(answers).filter((v) => v !== '' && v !== undefined && v !== null).length;

export type DayPart = 'morning' | 'afternoon' | 'evening';
export const dayPart = (hour: number): DayPart =>
  hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
