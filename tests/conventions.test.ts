/**
 * Convention tests — verify structural conventions that lint:layers doesn't cover.
 *
 * lint:layers.ts covers: handler naming, import direction, no classes, layer boundaries.
 * These tests cover: AGENTS.md presence, skills index.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

describe('convention: AGENTS.md presence', () => {
  const expectedDirs = [
    '',                    // root
    'app/core',
    'app/handlers',
    'app/middlewares',
    'app/queries',
    'app/services',
    'migrations',
    'resources',
    'resources/Components',
    'resources/Pages',
    'resources/types',
    'tests',
  ];

  it('every documented directory has an AGENTS.md', () => {
    for (const dir of expectedDirs) {
      const agentsPath = path.join(ROOT, dir, 'AGENTS.md');
      expect(fs.existsSync(agentsPath), `${dir || 'root'}/AGENTS.md should exist`).toBe(true);
    }
  });
});

describe('convention: skills index', () => {
  it('every skill referenced in SKILL.md exists', () => {
    const index = readFile(path.join('.agents', 'skills', 'SKILL.md'));
    const referenced = [...index.matchAll(/\]\(\.\/([a-z0-9-]+\.md)\)/g)].map(m => m[1]);
    expect(referenced.length).toBeGreaterThan(0);
    for (const skill of referenced) {
      const skillPath = path.join(ROOT, '.agents', 'skills', skill);
      expect(fs.existsSync(skillPath), `.agents/skills/${skill} should exist`).toBe(true);
    }
  });
});
