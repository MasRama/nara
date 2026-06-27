/**
 * Convention tests — verify AI-generated code follows AGENTS.md conventions.
 *
 * These tests complement lint-layers.ts. Where lint catches syntax-level
 * violations (imports, banned patterns), these tests verify structural
 * conventions that are easier to express as assertions.
 *
 * AI agents read test files to learn expected behavior — these tests
 * also serve as executable documentation of conventions.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

function readDir(dir: string, ext: string): string[] {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter(f => f.endsWith(ext))
    .map(f => path.join(dir, f));
}

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

describe('convention: handler naming', () => {
  const handlers = readDir('app/handlers', '.ts').filter(f => !f.endsWith('index.ts'));

  it('every handler file exports at least one function', () => {
    for (const file of handlers) {
      const content = readFile(file);
      expect(content).toMatch(/export\s+(const|function|async\s+function)\s+\w+/);
    }
  });

  it('handlers must not use generic REST names', () => {
    const generic = ['index', 'show', 'store', 'create', 'update', 'destroy', 'remove', 'handle', 'process', 'run', 'do', 'execute'];
    for (const file of handlers) {
      const content = readFile(file);
      for (const name of generic) {
        const regex = new RegExp(`^export\\s+const\\s+${name}\\b`, 'm');
        expect(content, `${file} should not export generic name "${name}"`).not.toMatch(regex);
      }
    }
  });
});

describe('convention: query layer isolation', () => {
  const handlers = readDir('app/handlers', '.ts').filter(f => !f.endsWith('index.ts'));

  it('handlers must not import @services/SQLite directly', () => {
    for (const file of handlers) {
      const content = readFile(file);
      expect(content, `${file} must not import @services/SQLite`).not.toMatch(/from\s+['"]@services\/SQLite['"]/);
    }
  });
});

describe('convention: no classes in app/', () => {
  const appDirs = ['handlers', 'queries', 'validators', 'middlewares'];

  it('no class declarations in handlers, queries, validators, middlewares', () => {
    for (const dir of appDirs) {
      const files = readDir(`app/${dir}`, '.ts').filter(f => !f.endsWith('index.ts'));
      for (const file of files) {
        const content = readFile(file);
        // Allow class in error types (NaraError), but not in handlers/queries
        expect(content, `${file} must not declare class`).not.toMatch(/^export\s+class\s+\w+/m);
      }
    }
  });
});

describe('convention: AGENTS.md presence', () => {
  const expectedDirs = [
    'app',
    'database',
    'migrations',
    'resources',
    'resources/Components',
    'resources/Pages',
    'resources/types',
    'routes',
    'tests',
  ];

  it('every documented directory has an AGENTS.md', () => {
    for (const dir of expectedDirs) {
      const agentsPath = path.join(ROOT, dir, 'AGENTS.md');
      expect(fs.existsSync(agentsPath), `${dir}/AGENTS.md should exist`).toBe(true);
    }
  });

  it('every AGENTS.md has authority frontmatter', () => {
    for (const dir of expectedDirs) {
      const content = readFile(`${dir}/AGENTS.md`);
      expect(content, `${dir}/AGENTS.md must have YAML frontmatter`).toMatch(/^---\nauthority:/);
    }
  });
});

describe('convention: skills index', () => {
  const skills = ['crud-pattern.md', 'sqlite-usage.md', 'auth-rbac.md', 'inertia-patterns.md', 'error-handling.md'];

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
