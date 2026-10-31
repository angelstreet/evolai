import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_KEYWORDS,
  EVIDENCE_TAGS,
  IMPROVEMENT_CATALOGUE,
  IMPROVEMENT_CATALOGUE_VERSION,
  catalogueEntry,
  improvementCategorySchema,
  improvementEntrySchema,
} from './improvementCatalogue.js';

describe('improvement catalogue', () => {
  it('has 25 to 45 valid entries with unique ids', () => {
    expect(IMPROVEMENT_CATALOGUE.length).toBeGreaterThanOrEqual(25);
    expect(IMPROVEMENT_CATALOGUE.length).toBeLessThanOrEqual(45);
    for (const e of IMPROVEMENT_CATALOGUE)
      expect(() => improvementEntrySchema.parse(e)).not.toThrow();
    expect(new Set(IMPROVEMENT_CATALOGUE.map((e) => e.id)).size).toBe(IMPROVEMENT_CATALOGUE.length);
  });

  it('covers every category, and the id prefix matches the category family', () => {
    for (const c of improvementCategorySchema.options) {
      expect(
        IMPROVEMENT_CATALOGUE.some((e) => e.category === c),
        c,
      ).toBe(true);
    }
    const prefix: Record<string, string> = {
      simplify: 'simplify',
      automate: 'automate',
      train: 'train',
      ai_assistant: 'ai',
      data_access: 'data',
      governance: 'governance',
    };
    for (const e of IMPROVEMENT_CATALOGUE) expect(e.id.split('.')[0]).toBe(prefix[e.category]);
  });

  it('is bilingual: French and English differ and French uses typographic apostrophes', () => {
    for (const e of IMPROVEMENT_CATALOGUE) {
      expect(e.title.fr).not.toBe(e.title.en);
      expect(e.description.fr).not.toBe(e.description.en);
      for (const s of [e.title.fr, e.description.fr, ...e.prerequisites.map((p) => p.fr)]) {
        expect(s, e.id).not.toMatch(/'/);
      }
    }
  });

  it('every evidence tag has keywords and is answered by at least one entry', () => {
    for (const tag of EVIDENCE_TAGS) {
      expect(EVIDENCE_KEYWORDS[tag].length, tag).toBeGreaterThan(0);
      expect(
        IMPROVEMENT_CATALOGUE.some((e) => e.evidence.includes(tag)),
        tag,
      ).toBe(true);
    }
  });

  it('holds no prices, no emoji and no product names', () => {
    const all = JSON.stringify(IMPROVEMENT_CATALOGUE);
    expect(all).not.toMatch(/[€$£]|\bEUR\b|\bUSD\b/);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/ChatGPT|Copilot|Gemini|Claude|OpenAI|Microsoft|Google/i);
  });

  it('looks entries up by id and carries a version', () => {
    expect(catalogueEntry('train.ai_basics')?.category).toBe('train');
    expect(catalogueEntry('nope.nothing')).toBeUndefined();
    expect(IMPROVEMENT_CATALOGUE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});
