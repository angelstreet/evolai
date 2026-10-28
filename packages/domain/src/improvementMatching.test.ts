import { describe, expect, it } from 'vitest';
import { IMPROVEMENT_CATALOGUE } from '@evolai/contracts';
import { matchImprovements, normaliseText, tagsInText } from './improvementMatching.js';

describe('improvement matching', () => {
  it('normalises accents, case and apostrophes', () => {
    expect(normaliseText('Pas à l’aise, RÉDIGER')).toBe(' pas a l aise rediger ');
  });

  it('finds evidence tags in French and English text', () => {
    expect(tagsInText('We copy and paste figures into the weekly report')).toEqual(
      expect.arrayContaining(['manual_reentry', 'reporting']),
    );
    expect(tagsInText('Double saisie dans deux outils, chaque jour')).toEqual(
      expect.arrayContaining(['manual_reentry', 'repetitive_task']),
    );
    expect(tagsInText('Les chiffres sont copiés et collés dans le rapport chaque semaine')).toEqual(
      expect.arrayContaining(['manual_reentry', 'repetitive_task', 'reporting']),
    );
    expect(tagsInText('Mes collègues m’aident')).not.toContain('manual_reentry');
    expect(tagsInText('Nothing relevant here')).toEqual([]);
  });

  it('proposes automation and single-entry steps for manual re-entry', () => {
    const m = matchImprovements({
      title: 'Manual re-entry of orders',
      description: 'People copy and paste the same order into two tools every day.',
      axis: 'opportunity',
    });
    expect(m.map((x) => x.entry.id).slice(0, 2)).toEqual([
      'automate.transfer_between_tools',
      'simplify.remove_double_entry',
    ]);
    expect(m).toHaveLength(3);
    expect(m[0]?.tags).toEqual(expect.arrayContaining(['manual_reentry', 'repetitive_task']));
  });

  it('uses the axis as a weaker hint when the text says nothing', () => {
    const m = matchImprovements({ title: 'Theme', description: '', axis: 'literacy' });
    expect(m.length).toBeGreaterThan(0);
    expect(m.every((x) => x.entry.evidence.includes('literacy_gap'))).toBe(true);
    expect(m.every((x) => x.score === 1)).toBe(true);
  });

  it('reads the linked finding labels too', () => {
    const m = matchImprovements({
      title: 'Team request',
      description: '',
      axis: null,
      findingLabels: ['Comptes rendus de réunion longs à rédiger'],
    });
    expect(m[0]?.entry.id).toBe('ai.meeting_notes');
  });

  it('takes the evidence patterns of linked findings as given', () => {
    const m = matchImprovements({
      title: 'Zzz',
      description: '',
      axis: null,
      tags: ['manual_reentry'],
    });
    expect(m.length).toBeGreaterThan(0);
    expect(m.every((x) => x.tags.includes('manual_reentry'))).toBe(true);
    expect(m[0]?.score).toBe(2);
  });

  it('returns nothing when nothing matches, and respects the limit', () => {
    expect(matchImprovements({ title: 'Zzz', description: '', axis: null })).toEqual([]);
    const many = matchImprovements(
      { title: 'report copy paste email meeting', description: '', axis: 'readiness' },
      5,
    );
    expect(many).toHaveLength(5);
  });

  it('is stable: same input, same order', () => {
    const input = { title: 'Weekly report by hand', description: 'excel', axis: 'practice' };
    expect(matchImprovements(input)).toEqual(matchImprovements(input));
    expect(IMPROVEMENT_CATALOGUE.length).toBeGreaterThan(0);
  });
});
