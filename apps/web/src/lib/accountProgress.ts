import { withServiceAccount } from './db';
import type { SessionPayload } from './session';

/**
 * "Your path" of a signed-in account (TASK-AI L1, ADR 0056): lessons done, survey finished, answers
 * sent. Never an answer and never tenant data. Progress only grows: a save is merged with what is
 * stored, so two devices cannot undo each other.
 */
export interface AccountProgress {
  readonly lessons: readonly number[];
  readonly surveyDone: boolean;
  readonly sent: boolean;
}

export type ProgressOutcome =
  | { readonly kind: 'ok'; readonly progress: AccountProgress }
  | { readonly kind: 'signin' | 'unavailable' };

export const LESSON_COUNT = 5;

export const EMPTY: AccountProgress = { lessons: [], surveyDone: false, sent: false };

/** Keep only lesson indexes 0..4, once each, sorted. */
export const cleanLessons = (raw: readonly unknown[]): number[] =>
  [
    ...new Set(
      raw.filter(
        (n): n is number =>
          Number.isInteger(n) && (n as number) >= 0 && (n as number) < LESSON_COUNT,
      ),
    ),
  ].sort((a, b) => a - b);

/** Union of two progress records: nothing done is ever undone. */
export const mergeProgress = (a: AccountProgress, b: AccountProgress): AccountProgress => ({
  lessons: cleanLessons([...a.lessons, ...b.lessons]),
  surveyDone: a.surveyDone || b.surveyDone,
  sent: a.sent || b.sent,
});

/** The owner's view-as is a look at someone else's space: it neither reads nor writes progress. */
const accountOf = (session: SessionPayload | null): string | null =>
  session && !session.viewAs ? session.sub : null;

type Row = { lessons_seen: number[]; survey_done: boolean; sent_at: Date | null };
const fromRow = (r: Row | undefined): AccountProgress =>
  r
    ? { lessons: cleanLessons(r.lessons_seen), surveyDone: r.survey_done, sent: r.sent_at !== null }
    : EMPTY;

export const loadProgress = async (session: SessionPayload | null): Promise<ProgressOutcome> => {
  const user = accountOf(session);
  if (!user) return { kind: 'signin' };
  try {
    const row = await withServiceAccount(async (client) => {
      const { rows } = await client.query<Row>(
        `SELECT lessons_seen, survey_done, sent_at FROM account_progress WHERE user_id = $1`,
        [user],
      );
      return rows[0];
    });
    return { kind: 'ok', progress: fromRow(row) };
  } catch {
    // Before migration 0028 is applied the page keeps its browser state.
    return { kind: 'unavailable' };
  }
};

export const saveProgress = async (
  session: SessionPayload | null,
  update: AccountProgress,
): Promise<ProgressOutcome> => {
  const user = accountOf(session);
  if (!user) return { kind: 'signin' };
  try {
    const row = await withServiceAccount(async (client) => {
      const { rows } = await client.query<Row>(
        `INSERT INTO account_progress (user_id, lessons_seen, survey_done, sent_at)
         VALUES ($1, $2::smallint[], $3, CASE WHEN $4 THEN now() END)
         ON CONFLICT (user_id) DO UPDATE SET
           lessons_seen = ARRAY(SELECT DISTINCT unnest(account_progress.lessons_seen || EXCLUDED.lessons_seen) ORDER BY 1),
           survey_done  = account_progress.survey_done OR EXCLUDED.survey_done,
           sent_at      = COALESCE(account_progress.sent_at, EXCLUDED.sent_at),
           updated_at   = now()
         RETURNING lessons_seen, survey_done, sent_at`,
        [user, cleanLessons(update.lessons), update.surveyDone, update.sent],
      );
      return rows[0];
    });
    return { kind: 'ok', progress: fromRow(row) };
  } catch {
    return { kind: 'unavailable' };
  }
};
