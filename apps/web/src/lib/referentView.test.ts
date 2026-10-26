import { describe, expect, it } from 'vitest';
import {
  effectiveCloseDay,
  addDays,
  bandOf,
  barValue,
  composeMessage,
  contactFor,
  daysUntil,
  everyoneAnswered,
  mailtoHref,
  nextStep,
  parseClosingDay,
  parseContact,
  referentParticipation,
  reminderPlan,
  whatsappHref,
  withLink,
  type Participation,
} from './referentView';

const counts = (invited: number, completed: number, started = completed) => ({
  teamId: 't',
  teamName: 'Demo team',
  invited,
  started,
  completed,
});

describe('referentParticipation (minimum group on invited AND on answered)', () => {
  it('shows nothing but the invited total under five invited', () => {
    for (const [inv, done] of [
      [1, 0],
      [3, 3],
      [4, 1],
    ] as const) {
      const p = referentParticipation(counts(inv, done));
      expect(p).toEqual({ kind: 'hidden', teamId: 't', teamName: 'Demo team', invited: inv });
      expect(JSON.stringify(p)).not.toMatch(/completed|started|band|rate/);
    }
  });

  it('gives a coarse band, never a count, while fewer than five answered', () => {
    expect(referentParticipation(counts(24, 0))).toMatchObject({ kind: 'band', band: 'none' });
    expect(referentParticipation(counts(24, 1))).toMatchObject({ kind: 'band', band: 'some' });
    expect(referentParticipation(counts(8, 4))).toMatchObject({ kind: 'band', band: 'most' });
    const p = referentParticipation(counts(6, 4, 5));
    expect(p.kind).toBe('band');
    expect(JSON.stringify(p)).not.toMatch(/completed|started|rate/);
  });

  it('gives exact counts from five answers', () => {
    expect(referentParticipation(counts(24, 12, 15))).toEqual({
      kind: 'exact',
      teamId: 't',
      teamName: 'Demo team',
      invited: 24,
      started: 15,
      completed: 12,
      rate: 50,
    });
    expect(referentParticipation(counts(5, 5)).kind).toBe('exact');
  });

  it('a single answer never changes a hidden team, and moves a band only coarsely', () => {
    const before = referentParticipation(counts(4, 2));
    const after = referentParticipation(counts(4, 3));
    expect(after).toEqual(before);
    expect(referentParticipation(counts(20, 2))).toEqual(referentParticipation(counts(20, 3)));
  });

  it('bands and bars', () => {
    expect(bandOf(0, 10)).toBe('none');
    expect(bandOf(4, 10)).toBe('some');
    expect(bandOf(5, 10)).toBe('most');
    expect(barValue(referentParticipation(counts(3, 1)))).toBeNull();
    expect(barValue(referentParticipation(counts(10, 0)))).toBe(0);
    expect(barValue(referentParticipation(counts(10, 7)))).toBe(70);
  });
});

describe('everyoneAnswered', () => {
  it('is true only when every team has exact counts and all answered', () => {
    const exact = (i: number, c: number) => referentParticipation(counts(i, c));
    expect(everyoneAnswered([exact(6, 6)])).toBe(true);
    expect(everyoneAnswered([exact(6, 6), exact(3, 3)])).toBe(false);
    expect(everyoneAnswered([exact(6, 5)])).toBe(false);
    expect(everyoneAnswered([])).toBe(false);
  });
});

describe('dates', () => {
  it('adds and counts whole UTC days', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysUntil('2026-11-02', '2026-10-30')).toBe(3);
    expect(daysUntil('2026-10-29', '2026-10-30')).toBe(-1);
  });
});

describe('reminderPlan', () => {
  const base = { schedule: [3, 7] as const, firstLinkOn: '2026-10-01' };

  it('suggests a week and two days before closing, after the first link', () => {
    const p = reminderPlan({ ...base, closesOn: '2026-10-31', today: '2026-10-10' });
    expect(p.dates).toEqual(['2026-10-24', '2026-10-29']);
    expect(p.next).toBe('2026-10-24');
    expect(p.due).toBe(false);
  });

  it('is due on a suggested day and the day after, not every day after', () => {
    const at = (today: string) => reminderPlan({ ...base, closesOn: '2026-10-31', today }).due;
    expect(at('2026-10-24')).toBe(true);
    expect(at('2026-10-25')).toBe(true);
    expect(at('2026-10-26')).toBe(false);
    expect(at('2026-10-29')).toBe(true);
  });

  it('is never due after closing', () => {
    const p = reminderPlan({ ...base, closesOn: '2026-10-05', today: '2026-10-06' });
    expect(p.due).toBe(false);
  });

  it('short window: the day before closing', () => {
    expect(reminderPlan({ ...base, closesOn: '2026-10-04', today: '2026-10-02' }).dates).toEqual([
      '2026-10-02',
    ]);
    expect(reminderPlan({ ...base, closesOn: '2026-10-03', today: '2026-10-02' }).dates).toEqual([
      '2026-10-02',
    ]);
    expect(reminderPlan({ ...base, closesOn: '2026-10-02', today: '2026-10-01' }).dates).toEqual(
      [],
    );
  });

  it('without a closing date, uses the schedule from the first link', () => {
    const p = reminderPlan({ ...base, closesOn: null, today: '2026-10-04' });
    expect(p.dates).toEqual(['2026-10-04', '2026-10-08']);
    expect(p.due).toBe(true);
  });

  it('no links, no plan', () => {
    expect(
      reminderPlan({ schedule: [3], firstLinkOn: null, closesOn: null, today: '2026-10-04' }),
    ).toEqual({ dates: [], next: null, due: false });
  });
});

describe('nextStep', () => {
  const due = { dates: ['2026-10-24'], next: '2026-10-24', due: true };
  const notDue = { dates: ['2026-10-24'], next: '2026-10-24', due: false };
  const p = (i: number, c: number): Participation => referentParticipation(counts(i, c));

  it('create, share, remind, wait, results', () => {
    expect(nextStep({ status: 'draft', rows: [p(0, 0)], hasResults: false, plan: notDue })).toBe(
      'create',
    );
    expect(nextStep({ status: 'in_field', rows: [p(8, 1)], hasResults: false, plan: notDue })).toBe(
      'share',
    );
    expect(nextStep({ status: 'in_field', rows: [p(8, 1)], hasResults: false, plan: due })).toBe(
      'remind',
    );
    expect(nextStep({ status: 'in_field', rows: [p(6, 6)], hasResults: false, plan: due })).toBe(
      'wait',
    );
    expect(nextStep({ status: 'analysis', rows: [p(6, 3)], hasResults: false, plan: due })).toBe(
      'wait',
    );
    expect(nextStep({ status: 'closed', rows: [], hasResults: false, plan: due })).toBe('results');
    expect(nextStep({ status: 'review', rows: [], hasResults: true, plan: due })).toBe('results');
  });

  it('a reminder is not offered before the survey opens', () => {
    expect(nextStep({ status: 'scheduled', rows: [p(8, 0)], hasResults: false, plan: due })).toBe(
      'share',
    );
  });
});

describe('messages and share links', () => {
  const copy = {
    greeting: 'Hello,',
    what: 'What.',
    time: 'Time.',
    anonymous: 'Anonymous.',
    closes: 'Closes.',
    contact: 'Contact.',
    thanks: 'Thanks:',
  };

  it('drops the closing and contact lines when unknown', () => {
    expect(composeMessage(copy, { closesOn: null, contact: null })).toBe(
      'Hello,\n\nWhat.\nTime.\nAnonymous.\n\nThanks:',
    );
    expect(composeMessage(copy, { closesOn: '2026-10-31', contact: 'Demo Referent' })).toContain(
      'Closes.\nContact.',
    );
  });

  it('appends the link, and builds mailto and wa.me without any address or number', () => {
    const text = withLink('Hi & bye?', 'https://example.test/s/abc.def');
    expect(text).toBe('Hi & bye?\n\nhttps://example.test/s/abc.def');
    const mail = mailtoHref('Survey', text);
    expect(mail.startsWith('mailto:?subject=Survey&body=')).toBe(true);
    expect(decodeURIComponent(mail.split('body=')[1] ?? '')).toBe(text);
    const wa = whatsappHref(text);
    expect(wa.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(wa.split('text=')[1] ?? '')).toBe(text);
  });

  it('contact: configured, else the referent, one line', () => {
    expect(contactFor('Demo Contact', 'Demo Referent')).toBe('Demo Contact');
    expect(contactFor(null, 'Demo Referent')).toBe('Demo Referent');
    expect(contactFor('  ', null)).toBeNull();
    expect(parseContact('Demo\nContact')).toBe('Demo Contact');
    expect(parseContact('x'.repeat(200))).toHaveLength(120);
    expect(parseContact(42)).toBeNull();
  });

  it('closing day: ISO day, empty, or invalid', () => {
    expect(parseClosingDay('2026-10-31')).toBe('2026-10-31');
    expect(parseClosingDay('')).toBeNull();
    expect(parseClosingDay('2026-02-30')).toBe('invalid');
    expect(parseClosingDay('31/10/2026')).toBe('invalid');
  });
});

describe('effectiveCloseDay (message date = earlier of closing day and link expiry)', () => {
  it('takes the earlier date', () => {
    expect(effectiveCloseDay('2026-11-20', '2026-11-05')).toBe('2026-11-05');
    expect(effectiveCloseDay('2026-11-03', '2026-11-05')).toBe('2026-11-03');
  });
  it('falls back to whichever exists', () => {
    expect(effectiveCloseDay('2026-11-20', null)).toBe('2026-11-20');
    expect(effectiveCloseDay(null, '2026-11-05')).toBe('2026-11-05');
    expect(effectiveCloseDay(null, null)).toBeNull();
  });
});
