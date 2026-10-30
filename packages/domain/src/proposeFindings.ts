import type { EvidenceTag } from '@evolai/contracts';
import { tagsInText } from './improvementMatching.js';

/**
 * Rule proposals for findings (TASK-AJ A2, ADR 0058). Takes the submitted answers of one mission
 * and proposes engagement-level findings, each with the answers it rests on:
 *
 * 1. Choice rules: for a scored scenario, the share of people who picked a weak practice
 *    ("5 of 12 paste client data as is"), when at least `minCount` people did.
 * 2. Unsure: a question where many people answered "I don't know / It depends".
 * 3. Free-text patterns: the catalogue's evidence patterns (`tagsInText`) found in the free texts,
 *    grouped by pattern ("information typed twice, named by 6 people").
 *
 * Words are not chosen here: a proposal carries a rule key and counts, the caller words it in the
 * mission's language. A proposal is a draft: the auditor approves, edits or rejects every one.
 * Counts are people (distinct submissions), never answers.
 */

export interface MissionAnswer {
  readonly answerId: string;
  readonly submissionId: string;
  readonly code: string;
  /** A choice holds the option value; a text holds what the person wrote (already anonymised). */
  readonly kind: 'choice' | 'text';
  readonly value: string;
}

export type FindingAxis = 'literacy' | 'practice' | 'readiness' | 'opportunity' | 'context';

export type ProposalRule =
  | { readonly kind: 'choice'; readonly code: string }
  | { readonly kind: 'unsure'; readonly code: string }
  | { readonly kind: 'tag'; readonly tag: EvidenceTag };

export interface FindingProposal {
  readonly ruleKey: string;
  readonly rule: ProposalRule;
  readonly axis: FindingAxis;
  readonly tags: readonly EvidenceTag[];
  readonly answerIds: readonly string[];
  readonly people: number;
  readonly total: number;
}

interface ChoiceRule {
  readonly code: string;
  /** Option values that show the weaker practice. */
  readonly values: readonly string[];
  readonly axis: FindingAxis;
  readonly tags: readonly EvidenceTag[];
}

/**
 * The weak practice of each scored scenario of questionnaire v1, and the task inventory answers of
 * v2 that point at work worth changing (pilot-v3.json).
 */
export const CHOICE_RULES: readonly ChoiceRule[] = [
  {
    code: 'v1_source_check',
    values: ['use_as_is', 'reread'],
    axis: 'literacy',
    tags: ['literacy_gap', 'document_review'],
  },
  {
    code: 'v1_data_sharing',
    values: ['paste_directly'],
    axis: 'readiness',
    tags: ['policy_unclear', 'literacy_gap'],
  },
  {
    code: 'v1_request_style',
    values: ['one_line'],
    axis: 'literacy',
    tags: ['literacy_gap', 'writing_drafting'],
  },
  { code: 'v1_report_flow', values: ['look_for_tool'], axis: 'context', tags: ['unclear_process'] },
  {
    code: 'v1_repeat_data',
    values: ['ai_assistant'],
    axis: 'literacy',
    tags: ['manual_reentry', 'literacy_gap'],
  },
  {
    code: 'v1_repeat_time',
    values: ['3_6h', 'gt_6h'],
    axis: 'opportunity',
    tags: ['repetitive_task'],
  },
  { code: 'v2_task_frequency', values: ['daily'], axis: 'opportunity', tags: ['repetitive_task'] },
  {
    code: 'v2_task_duration',
    values: ['1_3h', 'gt_3h'],
    axis: 'opportunity',
    tags: ['repetitive_task'],
  },
  {
    code: 'v2_task_tool',
    values: ['spreadsheet', 'email', 'paper'],
    axis: 'opportunity',
    tags: ['manual_reentry'],
  },
  {
    code: 'v2_task_data',
    values: ['personal', 'client_confidential'],
    axis: 'readiness',
    tags: ['policy_unclear'],
  },
];

/**
 * The heavy repeated task (v2): done every day or every week and over an hour each time. The
 * evidence is both answers of each person.
 */
export const HEAVY_TASK = {
  code: 'v2_task_heavy',
  frequency: ['daily', 'weekly'],
  duration: ['1_3h', 'gt_3h'],
} as const;

export const UNSURE = 'unsure';

const TAG_AXIS: Partial<Record<EvidenceTag, FindingAxis>> = {
  literacy_gap: 'literacy',
  low_practice: 'practice',
  tool_access: 'readiness',
  policy_unclear: 'readiness',
  data_quality: 'readiness',
};

export interface ProposeOptions {
  /** Fewest people behind a proposal (default 3; under the report minimum it stays staff-only). */
  readonly minCount?: number;
  /** Share of people answering "unsure" that makes a finding (default 0.4). */
  readonly unsureShare?: number;
}

const people = (answers: readonly MissionAnswer[]): number =>
  new Set(answers.map((a) => a.submissionId)).size;

export const proposeFindings = (
  answers: readonly MissionAnswer[],
  options: ProposeOptions = {},
): FindingProposal[] => {
  const minCount = options.minCount ?? 3;
  const unsureShare = options.unsureShare ?? 0.4;
  const total = people(answers);
  const out: FindingProposal[] = [];
  const push = (
    ruleKey: string,
    rule: ProposalRule,
    axis: FindingAxis,
    tags: readonly EvidenceTag[],
    hits: readonly MissionAnswer[],
  ) => {
    const n = people(hits);
    if (n < minCount) return;
    out.push({
      ruleKey,
      rule,
      axis,
      tags,
      answerIds: [...new Set(hits.map((a) => a.answerId))].sort(),
      people: n,
      total,
    });
  };

  for (const r of CHOICE_RULES) {
    const hits = answers.filter(
      (a) => a.kind === 'choice' && a.code === r.code && r.values.includes(a.value),
    );
    push(`choice:${r.code}`, { kind: 'choice', code: r.code }, r.axis, r.tags, hits);
  }

  const pick = (code: string, values: readonly string[]) =>
    answers.filter((a) => a.kind === 'choice' && a.code === code && values.includes(a.value));
  const often = pick('v2_task_frequency', HEAVY_TASK.frequency);
  const long = pick('v2_task_duration', HEAVY_TASK.duration);
  const longBy = new Set(long.map((a) => a.submissionId));
  const heavy = often.filter((a) => longBy.has(a.submissionId));
  const heavyBy = new Set(heavy.map((a) => a.submissionId));
  push(
    `choice:${HEAVY_TASK.code}`,
    { kind: 'choice', code: HEAVY_TASK.code },
    'opportunity',
    ['repetitive_task'],
    [...heavy, ...long.filter((a) => heavyBy.has(a.submissionId))],
  );

  const choiceCodes = [
    ...new Set(answers.filter((a) => a.kind === 'choice').map((a) => a.code)),
  ].sort();
  for (const code of choiceCodes) {
    const asked = answers.filter((a) => a.kind === 'choice' && a.code === code);
    const hits = asked.filter((a) => a.value === UNSURE);
    if (people(hits) < unsureShare * people(asked)) continue;
    const axis = CHOICE_RULES.find((r) => r.code === code)?.axis ?? 'literacy';
    push(`unsure:${code}`, { kind: 'unsure', code }, axis, ['literacy_gap'], hits);
  }

  const byTag = new Map<EvidenceTag, MissionAnswer[]>();
  for (const a of answers) {
    if (a.kind !== 'text' || a.value.trim() === '') continue;
    for (const tag of tagsInText(a.value)) byTag.set(tag, [...(byTag.get(tag) ?? []), a]);
  }
  for (const [tag, hits] of byTag) {
    push(`tag:${tag}`, { kind: 'tag', tag }, TAG_AXIS[tag] ?? 'opportunity', [tag], hits);
  }

  return out.sort((x, y) => y.people - x.people || x.ruleKey.localeCompare(y.ruleKey));
};
