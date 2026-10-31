import {
  SAVING_RATES,
  USE_CASES,
  type EvidenceTag,
  type UseCase,
  type UseCaseQualification,
} from '@evolai/contracts';

/**
 * Which use cases the audit proposes (ADR 0064), from the approved findings.
 *
 * - A finding counts for a use case when it carries one of the use case's evidence tags.
 * - A task use case needs at least one finding that names the work itself: a theme from the free
 *   texts (`tag:` rule) or a finding the auditor wrote or saw on the visit. Choice answers alone
 *   ("the main task is in a spreadsheet") say a task is heavy, not which task.
 * - A pinned use case (rules on client data) only needs one finding with its tag, from any source.
 * - Pinned use cases come first, then the core work of the firm, then the others, each by people,
 *   at most `limit` in all.
 */

export interface UseCaseFinding {
  readonly id: string;
  readonly tags: readonly EvidenceTag[];
  /** `tag:…` for a free-text theme, `choice:…` for an answer rule, null when written by the auditor. */
  readonly ruleKey: string | null;
  readonly people: number;
  readonly visit: boolean;
}

export interface UseCaseProposal {
  readonly useCase: UseCase;
  readonly findingIds: readonly string[];
  /** Most people behind one of its findings. */
  readonly people: number;
}

const namesTheWork = (f: UseCaseFinding): boolean =>
  f.visit || f.ruleKey === null || f.ruleKey.startsWith('tag:');

export const proposeUseCases = (
  findings: readonly UseCaseFinding[],
  limit = 5,
  playbook: readonly UseCase[] = USE_CASES,
): UseCaseProposal[] => {
  const out: (UseCaseProposal & { order: number; pinned: boolean; core: boolean })[] = [];
  playbook.forEach((useCase, order) => {
    const linked = findings.filter((f) => f.tags.some((t) => useCase.evidence.includes(t)));
    if (linked.length === 0) return;
    if (!useCase.pinned && !linked.some(namesTheWork)) return;
    out.push({
      useCase,
      findingIds: linked.map((f) => f.id),
      people: Math.max(...linked.map((f) => f.people)),
      order,
      pinned: useCase.pinned === true,
      core: useCase.core === true,
    });
  });
  return out
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        Number(b.core) - Number(a.core) ||
        b.people - a.people ||
        a.order - b.order,
    )
    .slice(0, Math.max(0, limit))
    .map(({ useCase, findingIds, people }) => ({ useCase, findingIds, people }));
};

/** Half-hour rounding, never below zero. */
const half = (n: number): number => Math.max(0, Math.round(n * 2) / 2);

export interface SavingEstimate {
  readonly hoursPerWeek: number | null;
  readonly savedLow: number | null;
  readonly savedHigh: number | null;
  /** The share of time assumed saved, low and high (0..1), or null for rules. */
  readonly rateLow: number | null;
  readonly rateHigh: number | null;
  readonly ratesVersion: string;
}

/**
 * Today's time (volume x minutes) and the estimated hours saved a week, from the dated saving
 * range of the use case. Null until both figures are measured; null savings for rules.
 */
export const estimateSaving = (
  useCaseId: string,
  q: Pick<UseCaseQualification, 'volumePerWeek' | 'minutesPerUnit'>,
  rates: {
    version: string;
    byUseCase: Readonly<Record<string, readonly [number, number]>>;
  } = SAVING_RATES,
): SavingEstimate => {
  const hours =
    q.volumePerWeek !== null && q.minutesPerUnit !== null
      ? half((q.volumePerWeek * q.minutesPerUnit) / 60)
      : null;
  const range = rates.byUseCase[useCaseId];
  return {
    hoursPerWeek: hours,
    savedLow: hours !== null && range ? half(hours * range[0]) : null,
    savedHigh: hours !== null && range ? half(hours * range[1]) : null,
    rateLow: range ? range[0] : null,
    rateHigh: range ? range[1] : null,
    ratesVersion: rates.version,
  };
};
