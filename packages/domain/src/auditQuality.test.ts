import { describe, expect, it } from 'vitest';
import {
  auditQuality,
  QUALITY_WEIGHTS,
  type AuditFacts,
  type QualityStep,
} from './auditQuality.js';

const step = (over: Partial<QualityStep> = {}): QualityStep => ({
  category: 'simplify',
  impact: 'medium',
  risk: 'low',
  owner: 'Team lead',
  prerequisites: ['A list of the tools'],
  measured: true,
  ...over,
});

const full: AuditFacts = {
  expected: 10,
  answered: 8,
  hiddenTeams: 0,
  minGroup: 5,
  visit: { interview: 2, observation: 1, workshop: 1 },
  timeShown: true,
  approvedFindings: 4,
  reportableFindings: 4,
  reviewedFindings: 4,
  openDisputes: 0,
  conditionsScored: true,
  risksNote: true,
  acceptedSteps: [step(), step({ risk: 'medium' })],
};

describe('audit-quality score (PRD §29, ADR 0061)', () => {
  it('weights add up to one', () => {
    expect(Object.values(QUALITY_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('a complete audit is ready for the roadmap review', () => {
    const q = auditQuality(full);
    expect(q.score).toBe(100);
    expect(q.gate).toBe('ready');
    expect(q.noGo).toEqual([]);
  });

  it('no visit, no review and no measure: more discovery needed', () => {
    const q = auditQuality({
      ...full,
      visit: { interview: 0, observation: 0, workshop: 0 },
      reviewedFindings: 0,
      acceptedSteps: [step({ measured: false })],
    });
    expect(q.dimensions.find((d) => d.dimension === 'fidelity')?.score).toBe(0);
    expect(q.score).toBe(60);
    expect(q.gate).toBe('gaps');
  });

  it('is unscored under the minimum group and flags the no-go cases', () => {
    const q = auditQuality({
      ...full,
      answered: 3,
      openDisputes: 1,
      acceptedSteps: [step({ category: 'automate', impact: 'high', owner: ' ' })],
    });
    expect(q.score).toBeNull();
    expect(q.gate).toBe('unscored');
    expect(q.noGo).toEqual(['automation_without_owner', 'open_dispute']);
  });

  it('coverage follows the 70% answer target and loses a point for a hidden team', () => {
    const cov = (f: Partial<AuditFacts>) =>
      auditQuality({ ...full, ...f }).dimensions.find((d) => d.dimension === 'coverage')?.score;
    expect(cov({ expected: 20, answered: 7 })).toBe(2.5);
    expect(cov({ hiddenTeams: 1 })).toBe(4);
  });
});
