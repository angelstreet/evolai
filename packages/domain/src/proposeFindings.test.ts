import { describe, expect, it } from 'vitest';
import { proposeFindings, type MissionAnswer } from './proposeFindings.js';

/** A synthetic team of 12: each person answers the scenarios and one repeated-task text. */
const team = (): MissionAnswer[] => {
  const out: MissionAnswer[] = [];
  for (let p = 1; p <= 12; p += 1) {
    const s = `s${p}`;
    const c = (code: string, value: string) =>
      out.push({ answerId: `${s}-${code}`, submissionId: s, code, kind: 'choice', value });
    c('v1_data_sharing', p <= 5 ? 'paste_directly' : 'check_rules');
    c('v1_source_check', p <= 2 ? 'use_as_is' : 'check_source');
    c('v1_repeat_time', p <= 7 ? 'gt_6h' : 'lt_1h');
    c('v1_request_style', p <= 6 ? 'unsure' : 'full_brief');
    out.push({
      answerId: `${s}-v1_repeat_task`,
      submissionId: s,
      code: 'v1_repeat_task',
      kind: 'text',
      value: p <= 6 ? 'Copying the same rows by hand into the order tool.' : 'Nothing special.',
    });
  }
  return out;
};

describe('proposeFindings', () => {
  it('proposes choice, unsure and free-text findings for a team of 12, each with its evidence', () => {
    const out = proposeFindings(team());
    const by = new Map(out.map((f) => [f.ruleKey, f]));
    expect(by.get('choice:v1_repeat_time')).toMatchObject({ people: 7, total: 12 });
    expect(by.get('choice:v1_data_sharing')).toMatchObject({ people: 5, axis: 'readiness' });
    expect(by.get('choice:v1_data_sharing')?.answerIds).toHaveLength(5);
    expect(by.get('unsure:v1_request_style')).toMatchObject({ people: 6 });
    expect(by.get('tag:manual_reentry')).toMatchObject({ people: 6, tags: ['manual_reentry'] });
    expect(
      by.get('tag:manual_reentry')?.answerIds.every((id) => id.endsWith('v1_repeat_task')),
    ).toBe(true);
    // Two people are under the minimum: no proposal.
    expect(by.has('choice:v1_source_check')).toBe(false);
    // Most people first.
    expect(out[0]?.people).toBe(7);
  });

  it('counts people, not answers', () => {
    const a = (id: string, s: string): MissionAnswer => ({
      answerId: id,
      submissionId: s,
      code: 'v1_missing_tool',
      kind: 'text',
      value: 'copy paste',
    });
    const out = proposeFindings([a('1', 's1'), a('2', 's1'), a('3', 's1'), a('4', 's2')]);
    expect(out).toEqual([]);
    expect(proposeFindings([a('1', 's1'), a('2', 's2')], { minCount: 2 })[0]?.people).toBe(2);
  });

  it('proposes nothing from nothing', () => {
    expect(proposeFindings([])).toEqual([]);
  });
});
