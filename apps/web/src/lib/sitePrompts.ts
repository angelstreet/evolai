import type { EvidenceTag } from '@evolai/contracts';
import type { FindingAxis } from '@evolai/domain';
import type { Translator } from '@evolai/i18n';

/**
 * "Ask on site" (TASK-AJ A7, ADR 0059): one question per open finding for the visit, with the
 * count behind it, plus the standard question of the axis with the least evidence. Rule-based
 * text from a small template table per evidence pattern and per axis; no model.
 */

/** Evidence patterns that have a question of their own; the others fall back to their axis. */
export const ASK_TAGS = [
  'manual_reentry',
  'repetitive_task',
  'policy_unclear',
  'literacy_gap',
  'writing_drafting',
  'unclear_process',
  'document_review',
] as const satisfies readonly EvidenceTag[];

const AXES: readonly FindingAxis[] = [
  'literacy',
  'practice',
  'readiness',
  'opportunity',
  'context',
];

export interface PromptFinding {
  readonly label: string;
  readonly axis: FindingAxis;
  readonly tags: readonly EvidenceTag[];
  readonly people: number;
  readonly status: 'draft' | 'approved' | 'rejected';
}

export interface SitePrompt {
  /** The finding it follows up, or null for the standard question. */
  readonly finding: string | null;
  readonly people: number;
  readonly question: string;
}

export const sitePrompts = (t: Translator, findings: readonly PromptFinding[]): SitePrompt[] => {
  const open = findings
    .filter((f) => f.status !== 'rejected')
    .sort((a, b) => b.people - a.people || a.label.localeCompare(b.label));
  const out: SitePrompt[] = open.map((f) => {
    const tag = f.tags.find((x): x is (typeof ASK_TAGS)[number] =>
      (ASK_TAGS as readonly string[]).includes(x),
    );
    return {
      finding: f.label,
      people: f.people,
      question: tag ? t(`admin.brief.ask.tag.${tag}`) : t(`admin.brief.ask.axis.${f.axis}`),
    };
  });
  const evidence = new Map<FindingAxis, number>(AXES.map((a) => [a, 0]));
  for (const f of open) evidence.set(f.axis, (evidence.get(f.axis) ?? 0) + 1);
  const weakest = [...AXES].sort((a, b) => (evidence.get(a) ?? 0) - (evidence.get(b) ?? 0))[0];
  if (weakest)
    out.push({ finding: null, people: 0, question: t(`admin.brief.ask.axis.${weakest}`) });
  return out;
};
