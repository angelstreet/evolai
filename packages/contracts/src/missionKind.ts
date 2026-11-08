import { z } from 'zod';

/**
 * The two audit types (TASK-AK, ADR 0065). A team audit looks at the tasks of a team; a governance
 * audit looks at how the company runs AI. A team audit is run as an interview (an auditor asks the
 * questions and enters the answers, people named on staff pages) or as a survey (each person
 * answers alone from a link, anonymous). A governance audit is always an interview.
 */
export const missionKindSchema = z.enum(['team', 'governance']);
export type MissionKind = z.infer<typeof missionKindSchema>;

export const missionModeSchema = z.enum(['interview', 'survey']);
export type MissionMode = z.infer<typeof missionModeSchema>;

export interface MissionShape {
  readonly kind: MissionKind;
  readonly mode: MissionMode;
}

/** Missions created before migration 0035 are team surveys. */
export const DEFAULT_MISSION_SHAPE: MissionShape = { kind: 'team', mode: 'survey' };

/** Kind and mode from stored or typed values; unknown values fall back, governance forces interview. */
export const missionShape = (kind: unknown, mode: unknown): MissionShape => {
  const k = missionKindSchema.safeParse(kind);
  const m = missionModeSchema.safeParse(mode);
  const shape: MissionShape = {
    kind: k.success ? k.data : DEFAULT_MISSION_SHAPE.kind,
    mode: m.success ? m.data : DEFAULT_MISSION_SHAPE.mode,
  };
  return shape.kind === 'governance' ? { kind: 'governance', mode: 'interview' } : shape;
};
