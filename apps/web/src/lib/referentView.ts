import { MIN_GROUP_SIZE } from './invitationTracking';

/**
 * What a team referent may know about participation (TASK-S, ADR 0039). Pure rules, no I/O.
 *
 * The referent hands each link to a colleague they know, so anything per link (answered, opened,
 * expiry pushed back, due a reminder) tells them who answered. The referent therefore gets counts
 * per team only, and only when the counts cannot point at a person:
 *  - fewer than MIN_GROUP_SIZE invited: nothing but the invited total (they chose it);
 *  - fewer than MIN_GROUP_SIZE answered: a coarse band ("none", "some", "most");
 *  - otherwise exact counts.
 * The activity day is never shown: with live counts, a date narrows down who answered.
 */

export interface RawTeamCounts {
  readonly teamId: string;
  readonly teamName: string;
  readonly invited: number;
  readonly started: number;
  readonly completed: number;
}

export type Band = 'none' | 'some' | 'most';

export type Participation =
  | {
      readonly kind: 'hidden';
      readonly teamId: string;
      readonly teamName: string;
      readonly invited: number;
    }
  | {
      readonly kind: 'band';
      readonly teamId: string;
      readonly teamName: string;
      readonly invited: number;
      readonly band: Band;
    }
  | {
      readonly kind: 'exact';
      readonly teamId: string;
      readonly teamName: string;
      readonly invited: number;
      readonly started: number;
      readonly completed: number;
      /** 0..100, whole percent of invited. */
      readonly rate: number;
    };

export const bandOf = (completed: number, invited: number): Band =>
  completed <= 0 ? 'none' : completed * 2 >= invited ? 'most' : 'some';

export const referentParticipation = (
  c: RawTeamCounts,
  min: number = MIN_GROUP_SIZE,
): Participation => {
  const base = { teamId: c.teamId, teamName: c.teamName, invited: c.invited };
  if (c.invited < min) return { kind: 'hidden', ...base };
  if (c.completed < min) return { kind: 'band', ...base, band: bandOf(c.completed, c.invited) };
  return {
    kind: 'exact',
    ...base,
    started: c.started,
    completed: c.completed,
    rate: Math.round((c.completed / c.invited) * 100),
  };
};

/** Bar value 0..100 for a participation row: exact rate, a fixed step per band, or null. */
export const barValue = (p: Participation): number | null =>
  p.kind === 'exact' ? p.rate : p.kind === 'band' ? { none: 0, some: 25, most: 60 }[p.band] : null;

/** True only when every team's exact counts say everybody answered. Unknown counts say no. */
export const everyoneAnswered = (rows: readonly Participation[]): boolean =>
  rows.length > 0 && rows.every((r) => r.kind === 'exact' && r.completed >= r.invited);

const DAY_MS = 86_400_000;

/** ISO day (YYYY-MM-DD) plus or minus whole days, in UTC. */
export const addDays = (day: string, days: number): string =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

/** Whole days from `today` to `day` (negative when past). */
/**
 * The one date the referent is told ("answer before"): the closing day or the earliest day a
 * still-open link stops working, whichever comes first (TASK-AB).
 */
export const effectiveCloseDay = (
  closesOn: string | null,
  earliestLinkExpiry: string | null,
): string | null =>
  closesOn && earliestLinkExpiry
    ? closesOn < earliestLinkExpiry
      ? closesOn
      : earliestLinkExpiry
    : (closesOn ?? earliestLinkExpiry);

export const daysUntil = (day: string, today: string): number =>
  Math.round(
    (new Date(`${day}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / DAY_MS,
  );

/** Suggested reminder days before the closing date. */
export const REMIND_BEFORE_CLOSE: readonly number[] = [7, 2];

/** A suggested day stays "due" for this many days after it, for a referent who missed it. */
export const REMIND_GRACE_DAYS = 1;

export interface ReminderPlan {
  /** Suggested days to send the generic reminder, ascending, ISO days. */
  readonly dates: readonly string[];
  /** The next suggested day on or after today, or null. */
  readonly next: string | null;
  /** A reminder makes sense today: today is a suggested day (or the day after) and still open. */
  readonly due: boolean;
}

/**
 * When to send the one generic reminder. With a closing date: a week and two days before it (only
 * days after the first link was created). Without: the engagement schedule, counted from the first
 * link. Nothing here looks at who answered.
 */
export const reminderPlan = (input: {
  readonly closesOn: string | null;
  readonly firstLinkOn: string | null;
  readonly schedule: readonly number[];
  readonly today: string;
}): ReminderPlan => {
  const { closesOn, firstLinkOn, schedule, today } = input;
  if (!firstLinkOn) return { dates: [], next: null, due: false };
  let dates: string[];
  if (closesOn) {
    dates = REMIND_BEFORE_CLOSE.map((d) => addDays(closesOn, -d)).filter((d) => d > firstLinkOn);
    // A short window: one reminder the day before closing, if that day is after the first link.
    const eve = addDays(closesOn, -1);
    if (dates.length === 0 && eve > firstLinkOn) dates = [eve];
  } else {
    dates = schedule.map((d) => addDays(firstLinkOn, d));
  }
  dates = [...new Set(dates)].sort();
  const open = closesOn === null || today <= closesOn;
  return {
    dates,
    next: dates.find((d) => d >= today) ?? null,
    due: open && dates.some((d) => d <= today && today <= addDays(d, REMIND_GRACE_DAYS)),
  };
};

export type NextStep = 'create' | 'share' | 'remind' | 'wait' | 'results';

/**
 * The one thing to do next. "remind" only when a reminder makes sense: the survey is open, links
 * exist, a suggested day has come, and the counts do not already say everybody answered.
 */
export const nextStep = (input: {
  readonly status: string;
  readonly rows: readonly Participation[];
  readonly hasResults: boolean;
  readonly plan: ReminderPlan;
}): NextStep => {
  const { status, rows, hasResults, plan } = input;
  if (hasResults || status === 'closed') return 'results';
  if (['analysis', 'review', 'archived'].includes(status)) return 'wait';
  const invited = rows.reduce((n, r) => n + r.invited, 0);
  if (invited === 0) return 'create';
  if (everyoneAnswered(rows)) return 'wait';
  if (status === 'in_field' && plan.due) return 'remind';
  return 'share';
};

export interface MessageCopy {
  readonly greeting: string;
  readonly what: string;
  readonly time: string;
  readonly anonymous: string;
  readonly closes: string;
  readonly contact: string;
  readonly thanks: string;
}

/** The ready-made invitation text (without the link): one short line per fact. */
export const composeMessage = (
  copy: MessageCopy,
  facts: { readonly closesOn: string | null; readonly contact: string | null },
): string =>
  [
    copy.greeting,
    '',
    copy.what,
    copy.time,
    copy.anonymous,
    facts.closesOn ? copy.closes : null,
    facts.contact ? copy.contact : null,
    '',
    copy.thanks,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');

/** Message plus one link, as sent to one person. */
export const withLink = (message: string, link: string): string =>
  `${message.trimEnd()}\n\n${link}`;

/** `mailto:` with no address: the referent picks the recipient in their own mail app. */
export const mailtoHref = (subject: string, body: string): string =>
  `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

/** WhatsApp share with prepared text and no number: the referent picks the chat. */
export const whatsappHref = (text: string): string =>
  `https://wa.me/?text=${encodeURIComponent(text)}`;

/** Contact person shown in messages: the engagement contact, else the referent's own name. */
export const contactFor = (configured: string | null, referentName: string | null): string | null =>
  configured?.trim() || referentName?.trim() || null;

/** Validate the engagement contact from settings: one line, at most 120 characters. */
export const parseContact = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const one = raw.replace(/[\r\n\t]+/g, ' ').trim();
  return one ? one.slice(0, 120) : null;
};

/** Validate a closing date field: an ISO day or empty. */
export const parseClosingDay = (raw: unknown): string | null | 'invalid' => {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'invalid';
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? 'invalid' : s;
};
