import {
  EVIDENCE_KEYWORDS,
  EVIDENCE_TAGS,
  IMPROVEMENT_CATALOGUE,
  type EvidenceTag,
  type ImprovementEntry,
} from '@evolai/contracts';

/**
 * Rule-based matching of an approved opportunity to catalogue interventions (TASK-V, ADR 0041).
 *
 * 1. Evidence tags are found in the opportunity's title and description and in the labels of the
 *    approved findings linked to it, by keyword stems (accents and case ignored). The axis adds a
 *    weaker tag (a literacy finding hints at a literacy gap, and so on).
 * 2. Each catalogue entry scores 2 points per keyword tag and 1 per axis tag it answers.
 * 3. The best entries (score > 0, at most `limit`) are returned with the tags that matched, so
 *    the auditor sees why each one was proposed. Ties keep catalogue order: the result is stable.
 *
 * The result is a suggestion only. The auditor accepts, edits or rejects every step.
 */

export interface MatchInput {
  readonly title: string;
  readonly description: string;
  readonly axis: string | null;
  /** Labels of the approved findings linked to the opportunity (no quotes, no answers). */
  readonly findingLabels?: readonly string[];
  /** Evidence patterns already known from the linked findings (TASK-AJ): matched like keywords. */
  readonly tags?: readonly EvidenceTag[];
}

export interface Match {
  readonly entry: ImprovementEntry;
  readonly score: number;
  readonly tags: readonly EvidenceTag[];
}

const AXIS_TAGS: Readonly<Record<string, readonly EvidenceTag[]>> = {
  literacy: ['literacy_gap'],
  practice: ['low_practice'],
  readiness: ['tool_access', 'policy_unclear'],
  opportunity: ['repetitive_task'],
};

/** Lower case, accents removed, apostrophes and punctuation turned into spaces. */
export const normaliseText = (s: string): string =>
  ` ${s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

/** Keyword tags found in a text. A stem matches at the start of a word. */
export const tagsInText = (text: string): EvidenceTag[] => {
  const norm = normaliseText(text);
  return EVIDENCE_TAGS.filter((tag) =>
    EVIDENCE_KEYWORDS[tag].some((kw) => norm.includes(` ${normaliseText(kw).trim()}`)),
  );
};

export const matchImprovements = (
  input: MatchInput,
  limit = 3,
  catalogue: readonly ImprovementEntry[] = IMPROVEMENT_CATALOGUE,
): Match[] => {
  const text = [input.title, input.description, ...(input.findingLabels ?? [])].join(' \n ');
  const strong = new Set([...tagsInText(text), ...(input.tags ?? [])]);
  const weak = new Set((input.axis ? AXIS_TAGS[input.axis] : undefined) ?? []);
  const scored = catalogue.map((entry, order) => {
    const tags = entry.evidence.filter((t) => strong.has(t) || weak.has(t));
    const score = entry.evidence.reduce((s, t) => s + (strong.has(t) ? 2 : weak.has(t) ? 1 : 0), 0);
    return { entry, score, tags, order };
  });
  return scored
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, Math.max(0, limit))
    .map(({ entry, score, tags }) => ({ entry, score, tags }));
};
