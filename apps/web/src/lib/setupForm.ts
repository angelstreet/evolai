import {
  missionKindSchema,
  missionModeSchema,
  missionShape,
  type MissionShape,
} from '@evolai/contracts';
import { isUuid } from './invitationForm';

/** Pure parsing of the audit set-up forms (TASK-T, ADR 0038). Codes, not messages: the page words them. */

export type SetupErrorCode =
  | 'bad_name'
  | 'bad_locale'
  | 'bad_dates'
  | 'bad_size'
  | 'bad_id'
  | 'no_teams'
  | 'no_template'
  | 'bad_kind'
  | 'kind_not_ready'
  | 'not_found'
  | 'bad_status'
  | 'confirm_required'
  | 'error';

export class SetupError extends Error {
  constructor(readonly code: SetupErrorCode) {
    super(code);
    this.name = 'SetupError';
  }
}

export const MAX_NAME = 120;
export const MAX_TEAM_SIZE = 10000;

/** Trimmed, single-spaced name of 1 to 120 characters, or null. */
export const parseName = (raw: unknown): string | null => {
  const s = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length >= 1 && s.length <= MAX_NAME ? s : null;
};

export const parseTeamSize = (raw: unknown): number | null => {
  const s = String(raw ?? '').trim();
  if (!/^\d{1,5}$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= MAX_TEAM_SIZE ? n : null;
};

/** `YYYY-MM-DD` from a date input, as a real calendar day, or null. Empty is allowed (`''`). */
export const parseDay = (raw: unknown): string | null | '' => {
  const s = String(raw ?? '').trim();
  if (s === '') return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
};

export interface EngagementInput {
  readonly name: string;
  readonly locale: 'fr' | 'en';
  readonly opensOn: string | null;
  readonly closesOn: string | null;
  readonly teamIds: readonly string[];
  /** Kind and mode, sent by the new-mission form only (ADR 0065); fixed after creation. */
  readonly shape?: MissionShape;
}

/** Kind and mode from the form, or undefined when the form does not carry them (editing). */
export const parseMissionShape = (fd: FormData): MissionShape | undefined => {
  const kind = fd.get('kind');
  if (kind === null) return undefined;
  if (!missionKindSchema.safeParse(kind).success) throw new SetupError('bad_kind');
  const mode = fd.get('mode') ?? (kind === 'governance' ? 'interview' : null);
  if (kind === 'team' && !missionModeSchema.safeParse(mode).success) {
    throw new SetupError('bad_kind');
  }
  return missionShape(kind, mode);
};

export const parseEngagementForm = (fd: FormData): EngagementInput => {
  const name = parseName(fd.get('name'));
  if (!name) throw new SetupError('bad_name');
  const locale = String(fd.get('locale') ?? '');
  if (locale !== 'fr' && locale !== 'en') throw new SetupError('bad_locale');
  const opens = parseDay(fd.get('opensOn'));
  const closes = parseDay(fd.get('closesOn'));
  if (opens === null || closes === null) throw new SetupError('bad_dates');
  if (opens && closes && closes < opens) throw new SetupError('bad_dates');
  const teamIds = [...new Set(fd.getAll('teamId').map(String))];
  if (teamIds.some((id) => !isUuid(id))) throw new SetupError('bad_id');
  const shape = parseMissionShape(fd);
  return {
    name,
    locale,
    opensOn: opens || null,
    closesOn: closes || null,
    teamIds,
    ...(shape ? { shape } : {}),
  };
};

/** Start of the opening day and end of the closing day, in UTC, so both days count in full. */
export const dayStart = (day: string | null): string | null =>
  day ? `${day}T00:00:00.000Z` : null;
export const dayEnd = (day: string | null): string | null => (day ? `${day}T23:59:59.000Z` : null);
export const dayOf = (iso: string | null): string => (iso ? iso.slice(0, 10) : '');
