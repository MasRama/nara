/**
 * Convention tests — verify structural conventions that lint:layers doesn't cover.
 *
 * lint:layers.ts covers: handler naming, import direction, no classes, layer boundaries.
 * These tests cover: AGENTS.md presence, frontmatter, skills index, CODEMAP freshness.
 *
 * AI agents read test files to learn expected behavior — these tests
 * also serve as executable documentation of documentation conventions.
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

  it('every AGENTS.md has authority frontmatter', () => {
    for (const dir of expectedDirs) {
      const content = readFile(`${dir}/AGENTS.md`);
      expect(content, `${dir || 'root'}/AGENTS.md must have YAML frontmatter`).toMatch(/^---\nauthority:/);
    }
  });
});

describe('convention: skills index', () => {
  const skills = [
    'crud-pattern.md',
    'sqlite-usage.md',
    'auth-rbac.md',
    'inertia-patterns.md',
    'error-handling.md',
    'api-contract.md',
    'dependency-policy.md',
    'common-pitfalls.md',
  ];

  it('all skill files exist', () => {
    for (const skill of skills) {
      const skillPath = path.join(ROOT, '.agents', 'skills', skill);
      expect(fs.existsSync(skillPath), `.agents/skills/${skill} should exist`).toBe(true);
    }
  });

  it('every skill has authority frontmatter', () => {
    for (const skill of skills) {
      const content = readFile(`.agents/skills/${skill}`);
      expect(content, `${skill} must have YAML frontmatter`).toMatch(/^---\nauthority:/);
    }
  });
});

describe('convention: CODEMAP.md freshness', () => {
  it('CODEMAP.md exists and has stats', () => {
    const content = readFile('CODEMAP.md');
    expect(content).toMatch(/# CODEMAP\.md/);
    expect(content).toMatch(/Files indexed: \d+/);
    expect(content).toMatch(/Total exports: \d+/);
  });
});
