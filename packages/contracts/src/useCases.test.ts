import { describe, expect, it } from 'vitest';
import { catalogueEntry } from './improvementCatalogue.js';
import {
  SAVING_RATES,
  USE_CASES,
  missingUseCaseSteps,
  useCaseQualificationSchema,
  useCaseSchema,
} from './useCases.js';

describe('use-case playbook', () => {
  it('is valid, unique, and every step is a catalogue entry', () => {
    const ids = new Set<string>();
    for (const u of USE_CASES) {
      expect(() => useCaseSchema.parse(u), u.id).not.toThrow();
      expect(ids.has(u.id), u.id).toBe(false);
      ids.add(u.id);
    }
    expect(missingUseCaseSteps()).toEqual([]);
  });

  it('has a dated saving range for every use case that is not a rule, low below high', () => {
    for (const u of USE_CASES) {
      const r = SAVING_RATES.byUseCase[u.id];
      if (u.pinned) {
        expect(r, u.id).toBeUndefined();
        continue;
      }
      expect(r, u.id).toBeDefined();
      const [low, high] = r as readonly [number, number];
      expect(low).toBeGreaterThan(0);
      expect(high).toBeGreaterThan(low);
      expect(high).toBeLessThanOrEqual(0.9);
    }
    expect(SAVING_RATES.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('pins only rules, and the data charter starts with a governance step', () => {
    const pinned = USE_CASES.filter((u) => u.pinned);
    expect(pinned.map((u) => u.id)).toEqual(['uc.ai_data_charter']);
    expect(catalogueEntry(pinned[0]!.steps[0]!)?.category).toBe('governance');
  });

  it('accepts an empty or partial visit measure', () => {
    expect(
      useCaseQualificationSchema.parse({
        volumePerWeek: 12,
        minutesPerUnit: 45,
        teams: 'BM',
        source: 'visit',
      }),
    ).toBeTruthy();
    expect(() =>
      useCaseQualificationSchema.parse({
        volumePerWeek: -1,
        minutesPerUnit: null,
        teams: '',
        source: '',
      }),
    ).toThrow();
  });
});
