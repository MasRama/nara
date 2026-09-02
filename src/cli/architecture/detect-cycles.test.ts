import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectFeatureDependencyCycles } from './detect-cycles';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-cycles-'));
  fixtures.push(fixture);
  return fixture;
}

function writeFeature(fixture: string, name: string, source: string): void {
  const filePath = path.join(fixture, 'src/features', name, 'index.ts');
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, source);
}

describe('feature dependency cycles', () => {
  it('reports the full cycle path', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'billing', "import { teams } from '@/features/teams';\nexport { teams };\n");
    writeFeature(fixture, 'teams', "import { users } from '@/features/users';\nexport { users };\n");
    writeFeature(fixture, 'users', "import { billing } from '@/features/billing';\nexport { billing };\n");

    expect(detectFeatureDependencyCycles(fixture)).toEqual([
      { path: ['billing', 'teams', 'users', 'billing'] },
    ]);
  });

  it('returns no cycles for an acyclic dependency graph', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'auth', 'export {};\n');
    writeFeature(fixture, 'users', "import { auth } from '@/features/auth';\nexport { auth };\n");
    writeFeature(fixture, 'billing', "import { users } from '@/features/users';\nexport { users };\n");

    expect(detectFeatureDependencyCycles(fixture)).toEqual([]);
  });
});
