import { describe, expect, it } from 'vitest';
import {
  JOB_FAMILIES,
  TASK_AREAS,
  TASK_CATALOGUE,
  aiModeOf,
  catalogueTaskById,
  catalogueTaskSchema,
  jobFamilySchema,
  tasksForJob,
} from './taskCatalogue.js';
import { useCaseById } from './useCases.js';

describe('task catalogue (TASK-AK K2)', () => {
  it('every task is valid, unique, and points at a real use case', () => {
    const ids = new Set<string>();
    for (const task of TASK_CATALOGUE) {
      expect(() => catalogueTaskSchema.parse(task), task.id).not.toThrow();
      expect(ids.has(task.id), task.id).toBe(false);
      ids.add(task.id);
      if (task.useCase) expect(useCaseById(task.useCase), task.id).toBeDefined();
    }
    expect(catalogueTaskById('tk.find_prospects')?.area).toBe('prospecting');
  });

  it('every job is offered tasks, and every job and area has a label', () => {
    for (const job of jobFamilySchema.options) {
      expect(tasksForJob(job).length, job).toBeGreaterThanOrEqual(3);
      expect(JOB_FAMILIES[job].fr.length).toBeGreaterThan(2);
    }
    for (const task of TASK_CATALOGUE) expect(TASK_AREAS[task.area]).toBeDefined();
  });

  it('a task that contacts people cannot have a low AI risk', () => {
    const bad = { ...TASK_CATALOGUE[0]!, contactsPeople: true, aiRisk: 2 };
    expect(catalogueTaskSchema.safeParse(bad).success).toBe(false);
  });

  it('AI never contacts people unattended (decision 7)', () => {
    for (const task of TASK_CATALOGUE.filter((x) => x.contactsPeople)) {
      expect(aiModeOf(task), task.id).toBe('person_confirms');
    }
    expect(aiModeOf({ aiRisk: 4, contactsPeople: false, fix: 'ai' })).toBe('person_confirms');
    expect(aiModeOf({ aiRisk: 4, contactsPeople: false, fix: 'automation' })).toBe(
      'person_confirms',
    );
    expect(aiModeOf({ aiRisk: 2, contactsPeople: false, fix: 'ai' })).toBe('checked_after');
    expect(aiModeOf({ aiRisk: 2, contactsPeople: false, fix: 'process' })).toBe('no_ai');
  });

  it('French text uses typographic apostrophes and no-break spaces before high punctuation', () => {
    const texts = TASK_CATALOGUE.flatMap((x) => [x.title.fr, ...x.subTasks.map((s) => s.fr)]);
    for (const s of texts) {
      expect(s, s).not.toMatch(/'/);
      expect(s, s).not.toMatch(/ [:;?!]/);
    }
  });

  it('carries no brand or product name (generic wording, public repository)', () => {
    const all = JSON.stringify(TASK_CATALOGUE).toLowerCase();
    for (const word of ['linkedin', 'boond', 'lemlist', 'excel', 'whatsapp', 'chatgpt', 'claude']) {
      expect(all, word).not.toContain(word);
    }
  });
});
