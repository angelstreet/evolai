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
    expect(out.map((p) => p.finding)).toEqual(['Typed twice', 'Few people', null]);
    expect(out[0]?.question).toBe(t('admin.brief.ask.tag.manual_reentry'));
    expect(out[1]?.question).toBe(t('admin.brief.ask.axis.practice'));
  });

  it('ends with the standard question of the axis with the least evidence', () => {
    const out = sitePrompts(t, [f({ axis: 'literacy' })]);
    expect(out.at(-1)).toEqual({
      finding: null,
      people: 0,
      question: t('admin.brief.ask.axis.practice'),
    });
  });

  it('still asks the standard question with no finding', () => {
    expect(sitePrompts(t, [])).toHaveLength(1);
  });
});
