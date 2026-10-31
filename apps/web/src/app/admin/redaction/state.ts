/** Form state of the redaction-term actions; kept out of the 'use server' file, which may export only async functions. */
export interface RedactionActionState {
  ok: boolean;
  message: string;
  /** Echoed back so the form can clear the input on success. */
  term?: string;
}

export const INITIAL_REDACTION_STATE: RedactionActionState = { ok: false, message: '' };
