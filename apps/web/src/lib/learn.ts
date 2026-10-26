import type { LearnPageKey } from '@evolai/contracts';

/** The five /learn pages in reading order (TASK-AE, ADR 0050). */
export const LEARN_PAGES: ReadonlyArray<{ key: LearnPageKey; href: string }> = [
  { key: 'why', href: '/learn' },
  { key: 'how', href: '/learn/how' },
  { key: 'questions', href: '/learn/questions' },
  { key: 'results', href: '/learn/results' },
  { key: 'more', href: '/learn/videos' },
];
