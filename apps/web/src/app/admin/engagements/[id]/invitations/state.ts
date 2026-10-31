/** Team tab form state; kept out of the 'use server' file, which may export only async functions. */
export interface TeamActionState {
  readonly ok: boolean;
  readonly code: string;
}

export const teamIdle: TeamActionState = { ok: false, code: 'idle' };
