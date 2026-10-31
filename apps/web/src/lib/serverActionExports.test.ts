import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every file under `app` that starts with 'use server'. */
const serverFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return serverFiles(p);
    if (!/\.tsx?$/.test(name) || name.includes('.test.')) return [];
    return /^\s*['"]use server['"]/.test(readFileSync(p, 'utf8')) ? [p] : [];
  });

describe("'use server' files", () => {
  const files = serverFiles(join(__dirname, '..', 'app'));
  it('export only async functions (a constant crashes the page in production)', () => {
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) {
      const bad = readFileSync(f, 'utf8')
        .split('\n')
        .filter((l) => /^export\s+(const|let|var|class|default\s+(?!async))/.test(l));
      expect(bad, f).toEqual([]);
    }
  });
});
