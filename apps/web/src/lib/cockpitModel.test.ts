import { describe, expect, it } from 'vitest';
import {
  answeredCount,
  dayPart,
  nextStep,
  stepList,
  stepsDone,
  wrapStage,
  type Progress,
} from './cockpitModel';

const base: Progress = {
  lessonsSeen: new Set(),
  questionIndex: 0,
  questionCount: 10,
  sent: false,
};

describe('cockpit steps', () => {
  it('has seven steps, none done at the start', () => {
    expect(stepList(base)).toHaveLength(7);
    expect(stepsDone(base)).toBe(0);
    expect(nextStep(base)?.target).toEqual({ kind: 'lesson', index: 0 });
  });
  it('counts lessons, the finished survey and the send', () => {
    const p: Progress = { ...base, lessonsSeen: new Set([0, 1, 2, 3, 4]), questionIndex: 10 };
    expect(stepsDone(p)).toBe(6);
    expect(nextStep(p)?.target).toEqual({ kind: 'send' });
    expect(stepsDone({ ...p, sent: true })).toBe(7);
    expect(nextStep({ ...p, sent: true })).toBeUndefined();
  });
  it('counts a survey finished on another device without moving the question', () => {
    const p: Progress = { ...base, surveyDone: true };
    expect(stepList(p)[5]?.done).toBe(true);
    expect(stepsDone(p)).toBe(1);
  });
  it('wraps the stage control both ways', () => {
    expect(wrapStage(-1)).toBe(4);
    expect(wrapStage(5)).toBe(0);
    expect(wrapStage(2)).toBe(2);
  });
  it('counts only real answers', () => {
    expect(answeredCount({ a: 0, b: '', c: 'text', d: 2 })).toBe(3);
  });
  it('splits the day', () => {
    expect([dayPart(8), dayPart(14), dayPart(21)]).toEqual(['morning', 'afternoon', 'evening']);
  });
});
