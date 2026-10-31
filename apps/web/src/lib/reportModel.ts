import {
  reportSnapshotSchema,
  type Horizon,
  type Level,
  type PlanItem,
  type ReadinessReport,
  type ReportFinding,
  type ReportSnapshot,
  type ReportStep,
  type RepeatedTimeReport,
  type ReportUseCase,
  type StepMeasure,
} from '@evolai/contracts';
import { estimateSaving, findingKey, rankOpportunities, uniqueLines } from '@evolai/domain';
import type { Translator } from '@evolai/i18n';

/**
 * The weighting sentence under the score (TASK-AJ A4): when an axis has no scored answer, it says
 * which axes the overall score rests on, so the reader never assumes three axes counted.
 */
export const weightsSentence = (t: Translator, readiness: ReadinessReport): string => {
  const axes = readiness.overall?.axes ?? [];
  const name = (a: (typeof axes)[number]) => t(`report.readiness.axis.${a.axis}`);
  const used = axes.filter((a) => a.score !== null).map(name);
  const unused = axes.filter((a) => a.score === null).map(name);
  if (used.length === 0 || unused.length === 0) {
    return `${t('report.readiness.weights')} ${t('report.readiness.missing')}`;
  }
  return t('report.readiness.weightsSome', { used: used.join(', '), unused: unused.join(', ') });
};

/**
 * Pure model of the audit report (TASK-V, ADR 0041): the snapshot the client sees, the publish
 * gate, and the rule-based summary draft. No database here, so every privacy rule is unit-tested.
 */

/** Stable key of an approved finding (shared with the AI worker). */
export { findingKey };

export interface StepRow {
  readonly id: string;
  readonly opportunityId: string;
  readonly catalogueId: string | null;
  readonly source: 'rule' | 'ai' | 'auditor';
  readonly status: 'suggested' | 'accepted' | 'rejected';
  readonly category: ReportStep['category'];
  readonly title: string;
  readonly description: string;
  readonly effort: Level;
  readonly impact: Level;
  readonly risk: Level;
  readonly owner: string;
  readonly horizon: Horizon;
  readonly prerequisites: readonly string[];
  readonly tags: readonly string[];
  /** Baseline and day-90 follow-up (A9); null when nothing was entered. */
  readonly measure?: StepMeasure | null;
}

/** A use case's facts as loaded, texts already in the report language (ADR 0064). */
export interface UseCaseInput {
  readonly useCaseId: string;
  readonly approach: string;
  readonly dataRule: string;
  readonly unit: string;
  readonly pinned: boolean;
  /** Most people behind one of its findings, themes from the free texts included. */
  readonly people: number;
  /** Keys of its findings that the report may list. */
  readonly findingKeys: readonly string[];
  readonly teams: string;
  readonly source: string;
  readonly volumePerWeek: number | null;
  readonly minutesPerUnit: number | null;
  readonly clientRank: number | null;
}

export interface OpportunityInput {
  readonly id: string;
  readonly title: string;
  readonly axis: string | null;
  readonly impactScore: number | null;
  readonly useCase?: UseCaseInput;
}

/** Key findings shown in the report (ADR 0064): the use cases' evidence, not every survey signal. */
export const KEY_FINDINGS_MAX = 8;

/**
 * The findings the report lists: those the summary cites, then those the use cases rest on, then
 * the most cited, at most `KEY_FINDINGS_MAX` (cited ones are always kept), in people order.
 */
export const keyFindings = (
  findings: readonly ReportFinding[],
  citations: readonly string[],
  useCaseKeys: readonly string[],
): ReportFinding[] => {
  const cited = new Set(citations);
  const evidence = new Set(useCaseKeys);
  const tier = (f: ReportFinding) => (cited.has(f.key) ? 0 : evidence.has(f.key) ? 1 : 2);
  const kept = [...findings]
    .map((f, order) => ({ f, order }))
    .sort((a, b) => tier(a.f) - tier(b.f) || a.order - b.order)
    .filter((x, i) => i < KEY_FINDINGS_MAX || tier(x.f) === 0)
    .map((x) => x.f);
  return findings.filter((f) => kept.includes(f));
};

export interface SnapshotInput {
  readonly version: number;
  readonly locale: 'fr' | 'en';
  readonly title: string;
  readonly organisation: string;
  readonly publishedAt: string;
  readonly summary: string;
  readonly summaryCitations: readonly string[];
  readonly readiness: ReadinessReport;
  readonly findings: readonly ReportFinding[];
  readonly opportunities: readonly OpportunityInput[];
  readonly steps: readonly StepRow[];
  readonly risksNote: string;
  readonly methodology: string;
  readonly plan: readonly PlanItem[];
  readonly minGroupSize: number;
  readonly catalogueVersion: string;
  /** Time on the main repeated task (ADR 0060); omitted when nobody answered it. */
  readonly repeatedTime?: RepeatedTimeReport | null;
}

/** Text the report must never contain: names to hide and what people wrote in their answers. */
export interface LeakSources {
  readonly redactionTerms: readonly string[];
  readonly freeTexts: readonly string[];
}

export type PublishCheck =
  | { ok: true; snapshot: ReportSnapshot }
  | {
      ok: false;
      code:
        | 'summary_missing'
        | 'citation_missing'
        | 'citation_unknown'
        | 'nothing_accepted'
        | 'contains_name'
        | 'contains_quote'
        | 'invalid';
      /** For `contains_name`: the name and the sentence it sits in, so the auditor can find it. */
      readonly term?: string;
      readonly excerpt?: string;
    };

const words = (s: string): string[] =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Runs of `n` consecutive words of a free text, used to spot a copied quote. */
const shingles = (s: string, n: number): string[] => {
  const w = words(s);
  const out: string[] = [];
  for (let i = 0; i + n <= w.length; i += 1) out.push(w.slice(i, i + n).join(' '));
  return out;
};

/** Six consecutive words of an answer appearing in the report count as a quote. */
export const QUOTE_WORDS = 6;

/** The sentence of `text` around the first whole-word match of `term`, at most about 80 characters. */
const excerptOf = (texts: readonly string[], term: string): string => {
  const t = words(term).join(' ');
  const hit = texts.find((x) => ` ${words(x).join(' ')} `.includes(` ${t} `)) ?? '';
  const one = hit.replace(/\s+/g, ' ').trim();
  return one.length > 80 ? `${one.slice(0, 79)}…` : one;
};

/** First name from the names-to-hide list found in the texts, with its sentence, or null. */
export const findName = (
  texts: readonly string[],
  terms: readonly string[],
): { term: string; excerpt: string } | null => {
  const body = ` ${words(texts.join(' \n ')).join(' ')} `;
  for (const term of terms) {
    const t = words(term).join(' ');
    if (t.length >= 2 && body.includes(` ${t} `)) return { term, excerpt: excerptOf(texts, term) };
  }
  return null;
};

/**
 * Where the report text leaks: a name from the tenant's "names to hide" list (whole word,
 * accents and case ignored), or six consecutive words of something a respondent wrote.
 */
export const findLeak = (
  texts: readonly string[],
  sources: LeakSources,
): 'contains_name' | 'contains_quote' | null => {
  const body = ` ${words(texts.join(' \n ')).join(' ')} `;
  for (const term of sources.redactionTerms) {
    const t = words(term).join(' ');
    if (t.length >= 2 && body.includes(` ${t} `)) return 'contains_name';
  }
  for (const free of sources.freeTexts) {
    for (const sh of shingles(free, QUOTE_WORDS)) {
      if (body.includes(` ${sh} `)) return 'contains_quote';
    }
  }
  return null;
};

export const riskLines = (note: string): string[] => uniqueLines(note.split(/\r?\n/));

/**
 * Build the frozen snapshot, or say why the report cannot be published. Fail closed: a summary
 * that cites nothing, cites a finding that is no longer approved, names a person or copies an
 * answer is refused.
 */
export const buildSnapshot = (input: SnapshotInput, leaks: LeakSources): PublishCheck => {
  const summary = input.summary.trim();
  if (!summary) return { ok: false, code: 'summary_missing' };
  const keys = new Set(input.findings.map((f) => f.key));
  const citations = [...new Set(input.summaryCitations)];
  if (input.findings.length > 0 && citations.length === 0) {
    return { ok: false, code: 'citation_missing' };
  }
  if (citations.some((c) => !keys.has(c))) return { ok: false, code: 'citation_unknown' };

  const accepted = input.steps.filter((s) => s.status === 'accepted');
  // A report may rest on findings alone; it needs at least one finding or one accepted step.
  if (accepted.length === 0 && input.findings.length === 0) {
    return { ok: false, code: 'nothing_accepted' };
  }
  const withSteps = new Set(accepted.map((s) => s.opportunityId));
  const opportunities = input.opportunities.filter((o) => withSteps.has(o.id));
  const findings = keyFindings(
    input.findings,
    citations,
    opportunities.flatMap((o) => o.useCase?.findingKeys ?? []),
  );
  const findingNo = new Map(findings.map((f, i) => [f.key, i + 1]));
  const byId = new Map(opportunities.map((o) => [o.id, o]));
  const ranked = rankOpportunities(
    opportunities.map((o) => ({
      ...o,
      pinned: o.useCase?.pinned ?? false,
      clientRank: o.useCase?.clientRank ?? null,
      steps: accepted.filter((s) => s.opportunityId === o.id),
    })),
  ).map((r) => {
    const u = byId.get(r.id)?.useCase;
    if (!u) return r;
    const e = estimateSaving(u.useCaseId, u);
    const useCase: ReportUseCase = {
      useCaseId: u.useCaseId,
      approach: u.approach.trim(),
      dataRule: u.dataRule.trim(),
      people: u.people >= input.minGroupSize ? u.people : 0,
      findingNumbers: u.findingKeys
        .map((k) => findingNo.get(k))
        .filter((n): n is number => n !== undefined)
        .sort((a, b) => a - b),
      teams: u.teams.trim(),
      unit: u.unit,
      volumePerWeek: u.volumePerWeek,
      minutesPerUnit: u.minutesPerUnit,
      hoursPerWeek: e.hoursPerWeek,
      savedLow: e.savedLow,
      savedHigh: e.savedHigh,
      measureSource: u.source.trim(),
      ratesVersion: e.ratesVersion,
      clientRank: u.clientRank,
      pinned: u.pinned,
    };
    return { ...r, useCase };
  });
  const order = new Map(ranked.map((r) => [r.id, r.rank]));
  const steps: ReportStep[] = accepted
    .filter((s) => order.has(s.opportunityId))
    .sort(
      (a, b) =>
        (order.get(a.opportunityId) ?? 0) - (order.get(b.opportunityId) ?? 0) ||
        a.horizon.localeCompare(b.horizon),
    )
    .map((s) => ({
      id: s.id,
      opportunityId: s.opportunityId,
      title: s.title.trim(),
      description: s.description.trim(),
      category: s.category,
      effort: s.effort,
      impact: s.impact,
      risk: s.risk,
      owner: s.owner.trim(),
      horizon: s.horizon,
      prerequisites: uniqueLines(s.prerequisites).slice(0, 8),
      ...(s.measure
        ? {
            measure: {
              ...s.measure,
              baselineUnit: s.measure.baselineUnit.trim(),
              baselineSource: s.measure.baselineSource.trim(),
            },
          }
        : {}),
    }));

  const candidate: ReportSnapshot = {
    version: input.version,
    locale: input.locale,
    title: input.title.trim(),
    organisation: input.organisation,
    publishedAt: input.publishedAt,
    summary,
    summaryCitations: citations,
    readiness: input.readiness,
    findings,
    opportunities: ranked,
    steps,
    risks: riskLines(input.risksNote),
    prerequisites: uniqueLines(steps.flatMap((s) => s.prerequisites)),
    plan: input.plan.filter((p) => p.text.trim()).map((p) => ({ ...p, text: p.text.trim() })),
    methodology: input.methodology.trim(),
    minGroupSize: input.minGroupSize,
    catalogueVersion: input.catalogueVersion,
    ...(input.repeatedTime && (input.repeatedTime.overall || input.repeatedTime.teams.length > 0)
      ? { repeatedTime: input.repeatedTime }
      : {}),
  };

  const reportTexts = [
    candidate.title,
    candidate.summary,
    candidate.methodology,
    ...candidate.risks,
    ...candidate.plan.flatMap((p) => [p.text, p.owner]),
    ...candidate.steps.flatMap((s) => [
      s.title,
      s.description,
      s.owner,
      ...s.prerequisites,
      s.measure?.baselineUnit ?? '',
      s.measure?.baselineSource ?? '',
    ]),
    ...candidate.opportunities.flatMap((o) => [
      o.title,
      o.useCase?.teams ?? '',
      o.useCase?.measureSource ?? '',
    ]),
  ];
  const leak = findLeak(reportTexts, leaks);
  if (leak === 'contains_name') {
    const named = findName(reportTexts, leaks.redactionTerms);
    return { ok: false, code: leak, ...(named ?? {}) };
  }
  if (leak) return { ok: false, code: leak };

  const parsed = reportSnapshotSchema.safeParse(candidate);
  return parsed.success ? { ok: true, snapshot: parsed.data } : { ok: false, code: 'invalid' };
};

/** Words for the rule-based summary draft, from the caller's i18n. */
export interface SummaryWords {
  readonly intro: (vars: { people: number; score: number; level: string }) => string;
  readonly introNoScore: string;
  readonly findings: (vars: { list: string }) => string;
  readonly opportunities: (vars: { list: string }) => string;
  readonly closing: string;
  /** Closing line when no step is accepted yet (no plan to point to). */
  readonly closingNoSteps: string;
  readonly levelName: (level: string) => string;
  /** List separator, e.g. '; ' (en) or ' ; ' with a no-break space (fr). */
  readonly listSep: string;
  /** Use cases (ADR 0064): how many and which, the hours they can save, the rule that comes first. */
  readonly useCases?: (vars: { count: number; list: string }) => string;
  readonly saving?: (vars: { low: number; high: number }) => string;
  readonly rulesFirst?: (vars: { title: string }) => string;
}

export interface SummaryUseCase {
  readonly title: string;
  readonly pinned: boolean;
  readonly savedLow: number | null;
  readonly savedHigh: number | null;
}

/**
 * A title placed inside a sentence after a colon starts lower case ("Ce qui ressort : les réponses…"),
 * unless its first word is an acronym (IA, CV, RH).
 */
export const inList = (title: string): string => {
  const first = title.split(/[\s’']/)[0] ?? '';
  return first.length > 1 && first === first.toUpperCase()
    ? title
    : title.charAt(0).toLocaleLowerCase('fr') + title.slice(1);
};

/**
 * Rule-based first draft of the executive summary. With use cases (ADR 0064): which ones, the
 * hours they can save, the rule that comes first, then what shows it and the score. Without: the
 * score, the three findings raised by the most people (cited), the two first-ranked opportunities.
 * A draft only: the auditor rewrites it.
 */
export const draftSummary = (
  readiness: ReadinessReport,
  findings: readonly ReportFinding[],
  rankedTitles: readonly string[],
  w: SummaryWords,
  useCases: readonly SummaryUseCase[] = [],
): { text: string; citations: string[] } => {
  const top = [...findings].sort((a, b) => b.people - a.people).slice(0, 3);
  const work = useCases.filter((u) => !u.pinned);
  if (work.length > 0 && w.useCases && w.saving && w.rulesFirst) {
    const parts = [
      w.useCases({ count: work.length, list: work.map((u) => inList(u.title)).join(w.listSep) }),
    ];
    const measured = work.filter((u) => u.savedLow !== null && u.savedHigh !== null);
    if (measured.length > 0) {
      parts.push(
        w.saving({
          low: measured.reduce((n, u) => n + (u.savedLow ?? 0), 0),
          high: measured.reduce((n, u) => n + (u.savedHigh ?? 0), 0),
        }),
      );
    }
    const rule = useCases.find((u) => u.pinned);
    if (rule) parts.push(w.rulesFirst({ title: inList(rule.title) }));
    if (top.length > 0) {
      parts.push(w.findings({ list: top.map((f) => inList(f.label)).join(w.listSep) }));
    }
    const o = readiness.overall;
    if (o && o.overall !== null && o.level) {
      parts.push(w.intro({ people: o.people, score: o.overall, level: w.levelName(o.level) }));
    }
    parts.push(w.closing);
    return { text: parts.join(' '), citations: top.map((f) => f.key) };
  }
  const parts: string[] = [];
  const o = readiness.overall;
  parts.push(
    o && o.overall !== null && o.level
      ? w.intro({ people: o.people, score: o.overall, level: w.levelName(o.level) })
      : w.introNoScore,
  );
  if (top.length > 0) {
    parts.push(w.findings({ list: top.map((f) => inList(f.label)).join(w.listSep) }));
  }
  if (rankedTitles.length > 0) {
    parts.push(w.opportunities({ list: rankedTitles.slice(0, 2).map(inList).join(w.listSep) }));
  }
  parts.push(rankedTitles.length > 0 ? w.closing : w.closingNoSteps);
  return { text: parts.join(' '), citations: top.map((f) => f.key) };
};

/** Words of the method note, from the caller's i18n. */
export interface MethodWords {
  readonly base: (vars: { people: number; n: number }) => string;
  readonly themes: (vars: { count: number }) => string;
  readonly opportunities: (vars: { count: number }) => string;
  readonly unreviewed: string;
  /** The visit (A6): interviews, observations and workshops noted. */
  readonly visit: (vars: { interviews: number; observations: number; workshops: number }) => string;
  /** The referent's review (A8): findings disputed, and how many were corrected. */
  readonly disputed: (vars: { count: number; corrected: number }) => string;
}

export interface MethodCounts {
  readonly answered: number;
  readonly themes: number;
  readonly opportunities: number;
  readonly visit?: { interview: number; observation: number; workshop: number };
  readonly disputed?: number;
  readonly corrected?: number;
}

/**
 * The method and privacy note, generated from what actually happened: it never says the auditor
 * approved themes or opportunities when there are none.
 */
export const methodologyNote = (
  counts: MethodCounts,
  minGroupSize: number,
  w: MethodWords,
): string => {
  const parts = [w.base({ people: counts.answered, n: minGroupSize })];
  const v = counts.visit;
  if (v && v.interview + v.observation + v.workshop > 0) {
    parts.push(
      w.visit({ interviews: v.interview, observations: v.observation, workshops: v.workshop }),
    );
  }
  if (counts.themes > 0) parts.push(w.themes({ count: counts.themes }));
  if (counts.opportunities > 0) parts.push(w.opportunities({ count: counts.opportunities }));
  if (counts.themes === 0 && counts.opportunities === 0) parts.push(w.unreviewed);
  if ((counts.disputed ?? 0) > 0) {
    parts.push(w.disputed({ count: counts.disputed ?? 0, corrected: counts.corrected ?? 0 }));
  }
  return parts.join(' ');
};

/** The lines of the "time on repeated tasks" section (ADR 0060), or an empty list. */
export const repeatedTimeLines = (
  t: Translator,
  r: RepeatedTimeReport | undefined,
  minGroupSize: number,
): string[] => {
  if (!r) return [];
  const lines: string[] = [];
  // Per person, to the half hour: a team total reads as a big number that says little.
  const each = (hours: number, people: number) => Math.round((hours / Math.max(1, people)) * 2) / 2;
  if (r.overall) {
    const { people, hoursPerWeek: hours } = r.overall;
    lines.push(t('report.time.overall', { people, hours, each: each(hours, people) }));
  }
  for (const tm of r.teams) {
    const tool = tm.tool
      ? `, ${t('report.time.tool', { tool: t(`report.time.toolName.${tm.tool as 'email'}`) })}`
      : '';
    lines.push(
      `${t('report.time.team', { team: tm.team, each: each(tm.hoursPerWeek, tm.people), people: tm.people })}${tool}.`,
    );
  }
  if (r.hiddenTeams > 0) {
    lines.push(t('report.time.hidden', { count: r.hiddenTeams, n: minGroupSize }));
  }
  return lines;
};

/** The line under a key finding: people, "seen on the visit", "disputed, kept" (A6, A8). */
export const findingLine = (t: Translator, f: ReportFinding): string =>
  [
    f.people > 0 ? t('report.findings.people', { count: f.people }) : null,
    f.visit ? t('report.findings.visit') : null,
    f.disputed ? t('report.findings.disputed') : null,
  ]
    .filter((x): x is string => x !== null)
    .join(' · ');

/** The measure line of an action (A9), or null when nothing was entered. */
export const measureLine = (
  t: Translator,
  m: StepMeasure | null | undefined,
  colon: string,
  /** Formats the YYYY-MM-DD follow-up date for the reader; ISO when omitted. */
  day: (iso: string) => string = (iso) => iso,
): string | null => {
  if (!m) return null;
  const parts: string[] = [];
  const value = [m.baselineValue ?? '', m.baselineUnit].join(' ').trim();
  if (value) {
    const source = m.baselineSource ? ` (${m.baselineSource})` : '';
    parts.push(`${t('report.steps.measure.baseline')}${colon}${value}${source}`);
  }
  if (m.followUpOn) parts.push(`${t('report.steps.measure.followUp')}${colon}${day(m.followUpOn)}`);
  if (m.followUpValue != null) {
    // Before → after (ADR 0061): the change in percent when there is a baseline to compare with.
    const after = [m.followUpValue, m.baselineUnit].join(' ').trim();
    const base = m.baselineValue;
    const pct = base ? Math.round(((m.followUpValue - base) / base) * 100) : null;
    const change =
      pct === null
        ? ''
        : ` (${t('report.steps.measure.change', { sign: pct > 0 ? '+' : pct < 0 ? '−' : '', pct: Math.abs(pct) })})`;
    parts.push(`${t('report.steps.measure.after')}${colon}${after}${change}`);
  }
  if (m.day90Status) {
    parts.push(
      `${t('report.steps.measure.day90')}${colon}${t(`report.steps.measure.status.${m.day90Status}`)}`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : null;
};

/** Accepted steps whose follow-up date has come and that have no day-90 result yet (ADR 0061). */
export const followUpsDue = (steps: readonly StepRow[], today: string): StepRow[] =>
  steps.filter(
    (s) =>
      s.status === 'accepted' &&
      s.measure?.followUpOn != null &&
      s.measure.followUpOn <= today &&
      s.measure.day90Status === null,
  );

/**
 * What each action needs first, with the action it belongs to (ESN rehearsal, 2026-10-30): a bare
 * "Both tools allow an export" says nothing without its action.
 */
export const prerequisiteLines = (
  steps: ReadonlyArray<{ title: string; prerequisites: readonly string[] }>,
  colon: string,
): string[] =>
  uniqueLines(
    steps
      .filter((st) => st.prerequisites.length > 0)
      .map(
        (st) =>
          `${st.title}${colon}${uniqueLines(st.prerequisites).join(colon === ': ' ? '; ' : '\u00a0; ')}`,
      ),
  );

/** The risk each evidence pattern points at, in the order the report lists them (ADR 0064). */
const RISK_TAGS = ['policy_unclear', 'recruiting', 'document_review'] as const;

/**
 * Risks the approved findings already show, one per line, for the auditor to edit: client data
 * with no rule, candidates' personal data, AI answers nobody checks. Empty when none applies.
 */
export const risksFromFindings = (
  t: Translator,
  findings: readonly { readonly tags: readonly string[]; readonly people: number }[],
): string =>
  RISK_TAGS.flatMap((tag) => {
    const hits = findings.filter((f) => f.tags.includes(tag));
    if (hits.length === 0) return [];
    const people = Math.max(...hits.map((f) => f.people));
    return [t(`report.risksAuto.${tag}`, { people })];
  }).join('\n');

/** Hours with the locale's decimal sign: "3,5" in French. */
const num = (locale: string, n: number): string =>
  new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 }).format(
    n,
  );

/**
 * The lines under a use case (ADR 0064), shared by the web report and the PDF: approach, time
 * today, estimated saving, evidence, data rule, the referent's priority.
 */
export const useCaseLines = (
  t: Translator,
  locale: string,
  u: ReportUseCase,
): { key: string; text: string }[] => {
  const out: { key: string; text: string }[] = [{ key: 'approach', text: u.approach }];
  if (u.hoursPerWeek !== null && u.volumePerWeek !== null && u.minutesPerUnit !== null) {
    out.push({
      key: 'today',
      text: t('report.useCases.today', {
        hours: num(locale, u.hoursPerWeek),
        volume: num(locale, u.volumePerWeek),
        unit: u.unit,
        minutes: num(locale, u.minutesPerUnit),
        teams: u.teams || '—',
      }),
    });
  } else if (!u.pinned) {
    out.push({ key: 'today', text: t('report.useCases.notMeasured') });
  }
  if (u.savedLow !== null && u.savedHigh !== null) {
    out.push({
      key: 'saving',
      text: t('report.useCases.saving', {
        low: num(locale, u.savedLow),
        high: num(locale, u.savedHigh),
      }),
    });
  }
  if (u.findingNumbers.length > 0 || u.people > 0) {
    out.push({
      key: 'evidence',
      text: t('report.useCases.evidence', {
        people: u.people,
        list: u.findingNumbers.join(', '),
        count: u.findingNumbers.length,
      }),
    });
  }
  out.push({ key: 'rule', text: t('report.useCases.dataRule', { rule: u.dataRule }) });
  if (u.clientRank !== null) {
    out.push({ key: 'rank', text: t('report.useCases.clientRank', { rank: u.clientRank }) });
  }
  return out;
};
