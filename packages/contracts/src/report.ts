import { z } from 'zod';
import { improvementCategorySchema, levelSchema } from './improvementCatalogue.js';

/**
 * Audit report (TASK-V, ADR 0041, PRD §28.1): what the client receives at the end of an audit.
 *
 * The auditor edits a draft; publishing freezes a snapshot (`reportSnapshotSchema`) that is the
 * only thing the client surface and the PDF read. The snapshot holds aggregates only: approved
 * findings raised by at least the minimum group, scores of groups at or above the minimum
 * group, accepted steps and the plan. No answer, quote, respondent code or per-person value can
 * be represented in it (the schema is strict, unknown keys are rejected).
 */

export const reportStatusSchema = z.enum(['draft', 'in_review', 'published']);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const stepStatusSchema = z.enum(['suggested', 'accepted', 'rejected']);
export type StepStatus = z.infer<typeof stepStatusSchema>;

export const stepSourceSchema = z.enum(['rule', 'ai', 'auditor']);
export type StepSource = z.infer<typeof stepSourceSchema>;

/** 30/60/90-day horizon of a step or plan item. */
export const horizonSchema = z.enum(['d30', 'd60', 'd90']);
export type Horizon = z.infer<typeof horizonSchema>;

export const planItemSchema = z
  .object({
    id: z.string().min(1).max(40),
    horizon: horizonSchema,
    text: z.string().min(1).max(400),
    owner: z.string().max(120),
  })
  .strict();
export type PlanItem = z.infer<typeof planItemSchema>;

/** PRD §6 proficiency levels, used as plain-word bands of the readiness score. */
export const readinessLevelSchema = z.enum(['L0', 'L1', 'L2', 'L3', 'L4', 'L5']);
export type ReadinessLevel = z.infer<typeof readinessLevelSchema>;

export const readinessAxisSchema = z.enum(['literacy', 'practice', 'readiness']);
export type ReadinessAxis = z.infer<typeof readinessAxisSchema>;

const scoreSchema = z.number().int().min(0).max(100);

export const readinessGroupSchema = z
  .object({
    /** Number of completed answers behind the group; always >= the minimum group size. */
    people: z.number().int().min(1),
    overall: scoreSchema.nullable(),
    level: readinessLevelSchema.nullable(),
    axes: z.array(
      z
        .object({
          axis: readinessAxisSchema,
          score: scoreSchema.nullable(),
          level: readinessLevelSchema.nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type ReadinessGroup = z.infer<typeof readinessGroupSchema>;

export const readinessReportSchema = z
  .object({
    /** Engagement-wide group, or null when fewer than the minimum group answered. */
    overall: readinessGroupSchema.nullable(),
    teams: z.array(readinessGroupSchema.extend({ team: z.string().min(1).max(120) }).strict()),
    /** Teams left out because fewer than the minimum group answered (count only). */
    hiddenTeams: z.number().int().min(0),
    weights: z.record(readinessAxisSchema, z.number().min(0).max(1)),
    minGroupSize: z.number().int().min(1),
  })
  .strict();
export type ReadinessReport = z.infer<typeof readinessReportSchema>;

export const reportFindingSchema = z
  .object({
    key: z.string().min(1).max(240),
    axis: z.string().min(1).max(40),
    label: z.string().min(1).max(240),
    /** People behind it; 0 when it rests on the visit only (a count under the minimum is never shown). */
    people: z.number().int().min(0),
    /** Seen on the visit: it cites visit notes (TASK-AJ A6). */
    visit: z.boolean().optional(),
    /** The referent disputed it and the auditor kept it (TASK-AJ A8). */
    disputed: z.boolean().optional(),
  })
  .strict();
export type ReportFinding = z.infer<typeof reportFindingSchema>;

export const DAY90_STATUSES = ['validated', 'mixed', 'no_benefit', 'not_implemented'] as const;
export const day90StatusSchema = z.enum(DAY90_STATUSES);
export type Day90Status = z.infer<typeof day90StatusSchema>;

export const stepMeasureSchema = z
  .object({
    baselineValue: z.number().min(0).nullable(),
    baselineUnit: z.string().max(40),
    baselineSource: z.string().max(200),
    /** YYYY-MM-DD. */
    followUpOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    day90Status: day90StatusSchema.nullable(),
    /** Value measured on the follow-up date, same unit as the baseline (ADR 0061). */
    followUpValue: z.number().min(0).nullable().optional(),
  })
  .strict();
export type StepMeasure = z.infer<typeof stepMeasureSchema>;

export const reportStepSchema = z
  .object({
    id: z.string().uuid(),
    opportunityId: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(2000),
    category: improvementCategorySchema,
    effort: levelSchema,
    impact: levelSchema,
    risk: levelSchema,
    owner: z.string().max(120),
    horizon: horizonSchema,
    prerequisites: z.array(z.string().min(1).max(300)).max(8),
    /** Baseline and day-90 follow-up (TASK-AJ A9, PRD §30.1). Absent on older snapshots. */
    measure: stepMeasureSchema.optional(),
  })
  .strict();
export type ReportStep = z.infer<typeof reportStepSchema>;

export const quadrantSchema = z.enum(['quick_win', 'big_bet', 'fill_in', 'reconsider']);
export type Quadrant = z.infer<typeof quadrantSchema>;

/**
 * What makes an opportunity a use case in the report (ADR 0064): the evidence, today's time and the
 * estimated saving. Absent on snapshots published before ADR 0064 and on opportunities that are not
 * use cases (a step the auditor wrote on its own).
 */
export const reportUseCaseSchema = z
  .object({
    useCaseId: z.string().regex(/^uc\.[a-z0-9_]+$/),
    approach: z.string().max(400),
    dataRule: z.string().max(400),
    /** Most people behind one of its findings (at least the minimum group), or 0 if seen on the visit only. */
    people: z.number().int().min(0),
    /** Numbers of the key findings it rests on, as listed in the report. */
    findingNumbers: z.array(z.number().int().min(1)).max(20),
    teams: z.string().max(200),
    unit: z.string().max(40),
    volumePerWeek: z.number().min(0).nullable(),
    minutesPerUnit: z.number().min(0).nullable(),
    /** volume x minutes, in hours a week; null until measured. */
    hoursPerWeek: z.number().min(0).nullable(),
    /** Estimated hours saved a week, low and high; null until measured or for rules. */
    savedLow: z.number().min(0).nullable(),
    savedHigh: z.number().min(0).nullable(),
    measureSource: z.string().max(200),
    /** Share of time assumed saved (0..1), shown as the basis of the estimate. Absent before. */
    rateLow: z.number().min(0).max(1).nullable().optional(),
    rateHigh: z.number().min(0).max(1).nullable().optional(),
    ratesVersion: z.string().max(40),
    /** The referent's order of priority, if given. */
    clientRank: z.number().int().min(1).nullable(),
    pinned: z.boolean(),
  })
  .strict();
export type ReportUseCase = z.infer<typeof reportUseCaseSchema>;

export const reportOpportunitySchema = z
  .object({
    id: z.string().uuid(),
    rank: z.number().int().min(1),
    title: z.string().min(1).max(200),
    axis: z.string().max(40).nullable(),
    impact: levelSchema,
    effort: levelSchema,
    quadrant: quadrantSchema,
    useCase: reportUseCaseSchema.optional(),
  })
  .strict();
export type ReportOpportunity = z.infer<typeof reportOpportunitySchema>;

/** Time on the main repeated task, self-reported (ADR 0060). Teams under the minimum are counted only. */
export const repeatedTimeSchema = z
  .object({
    overall: z
      .object({ people: z.number().int().min(1), hoursPerWeek: z.number().int().min(0) })
      .strict()
      .nullable(),
    teams: z
      .array(
        z
          .object({
            team: z.string().min(1).max(120),
            people: z.number().int().min(1),
            hoursPerWeek: z.number().int().min(0),
            tool: z.string().max(40).nullable(),
          })
          .strict(),
      )
      .max(60),
    hiddenTeams: z.number().int().min(0),
  })
  .strict();
export type RepeatedTimeReport = z.infer<typeof repeatedTimeSchema>;

export const reportSnapshotSchema = z
  .object({
    version: z.number().int().min(1),
    /** Language the auditor wrote the content in. */
    locale: z.enum(['fr', 'en']),
    title: z.string().min(1).max(200),
    organisation: z.string().max(200),
    publishedAt: z.string().min(10),
    summary: z.string().max(6000),
    /** Keys of the findings the summary rests on (each one is in `findings`). */
    summaryCitations: z.array(z.string().min(1).max(240)).max(30),
    readiness: readinessReportSchema,
    findings: z.array(reportFindingSchema).max(60),
    opportunities: z.array(reportOpportunitySchema).max(60),
    steps: z.array(reportStepSchema).max(200),
    /** Risks written by the auditor, one per line. */
    risks: z.array(z.string().min(1).max(400)).max(60),
    /** What must be true before the accepted steps can start (deduplicated). */
    prerequisites: z.array(z.string().min(1).max(300)).max(80),
    plan: z.array(planItemSchema).max(60),
    methodology: z.string().max(4000),
    minGroupSize: z.number().int().min(1),
    catalogueVersion: z.string().min(1).max(40),
    /** Absent on snapshots published before ADR 0060, and when no one answered the inventory. */
    repeatedTime: repeatedTimeSchema.optional(),
  })
  .strict();
export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;
