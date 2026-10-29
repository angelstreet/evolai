import { describe, expect, it } from 'vitest';
import { estimateRepeatedTime, type InventoryAnswer } from './repeatedTime.js';

const person = (
  id: string,
  team: string,
  freq: string | null,
  dur: string | null,
  tool = 'spreadsheet',
): InventoryAnswer[] => [
  ...(freq ? [{ submissionId: id, teamId: team, code: 'v2_task_frequency', value: freq }] : []),
  ...(dur ? [{ submissionId: id, teamId: team, code: 'v2_task_duration', value: dur }] : []),
  { submissionId: id, teamId: team, code: 'v2_task_tool', value: tool },
];

describe('estimateRepeatedTime', () => {
  it('sums how often times how long per team, rounded, with the most named tool', () => {
    const answers = [
      // Team A: five people, daily 15 to 60 min (5 x 0.625 = 3.125 h each) = 15.6 h.
      ...['a1', 'a2', 'a3', 'a4', 'a5'].map((id, i) =>
        person(id, 'A', 'daily', '15_60m', i < 3 ? 'email' : 'spreadsheet'),
      ),
      // Team B: five people, weekly 1 to 3 h (2 h each) = 10 h; one skipped how long.
      ...['b1', 'b2', 'b3', 'b4', 'b5'].map((id) => person(id, 'B', 'weekly', '1_3h')),
      ...person('b6', 'B', 'weekly', null),
      // Team C: two people only, hidden.
      ...person('c1', 'C', 'daily', 'gt_3h'),
      ...person('c2', 'C', 'daily', 'gt_3h'),
    ].flat();
    const out = estimateRepeatedTime(answers, 5);
    expect(out.teams).toEqual([
      { teamId: 'A', people: 5, hoursPerWeek: 16, tool: 'email' },
      { teamId: 'B', people: 5, hoursPerWeek: 10, tool: 'spreadsheet' },
    ]);
    expect(out.hiddenTeams).toBe(1);
    // Everyone with both answers, hidden team included: 15.625 + 10 + 40 = 65.6.
    expect(out.overall).toEqual({ people: 12, hoursPerWeek: 66 });
  });

  it('says nothing under the minimum group', () => {
    const out = estimateRepeatedTime(person('x', 'A', 'daily', '1_3h'), 5);
    expect(out).toEqual({ teams: [], hiddenTeams: 1, overall: null });
  });
});
