/** Result of a findings action: a code the page words (TASK-AJ). */
export interface FindingActionState {
  readonly ok: boolean;
  readonly code: string;
  readonly count?: number;
}

export const findingIdle: FindingActionState = { ok: false, code: 'idle' };

/** Separates a choice's question code from its shown label in the Answers form. */
export const CHOICE_SEP = '\u001f';
