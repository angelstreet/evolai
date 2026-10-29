import { describe, expect, it } from 'vitest';
import { createTranslator } from '@evolai/i18n';
import { sitePrompts, type PromptFinding } from './sitePrompts';

const f = (over: Partial<PromptFinding>): PromptFinding => ({
  label: 'A finding',
  axis: 'opportunity',
  tags: [],
  people: 5,
  status: 'approved',
  ...over,
});

describe('sitePrompts (TASK-AJ A7)', () => {
  const t = createTranslator('en');

  it('asks one question per open finding, most people first, by pattern then by axis', () => {
    const out = sitePrompts(t, [
      f({ label: 'Typed twice', tags: ['manual_reentry'], people: 6 }),
      f({ label: 'Few people', axis: 'practice', people: 3, status: 'draft' }),
      f({ label: 'Rejected', status: 'rejected', people: 9 }),
    ]);
    expect(out.map((p) => p.findings.map((x) => x.label))).toEqual([
      ['Typed twice'],
      ['Few people'],
      [],
    ]);
    expect(out[0]?.question).toBe(t('admin.brief.ask.tag.manual_reentry'));
    expect(out[1]?.question).toBe(t('admin.brief.ask.axis.practice'));
  });

  it('never prints a question twice: findings that lead to it share it', () => {
    const out = sitePrompts(t, [
      f({ label: 'Daily task', tags: ['repetitive_task'], people: 6 }),
      f({ label: 'Long task', tags: ['repetitive_task'], people: 5 }),
    ]);
    const questions = out.map((p) => p.question);
    expect(new Set(questions).size).toBe(questions.length);
    expect(out[0]?.findings.map((x) => x.label)).toEqual(['Daily task', 'Long task']);
  });

  it('ends with the standard question of the axis with the least evidence', () => {
    const out = sitePrompts(t, [f({ axis: 'literacy' })]);
    expect(out.at(-1)).toEqual({ question: t('admin.brief.ask.axis.practice'), findings: [] });
  });

  it('still asks the standard question with no finding', () => {
    expect(sitePrompts(t, [])).toHaveLength(1);
  });
});
