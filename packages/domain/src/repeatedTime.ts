/**
 * Time on the main repeated task, per team (owner request 2026-10-29, ADR 0060): from the task
 * inventory of questionnaire v2, how often (`v2_task_frequency`) times how long each time
 * (`v2_task_duration`), summed over the people of a team. Self-reported and banded, so the result
 * is an order of magnitude, rounded, never a measurement. A team under the minimum group is hidden
 * (counted only); people who skipped either question are left out of the sum.
 */

/** Times a week, per frequency band. */
export const TIMES_PER_WEEK: Readonly<Record<string, number>> = {
  daily: 5,
  weekly: 1,
  monthly: 0.25,
  rarely: 0.05,
};

/** Hours each time, the middle of each duration band (over 3 hours counts as 4). */
export const HOURS_EACH_TIME: Readonly<Record<string, number>> = {
  lt_15m: 0.125,
  '15_60m': 0.625,
  '1_3h': 2,
  gt_3h: 4,
};

export interface InventoryAnswer {
  readonly submissionId: string;
  readonly teamId: string;
  readonly code: string;
  /** The option value chosen. */
  readonly value: string;
}

export interface TeamTime {
  readonly teamId: string;
  /** People who gave both how often and how long. */
  readonly people: number;
  /** Hours a week for the whole team, rounded to the hour. */
  readonly hoursPerWeek: number;
  /** The tool most named for the task, or null. */
  readonly tool: string | null;
}

export interface RepeatedTime {
  readonly teams: readonly TeamTime[];
  /** Teams left out because fewer than the minimum gave both answers. */
  readonly hiddenTeams: number;
  /** Every person who gave both answers, all teams; null under the minimum. */
  readonly overall: { readonly people: number; readonly hoursPerWeek: number } | null;
}

const round = (h: number): number => Math.round(h);

export const estimateRepeatedTime = (
  answers: readonly InventoryAnswer[],
  minGroup: number,
): RepeatedTime => {
  const byPerson = new Map<string, { team: string; freq?: string; dur?: string; tool?: string }>();
  for (const a of answers) {
    const p = byPerson.get(a.submissionId) ?? { team: a.teamId };
    if (a.code === 'v2_task_frequency') p.freq = a.value;
    if (a.code === 'v2_task_duration') p.dur = a.value;
    if (a.code === 'v2_task_tool') p.tool = a.value;
    byPerson.set(a.submissionId, p);
  }
  const perTeam = new Map<string, { hours: number; people: number; tools: Map<string, number> }>();
  let allHours = 0;
  let allPeople = 0;
  for (const p of byPerson.values()) {
    const times = p.freq ? TIMES_PER_WEEK[p.freq] : undefined;
    const each = p.dur ? HOURS_EACH_TIME[p.dur] : undefined;
    if (times === undefined || each === undefined) continue;
    const t = perTeam.get(p.team) ?? { hours: 0, people: 0, tools: new Map<string, number>() };
    t.hours += times * each;
    t.people += 1;
    if (p.tool && p.tool !== 'other') t.tools.set(p.tool, (t.tools.get(p.tool) ?? 0) + 1);
    perTeam.set(p.team, t);
    allHours += times * each;
    allPeople += 1;
  }
  const teams: TeamTime[] = [];
  let hiddenTeams = 0;
  for (const [teamId, t] of perTeam) {
    if (t.people < minGroup) {
      hiddenTeams += 1;
      continue;
    }
    const top = [...t.tools].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    teams.push({ teamId, people: t.people, hoursPerWeek: round(t.hours), tool: top?.[0] ?? null });
  }
  teams.sort((a, b) => b.hoursPerWeek - a.hoursPerWeek || a.teamId.localeCompare(b.teamId));
  return {
    teams,
    hiddenTeams,
    overall: allPeople >= minGroup ? { people: allPeople, hoursPerWeek: round(allHours) } : null,
  };
};
