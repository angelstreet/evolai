import { describe, expect, it } from 'vitest';
import { DEFAULT_MISSION_SHAPE, missionShape } from './missionKind.js';

describe('missionShape', () => {
  it('keeps a valid team kind and mode', () => {
    expect(missionShape('team', 'interview')).toEqual({ kind: 'team', mode: 'interview' });
    expect(missionShape('team', 'survey')).toEqual({ kind: 'team', mode: 'survey' });
  });
  it('a governance audit is always an interview', () => {
    expect(missionShape('governance', 'survey')).toEqual({ kind: 'governance', mode: 'interview' });
  });
  it('unknown or missing values fall back to a team survey', () => {
    expect(missionShape(undefined, undefined)).toEqual(DEFAULT_MISSION_SHAPE);
    expect(missionShape('company', 'robot')).toEqual(DEFAULT_MISSION_SHAPE);
  });
});
