/** Result of a report action: a code the page words (TASK-V). */
export interface ReportActionState {
  readonly ok: boolean;
  readonly code: string;
  readonly count?: number;
  /** Words for the message, e.g. the name that blocks publishing and where it is. */
  readonly vars?: Readonly<Record<string, string>>;
}

export const reportIdle: ReportActionState = { ok: false, code: 'idle' };
