import { describe, expect, it } from 'vitest';
import {
  SetupError,
  dayEnd,
  dayOf,
  dayStart,
  parseDay,
  parseEngagementForm,
  parseName,
  parseTeamSize,
} from './setupForm';

const TEAM = '11111111-1111-4111-8111-111111111111';
const form = (o: Record<string, string | string[]>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o))
    for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
};

describe('parseName', () => {
  it('trims and collapses spaces, keeps accents', () => {
    expect(parseName('  Audit   de  printemps ')).toBe('Audit de printemps');
    expect(parseName('Équipe pilote')).toBe('Équipe pilote');
  });
  it('refuses empty and too long', () => {
    expect(parseName('   ')).toBeNull();
    expect(parseName('x'.repeat(121))).toBeNull();
    expect(parseName('x'.repeat(120))).not.toBeNull();
  });
});

describe('parseTeamSize', () => {
  it('accepts whole numbers 0 to 10000', () => {
    expect(parseTeamSize('0')).toBe(0);
    expect(parseTeamSize(' 25 ')).toBe(25);
    expect(parseTeamSize('10000')).toBe(10000);
  });
  it('refuses the rest', () => {
    for (const bad of ['', '-1', '1.5', '10001', 'abc', '1e3'])
      expect(parseTeamSize(bad)).toBeNull();
  });
});

describe('parseDay and day bounds', () => {
  it('accepts real calendar days and empty', () => {
    expect(parseDay('2026-10-19')).toBe('2026-10-19');
    expect(parseDay('')).toBe('');
  });
  it('refuses impossible days', () => {
    expect(parseDay('2026-02-30')).toBeNull();
    expect(parseDay('19/10/2026')).toBeNull();
  });
  it('covers both the opening and the closing day in full', () => {
    expect(dayStart('2026-10-19')).toBe('2026-10-19T00:00:00.000Z');
    expect(dayEnd('2026-10-19')).toBe('2026-10-19T23:59:59.000Z');
    expect(dayStart(null)).toBeNull();
    expect(dayOf('2026-10-19T23:59:59.000Z')).toBe('2026-10-19');
    expect(dayOf(null)).toBe('');
  });
});

describe('parseEngagementForm', () => {
  const ok = { name: 'Spring audit', locale: 'fr', opensOn: '2026-10-19', closesOn: '2026-11-02' };
  it('reads a valid form', () => {
    expect(parseEngagementForm(form({ ...ok, teamId: [TEAM, TEAM] }))).toEqual({
      name: 'Spring audit',
      locale: 'fr',
      opensOn: '2026-10-19',
      closesOn: '2026-11-02',
      teamIds: [TEAM],
    });
  });
  it('allows no dates and no teams', () => {
    const r = parseEngagementForm(form({ name: 'A', locale: 'en', opensOn: '', closesOn: '' }));
    expect(r.opensOn).toBeNull();
    expect(r.teamIds).toEqual([]);
  });
  const code = (o: Record<string, string | string[]>): string => {
    try {
      parseEngagementForm(form(o));
    } catch (e) {
      return e instanceof SetupError ? e.code : 'other';
    }
    return 'none';
  };
  it('names the problem', () => {
    expect(code({ ...ok, name: '' })).toBe('bad_name');
    expect(code({ ...ok, locale: 'de' })).toBe('bad_locale');
    expect(code({ ...ok, closesOn: '2026-10-01' })).toBe('bad_dates');
    expect(code({ ...ok, opensOn: 'soon' })).toBe('bad_dates');
    expect(code({ ...ok, teamId: 'not-an-id' })).toBe('bad_id');
  });
});

describe('parseEngagementForm: kind and mode (ADR 0065)', () => {
  const ok = { name: 'Spring audit', locale: 'fr', opensOn: '', closesOn: '' };
  const codeOf = (o: Record<string, string>): string => {
    try {
      parseEngagementForm(form(o));
      return 'ok';
    } catch (e) {
      return e instanceof SetupError ? e.code : 'other';
    }
  };
  it('the edit form sends no kind: no shape, the stored one is kept', () => {
    expect(parseEngagementForm(form(ok)).shape).toBeUndefined();
  });
  it('reads a team interview and a team survey', () => {
    expect(parseEngagementForm(form({ ...ok, kind: 'team', mode: 'interview' })).shape).toEqual({
      kind: 'team',
      mode: 'interview',
    });
    expect(parseEngagementForm(form({ ...ok, kind: 'team', mode: 'survey' })).shape).toEqual({
      kind: 'team',
      mode: 'survey',
    });
  });
  it('a governance audit is an interview, whatever mode is sent', () => {
    expect(parseEngagementForm(form({ ...ok, kind: 'governance' })).shape).toEqual({
      kind: 'governance',
      mode: 'interview',
    });
    expect(
      parseEngagementForm(form({ ...ok, kind: 'governance', mode: 'survey' })).shape?.mode,
    ).toBe('interview');
  });
  it('refuses an unknown kind and a team without a mode', () => {
    expect(codeOf({ ...ok, kind: 'company', mode: 'survey' })).toBe('bad_kind');
    expect(codeOf({ ...ok, kind: 'team' })).toBe('bad_kind');
    expect(codeOf({ ...ok, kind: 'team', mode: 'robot' })).toBe('bad_kind');
  });
});
