import { describe, expect, it } from 'vitest';
import type { ReadinessReport } from '@evolai/contracts';
import {
  buildSnapshot,
  draftSummary,
  findingLine,
  followUpsDue,
  inList,
  repeatedTimeLines,
  measureLine,
  methodologyNote,
  findLeak,
  findingKey,
  type SnapshotInput,
  type StepRow,
  weightsSentence,
} from './reportModel';
import { createTranslator } from '@evolai/i18n';

const OPP_A = '0a000000-0000-4000-8000-00000000000a';
const OPP_B = '0b000000-0000-4000-8000-00000000000b';

const readiness: ReadinessReport = {
  overall: {
    people: 12,
    overall: 48,
    level: 'L2',
    axes: [
      { axis: 'literacy', score: 40, level: 'L2' },
      { axis: 'practice', score: 50, level: 'L2' },
      { axis: 'readiness', score: 55, level: 'L3' },
    ],
  },
  teams: [],
  hiddenTeams: 1,
  weights: { literacy: 1 / 3, practice: 1 / 3, readiness: 1 / 3 },
  minGroupSize: 5,
};

const step = (over: Partial<StepRow> & { id: string; opportunityId: string }): StepRow => ({
  catalogueId: 'train.ai_basics',
  source: 'rule',
  status: 'accepted',
  category: 'train',
  title: 'AI basics for the team',
  description: 'A short session.',
  effort: 'low',
  impact: 'medium',
  risk: 'low',
  owner: 'Training lead',
  horizon: 'd30',
  prerequisites: ['An approved AI tool'],
  tags: ['literacy_gap'],
  ...over,
});

const findings = [
  {
    key: findingKey('practice', 'Weekly report by hand'),
    axis: 'practice',
    label: 'Weekly report by hand',
    people: 7,
  },
  {
    key: findingKey('literacy', 'Unsure how to check answers'),
    axis: 'literacy',
    label: 'Unsure how to check answers',
    people: 5,
  },
];

const input = (over: Partial<SnapshotInput> = {}): SnapshotInput => ({
  version: 1,
  locale: 'en',
  title: 'Demo Client audit',
  organisation: 'Demo Client',
  publishedAt: '2026-10-19T10:00:00.000Z',
  summary: 'The team is practising. Reporting by hand is the main friction.',
  summaryCitations: [findings[0]!.key],
  readiness,
  findings,
  opportunities: [
    { id: OPP_A, title: 'Automate the weekly report', axis: 'practice', impactScore: null },
    { id: OPP_B, title: 'Train on checking answers', axis: 'literacy', impactScore: null },
  ],
  steps: [
    step({ id: '1a000000-0000-4000-8000-000000000001', opportunityId: OPP_B }),
    step({
      id: '1a000000-0000-4000-8000-000000000002',
      opportunityId: OPP_A,
      category: 'automate',
      title: 'A report that builds itself',
      impact: 'high',
      effort: 'low',
      prerequisites: ['Read access to the source data', 'an approved ai tool'],
    }),
    step({ id: '1a000000-0000-4000-8000-000000000003', opportunityId: OPP_A, status: 'rejected' }),
    step({ id: '1a000000-0000-4000-8000-000000000004', opportunityId: OPP_B, status: 'suggested' }),
  ],
  risksNote: 'Data access may take time\n\nData access may take time\nPeople need time to learn',
  methodology: 'Anonymous survey, auditor review.',
  plan: [{ id: 'p1', horizon: 'd30', text: 'Rules for AI', owner: 'Security' }],
  minGroupSize: 5,
  catalogueVersion: '2026-10-19.1',
  ...over,
});

const noLeaks = { redactionTerms: [], freeTexts: [] };

describe('report snapshot gate', () => {
  it('publishes accepted steps only, ranked, with deduplicated risks and prerequisites', () => {
    const r = buildSnapshot(input(), noLeaks);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.snapshot.steps.map((s) => s.id)).toEqual([
      '1a000000-0000-4000-8000-000000000002',
      '1a000000-0000-4000-8000-000000000001',
    ]);
    expect(r.snapshot.opportunities.map((o) => [o.title, o.rank, o.quadrant])).toEqual([
      ['Automate the weekly report', 1, 'quick_win'],
      ['Train on checking answers', 2, 'quick_win'],
    ]);
    expect(r.snapshot.risks).toEqual(['Data access may take time', 'People need time to learn']);
    expect(r.snapshot.prerequisites).toEqual([
      'Read access to the source data',
      'an approved ai tool',
    ]);
  });

  it('leaves out opportunities without an accepted step', () => {
    const r = buildSnapshot(
      input({ steps: input().steps.filter((s) => s.opportunityId === OPP_A) }),
      noLeaks,
    );
    expect(r.ok && r.snapshot.opportunities.map((o) => o.id)).toEqual([OPP_A]);
  });

  it('fails closed on a missing summary, a missing citation or an unknown citation', () => {
    expect(buildSnapshot(input({ summary: '  ' }), noLeaks)).toEqual({
      ok: false,
      code: 'summary_missing',
    });
    expect(buildSnapshot(input({ summaryCitations: [] }), noLeaks)).toEqual({
      ok: false,
      code: 'citation_missing',
    });
    expect(buildSnapshot(input({ summaryCitations: ['practice|gone'] }), noLeaks)).toEqual({
      ok: false,
      code: 'citation_unknown',
    });
  });

  it('needs at least one accepted step or one finding', () => {
    const none = input().steps.map((s) => ({ ...s, status: 'suggested' as const }));
    expect(
      buildSnapshot(input({ steps: none, findings: [], summaryCitations: [] }), noLeaks),
    ).toEqual({ ok: false, code: 'nothing_accepted' });
  });

  it('publishes a report with findings only', () => {
    const none = input().steps.map((s) => ({ ...s, status: 'suggested' as const }));
    const r = buildSnapshot(input({ steps: none }), noLeaks);
    expect(r.ok && r.snapshot.steps).toEqual([]);
    expect(r.ok && r.snapshot.findings.length).toBeGreaterThan(0);
  });

  it('refuses a name from the names-to-hide list anywhere in the text', () => {
    const r = buildSnapshot(input({ risksNote: 'Ask Demo Referent about access' }), {
      redactionTerms: ['Demo Referent'],
      freeTexts: [],
    });
    expect(r).toEqual({
      ok: false,
      code: 'contains_name',
      term: 'Demo Referent',
      excerpt: 'Ask Demo Referent about access',
    });
  });

  it('refuses six words copied from what a respondent wrote', () => {
    const freeTexts = ['Honestly I copy the numbers from the old tool every Monday morning'];
    const copied = input({
      summary: 'One person said: "copy the numbers from the old tool every Monday".',
    });
    expect(buildSnapshot(copied, { redactionTerms: [], freeTexts })).toEqual({
      ok: false,
      code: 'contains_quote',
    });
    // Five words in common is a coincidence, not a quote.
    expect(
      findLeak(['we copy the numbers from them'], { redactionTerms: [], freeTexts }),
    ).toBeNull();
  });

  it('carries aggregates only: no answer, quote, respondent code or tag in the snapshot', () => {
    const r = buildSnapshot(input(), noLeaks);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const keys = new Set<string>();
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) {
          keys.add(k);
          walk(x);
        }
    };
    walk(r.snapshot);
    expect(
      [...keys].filter((k) =>
        /quote|answer|respondent|pseudonym|submission|tags|evidence/i.test(k),
      ),
    ).toEqual([]);
    expect(JSON.stringify(r.snapshot)).not.toContain('literacy_gap');
    expect(r.snapshot.findings.every((f) => f.people >= 5)).toBe(true);
  });
});

describe('summary draft', () => {
  const words = {
    intro: (v: { people: number; score: number; level: string }) =>
      `${v.people} people answered; readiness ${v.score}/100 (${v.level}).`,
    introNoScore: 'Too few answers for a score.',
    findings: (v: { list: string }) => `Main findings: ${v.list}.`,
    opportunities: (v: { list: string }) => `First steps: ${v.list}.`,
    closing: 'Details follow.',
    closingNoSteps: 'No step yet.',
    levelName: (l: string) => `level ${l}`,
    listSep: '; ',
  };

  it('cites the findings it names, most raised first', () => {
    const d = draftSummary(readiness, findings, ['Automate the weekly report'], words);
    expect(d.text).toBe(
      '12 people answered; readiness 48/100 (level L2). Main findings: weekly report by hand; unsure how to check answers. First steps: automate the weekly report. Details follow.',
    );
    expect(d.citations).toEqual(findings.map((f) => f.key));
  });

  it('says plainly when there is no score', () => {
    const d = draftSummary({ ...readiness, overall: null }, [], [], words);
    expect(d).toEqual({ text: 'Too few answers for a score. No step yet.', citations: [] });
  });
});

describe('methodologyNote', () => {
  const w = {
    base: (v: { people: number; n: number }) => `${v.people} answered, groups of ${v.n}.`,
    themes: (v: { count: number }) => `${v.count} themes approved.`,
    opportunities: (v: { count: number }) => `${v.count} opportunities approved.`,
    unreviewed: 'Nothing approved yet.',
    visit: (v: { interviews: number; observations: number; workshops: number }) =>
      `Visit: ${v.interviews} interviews, ${v.observations} observations, ${v.workshops} workshops.`,
    disputed: (v: { count: number; corrected: number }) =>
      `${v.count} disputed, ${v.corrected} corrected.`,
  };

  it('never claims approvals that did not happen', () => {
    expect(methodologyNote({ answered: 3, themes: 0, opportunities: 0 }, 5, w)).toBe(
      '3 answered, groups of 5. Nothing approved yet.',
    );
  });

  it('states the real counts', () => {
    expect(methodologyNote({ answered: 12, themes: 2, opportunities: 1 }, 5, w)).toBe(
      '12 answered, groups of 5. 2 themes approved. 1 opportunities approved.',
    );
    expect(methodologyNote({ answered: 12, themes: 2, opportunities: 0 }, 5, w)).not.toContain(
      'opportunities approved',
    );
  });

  it('counts the visit and the referent’s disputes (TASK-AJ A6, A8)', () => {
    expect(
      methodologyNote(
        {
          answered: 12,
          themes: 2,
          opportunities: 1,
          visit: { interview: 2, observation: 1, workshop: 0 },
          disputed: 2,
          corrected: 1,
        },
        5,
        w,
      ),
    ).toBe(
      '12 answered, groups of 5. Visit: 2 interviews, 1 observations, 0 workshops. 2 themes approved. 1 opportunities approved. 2 disputed, 1 corrected.',
    );
    expect(
      methodologyNote(
        {
          answered: 12,
          themes: 2,
          opportunities: 0,
          visit: { interview: 0, observation: 0, workshop: 0 },
        },
        5,
        w,
      ),
    ).not.toContain('Visit');
  });
});

describe('weightsSentence (TASK-AJ A4)', () => {
  const t = createTranslator('en');
  const readiness = (practice: number | null) =>
    ({
      overall: {
        people: 6,
        overall: 40,
        level: 'L2',
        axes: [
          { axis: 'literacy', score: 40, level: 'L2' },
          { axis: 'practice', score: practice, level: practice === null ? null : 'L2' },
          { axis: 'readiness', score: null, level: null },
        ],
      },
      teams: [],
      hiddenTeams: 0,
      weights: { literacy: 1 / 3, practice: 1 / 3, readiness: 1 / 3 },
      minGroupSize: 5,
    }) as unknown as Parameters<typeof weightsSentence>[1];

  it('names the axes the score rests on when one has no scored answer', () => {
    expect(weightsSentence(t, readiness(null))).toBe(
      'The overall score rests on Knowledge only: the survey has no scored answer for Use, Conditions.',
    );
  });

  it('keeps the plain sentence when nothing is left out or there is no score', () => {
    const none = { ...readiness(50), overall: null } as Parameters<typeof weightsSentence>[1];
    expect(weightsSentence(t, none)).toContain('each counting for a third');
  });
});

describe('findingLine and measureLine (TASK-AJ A6, A8, A9)', () => {
  const t = createTranslator('en');

  it('never shows a count under the minimum: a visit finding says so instead', () => {
    const base = { key: 'k', axis: 'opportunity', label: 'L' };
    expect(findingLine(t, { ...base, people: 6 })).toBe('raised by 6 people');
    expect(findingLine(t, { ...base, people: 0, visit: true })).toBe('seen on the visit');
    expect(findingLine(t, { ...base, people: 6, visit: true, disputed: true })).toBe(
      'raised by 6 people · seen on the visit · disputed by the client, kept',
    );
  });

  it('writes the measure of an action, or nothing', () => {
    expect(measureLine(t, null, ': ')).toBeNull();
    expect(
      measureLine(
        t,
        {
          baselineValue: 40,
          baselineUnit: 'minutes per order',
          baselineSource: 'time sheet',
          followUpOn: '2027-01-30',
          day90Status: 'validated',
        },
        ': ',
      ),
    ).toBe(
      'Baseline: 40 minutes per order (time sheet) · Follow-up: 2027-01-30 · Day 90: Validated',
    );
  });

  it('adds the value at follow-up and the change against the baseline (ADR 0061)', () => {
    const m = {
      baselineValue: 40,
      baselineUnit: 'min',
      baselineSource: '',
      followUpOn: '2027-01-30',
      day90Status: 'validated' as const,
      followUpValue: 16,
    };
    expect(measureLine(t, m, ': ')).toBe(
      'Baseline: 40 min · Follow-up: 2027-01-30 · At follow-up: 16 min (−60%) · Day 90: Validated',
    );
    expect(measureLine(t, { ...m, baselineValue: null, baselineUnit: '' }, ': ')).toBe(
      'Follow-up: 2027-01-30 · At follow-up: 16 · Day 90: Validated',
    );
    expect(measureLine(createTranslator('fr'), { ...m, followUpValue: 50 }, '\u00a0: ')).toContain(
      'Au suivi\u00a0: 50 min (+25\u00a0%)',
    );
  });

  it('lists the follow-ups that are due and have no result yet', () => {
    const step = (id: string, followUpOn: string | null, done = false) =>
      ({
        id,
        status: 'accepted',
        measure: {
          baselineValue: 1,
          baselineUnit: '',
          baselineSource: '',
          followUpOn,
          day90Status: done ? 'validated' : null,
        },
      }) as unknown as StepRow;
    const due = followUpsDue(
      [
        step('a', '2027-01-30'),
        step('b', '2027-02-01'),
        step('c', '2027-01-01', true),
        step('d', null),
      ],
      '2027-01-31',
    );
    expect(due.map((s) => s.id)).toEqual(['a']);
  });
});

describe('repeatedTimeLines (ESN rehearsal, 2026-10-30)', () => {
  it('says hours per person, with plurals, and why teams are hidden', () => {
    const r = {
      overall: { people: 10, hoursPerWeek: 15 },
      teams: [{ team: 'Back office', people: 6, hoursPerWeek: 6, tool: 'spreadsheet' }],
      hiddenTeams: 1,
    };
    expect(repeatedTimeLines(createTranslator('en'), r, 5)).toEqual([
      '10 people: about 1.5 hours a week per person, 15 hours in all.',
      'Back office: about 1 hour a week per person (6 people), mostly in a spreadsheet.',
      '1 team is not shown to protect privacy.',
    ]);
  });
});

describe('inList', () => {
  it('lowers the first letter, keeps acronyms', () => {
    expect(inList('Les réponses d’IA sont utilisées')).toBe('les réponses d’IA sont utilisées');
    expect(inList('CV refaits à la main')).toBe('CV refaits à la main');
    expect(inList('IA et données')).toBe('IA et données');
  });
});
