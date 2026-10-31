import { describe, expect, it } from 'vitest';
import type { ReadinessReport } from '@evolai/contracts';
import { createTranslator } from '@evolai/i18n';
import {
  KEY_FINDINGS_MAX,
  buildSnapshot,
  draftSummary,
  findingKey,
  keyFindings,
  risksFromFindings,
  useCaseLines,
  type SnapshotInput,
  type UseCaseInput,
} from './reportModel';

const OPP_RULE = '0a000000-0000-4000-8000-00000000000a';
const OPP_CV = '0b000000-0000-4000-8000-00000000000b';
const OPP_TENDER = '0c000000-0000-4000-8000-00000000000c';

const readiness: ReadinessReport = {
  overall: null,
  teams: [],
  hiddenTeams: 0,
  weights: { literacy: 1 / 3, practice: 1 / 3, readiness: 1 / 3 },
  minGroupSize: 5,
};

const f = (label: string, people: number) => ({
  key: findingKey('opportunity', label),
  axis: 'opportunity',
  label,
  people,
});
const findings = Array.from({ length: 11 }, (_, i) => f(`Finding ${i + 1}`, 20 - i));

const uc = (o: Partial<UseCaseInput> & { useCaseId: string }): UseCaseInput => ({
  approach: 'Approach.',
  dataRule: 'Rule.',
  unit: 'CV',
  pinned: false,
  people: 7,
  findingKeys: [],
  teams: '',
  source: '',
  volumePerWeek: null,
  minutesPerUnit: null,
  clientRank: null,
  ...o,
});

const step = (id: string, opportunityId: string, category = 'ai_assistant' as const) => ({
  id,
  opportunityId,
  catalogueId: null,
  source: 'rule' as const,
  status: 'accepted' as const,
  category,
  title: 'Step',
  description: '',
  effort: 'low' as const,
  impact: 'high' as const,
  risk: 'low' as const,
  owner: 'Lead',
  horizon: 'd30' as const,
  prerequisites: [],
  tags: [],
});

const input = (over: Partial<SnapshotInput> = {}): SnapshotInput => ({
  version: 1,
  locale: 'en',
  title: 'Audit',
  organisation: 'Org',
  publishedAt: '2026-10-31T10:00:00.000Z',
  summary: 'Summary.',
  summaryCitations: [findings[10]!.key],
  readiness,
  findings,
  opportunities: [
    {
      id: OPP_CV,
      title: 'Adapt CVs',
      axis: 'opportunity',
      impactScore: null,
      useCase: uc({
        useCaseId: 'uc.cv_tailoring',
        findingKeys: [findings[9]!.key],
        volumePerWeek: 12,
        minutesPerUnit: 45,
        teams: 'Business managers',
      }),
    },
    {
      id: OPP_TENDER,
      title: 'Answer tenders',
      axis: 'opportunity',
      impactScore: null,
      useCase: uc({ useCaseId: 'uc.tender_drafting', clientRank: 1 }),
    },
    {
      id: OPP_RULE,
      title: 'Client data rules',
      axis: 'opportunity',
      impactScore: null,
      useCase: uc({ useCaseId: 'uc.ai_data_charter', pinned: true }),
    },
  ],
  steps: [
    step('1a000000-0000-4000-8000-000000000001', OPP_CV),
    step('1a000000-0000-4000-8000-000000000002', OPP_TENDER),
    step('1a000000-0000-4000-8000-000000000003', OPP_RULE, 'governance' as never),
  ],
  risksNote: '',
  methodology: 'Method.',
  plan: [],
  minGroupSize: 5,
  catalogueVersion: '2026-10-31.1',
  ...over,
});

const noLeaks = { redactionTerms: [], freeTexts: [] };

describe('report built on use cases (ADR 0064)', () => {
  it('ranks the data rule first, then the referent order, and carries time and saving', () => {
    const r = buildSnapshot(input(), noLeaks);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.snapshot.opportunities.map((o) => o.title)).toEqual([
      'Client data rules',
      'Answer tenders',
      'Adapt CVs',
    ]);
    const cv = r.snapshot.opportunities[2]!.useCase!;
    expect(cv.hoursPerWeek).toBe(9);
    expect([cv.savedLow, cv.savedHigh]).toEqual([3.5, 5.5]);
    expect(r.snapshot.opportunities[0]!.useCase!.savedLow).toBeNull();
  });

  it('lists at most the cap, keeping cited findings and the use cases’ evidence', () => {
    const r = buildSnapshot(input(), noLeaks);
    if (!r.ok) throw new Error(r.code);
    const labels = r.snapshot.findings.map((x) => x.label);
    expect(labels.length).toBeLessThanOrEqual(KEY_FINDINGS_MAX + 1);
    expect(labels).toContain('Finding 11');
    expect(labels).toContain('Finding 10');
    const cv = r.snapshot.opportunities.find((o) => o.title === 'Adapt CVs')!.useCase!;
    expect(cv.findingNumbers).toEqual([labels.indexOf('Finding 10') + 1]);
    expect(keyFindings(findings, [], []).length).toBe(KEY_FINDINGS_MAX);
  });

  it('refuses a name to hide in what the auditor wrote about a use case', () => {
    const named = input();
    const cv = named.opportunities[0]!;
    const r = buildSnapshot(
      {
        ...named,
        opportunities: [{ ...cv, useCase: { ...cv.useCase!, source: 'visit with Jo Example' } }],
      },
      { redactionTerms: ['Jo Example'], freeTexts: [] },
    );
    expect(r).toMatchObject({ ok: false, code: 'contains_name' });
  });

  it('words the lines, French decimals included', () => {
    const r = buildSnapshot(input(), noLeaks);
    if (!r.ok) throw new Error(r.code);
    const cv = r.snapshot.opportunities.find((o) => o.title === 'Adapt CVs')!.useCase!;
    const fr = useCaseLines(createTranslator('fr'), 'fr', cv).map((l) => l.text);
    expect(fr.join(' | ')).toContain('3,5 à 5,5 heures par semaine');
    const en = useCaseLines(createTranslator('en'), 'en', cv).map((l) => l.key);
    expect(en).toEqual(['approach', 'today', 'saving', 'evidence', 'rule']);
  });

  it('drafts the summary from the use cases and the hours', () => {
    const t = createTranslator('en');
    const d = draftSummary(
      readiness,
      findings.slice(0, 3),
      [],
      {
        intro: (v) => t('report.draft.intro', v),
        introNoScore: t('report.draft.introNoScore'),
        findings: (v) => t('report.draft.findings', v),
        opportunities: (v) => t('report.draft.opportunities', v),
        closing: t('report.draft.closing'),
        closingNoSteps: t('report.draft.closingNoSteps'),
        listSep: t('report.draft.listSep'),
        levelName: (l) => l,
        useCases: (v) => t('report.draft.useCases', v),
        saving: (v) => t('report.draft.saving', v),
        rulesFirst: (v) => t('report.draft.rulesFirst', v),
      },
      [
        { title: 'Client data rules', pinned: true, savedLow: null, savedHigh: null },
        { title: 'Adapt CVs', pinned: false, savedLow: 3.5, savedHigh: 5.5 },
        { title: 'Answer tenders', pinned: false, savedLow: null, savedHigh: null },
      ],
    );
    expect(d.text).toContain('2 pieces of work');
    expect(d.text).toContain('3.5 to 5.5 hours a week');
    expect(d.text).toContain('First: client data rules.');
    expect(d.citations).toHaveLength(3);
  });

  it('starts the risks from the findings', () => {
    const t = createTranslator('en');
    const risks = risksFromFindings(t, [
      { tags: ['policy_unclear'], people: 7 },
      { tags: ['recruiting'], people: 5 },
      { tags: ['manual_reentry'], people: 16 },
    ]).split('\n');
    expect(risks).toHaveLength(2);
    expect(risks[0]).toContain('7 people say');
    expect(risksFromFindings(t, [])).toBe('');
  });
});
