import type { Horizon, Level, PlanItem, Quadrant, ReportOpportunity } from '@evolai/contracts';

/**
 * Deterministic parts of the audit report (TASK-V, ADR 0041): the impact versus effort matrix,
 * the ranked opportunity list, the default timing of a step, and the 30/60/90-day plan built from
 * the accepted steps. Words come from the caller (i18n); this module only orders and groups.
 */

const LEVEL_VALUE: Readonly<Record<Level, number>> = { low: 1, medium: 2, high: 3 };

export const levelValue = (l: Level): number => LEVEL_VALUE[l];

/** Auditor's 0..1 impact score as a level: below 0.34 low, below 0.67 medium, else high. */
export const impactLevelFromScore = (score: number): Level =>
  score >= 0.67 ? 'high' : score >= 0.34 ? 'medium' : 'low';

/**
 * Matrix quadrant. Impact counts as high when it is medium or high; effort counts as low only
 * when it is low. So: quick win, big bet, fill-in, or reconsider.
 */
export const quadrantFor = (impact: Level, effort: Level): Quadrant => {
  const highImpact = impact !== 'low';
  const lowEffort = effort === 'low';
  if (highImpact) return lowEffort ? 'quick_win' : 'big_bet';
  return lowEffort ? 'fill_in' : 'reconsider';
};

/** Default timing: low effort in 30 days, medium in 60, high in 90; a high risk waits one step. */
export const defaultHorizon = (effort: Level, risk: Level): Horizon => {
  const base = levelValue(effort) + (risk === 'high' ? 1 : 0);
  return base <= 1 ? 'd30' : base === 2 ? 'd60' : 'd90';
};

export interface RankInput {
  readonly id: string;
  readonly title: string;
  readonly axis: string | null;
  /** Auditor's 0..1 impact score on the opportunity, if set. */
  readonly impactScore: number | null;
  /** Accepted steps of this opportunity. */
  readonly steps: readonly { impact: Level; effort: Level; category?: string }[];
}

/**
 * Impact is the auditor's score when set, else the highest impact of its accepted steps, else
 * medium. Effort is the lowest effort among its accepted steps (the first move), else medium.
 * Priority = 2 x impact - effort; ties keep the input order.
 */
export const rankOpportunities = (items: readonly RankInput[]): ReportOpportunity[] =>
  items
    .map((o, order) => {
      const impact: Level =
        o.impactScore !== null
          ? impactLevelFromScore(o.impactScore)
          : o.steps.length > 0
            ? o.steps.reduce<Level>(
                (m, s) => (levelValue(s.impact) > levelValue(m) ? s.impact : m),
                'low',
              )
            : 'medium';
      const effort: Level =
        o.steps.length > 0
          ? o.steps.reduce<Level>(
              (m, s) => (levelValue(s.effort) < levelValue(m) ? s.effort : m),
              'high',
            )
          : 'medium';
      return {
        o,
        impact,
        effort,
        order,
        priority: 2 * levelValue(impact) - levelValue(effort),
        rules: o.steps.some((s) => s.category === 'governance') ? 1 : 0,
      };
    })
    // At equal priority, rules on data come first: they protect clients before anything else
    // changes (ESN pilot rehearsal, ADR 0062).
    .sort((a, b) => b.priority - a.priority || b.rules - a.rules || a.order - b.order)
    .map((r, i) => ({
      id: r.o.id,
      rank: i + 1,
      title: r.o.title,
      axis: r.o.axis,
      impact: r.impact,
      effort: r.effort,
      quadrant: quadrantFor(r.impact, r.effort),
    }));

export interface PlanStepInput {
  readonly id: string;
  readonly title: string;
  readonly owner: string;
  readonly horizon: Horizon;
  readonly category?: string;
}

const HORIZONS: readonly Horizon[] = ['d30', 'd60', 'd90'];

/**
 * 30/60/90-day plan from the accepted steps, in step order, followed in each horizon by the
 * checkpoint of PRD §30.3 (day 30 usability, day 60 early evidence, day 90 keep, adapt or stop).
 */
export const buildPlan = (
  steps: readonly PlanStepInput[],
  checkpoints: Readonly<Record<Horizon, { text: string; owner: string }>>,
): PlanItem[] => {
  const out: PlanItem[] = [];
  for (const h of HORIZONS) {
    // Rules first in each horizon (ADR 0062), then step order.
    const inH = steps.filter((x) => x.horizon === h);
    const ordered = [
      ...inH.filter((x) => x.category === 'governance'),
      ...inH.filter((x) => x.category !== 'governance'),
    ];
    for (const s of ordered) {
      out.push({ id: `step-${s.id}`.slice(0, 40), horizon: h, text: s.title, owner: s.owner });
    }
    out.push({
      id: `check-${h}`,
      horizon: h,
      text: checkpoints[h].text,
      owner: checkpoints[h].owner,
    });
  }
  return out;
};

/** Unique, trimmed, non-empty lines in first-seen order. */
export const uniqueLines = (lines: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const l = raw.trim();
    const k = l.toLowerCase();
    if (!l || seen.has(k)) continue;
    seen.add(k);
    out.push(l);
  }
  return out;
};
