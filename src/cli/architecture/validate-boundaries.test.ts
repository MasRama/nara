import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectCrossFeatureInternalImports } from './validate-boundaries';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-boundary-'));
  fixtures.push(fixture);
  return fixture;
}

function writeFeature(fixture: string, name: string, files: Record<string, string>): void {
  const directory = path.join(fixture, 'src/features', name);
  for (const [file, content] of Object.entries(files)) {
    const filePath = path.join(directory, file);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
}

describe('cross-feature boundaries', () => {
  it('reports the source, target, and public-boundary fix', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', {
      'index.ts': 'export const users = true;\n',
      'server/repository.ts': 'export const db = true;\n',
    });
    writeFeature(fixture, 'billing', {
      'index.ts': 'export {};\n',
      'server/service.ts': "import { db } from '../../users/server/repository';\nexport { db };\n",
    });

    const violations = detectCrossFeatureInternalImports(fixture);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      sourceFeature: 'billing',
      targetFeature: 'users',
      sourceFile: 'src/features/billing/server/service.ts',
      importSpecifier: '../../users/server/repository',
    });
    expect(violations[0].suggestion).toContain('@/features/users');
  });

  it('accepts imports through a feature public index', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', { 'index.ts': 'export const users = true;\n' });
    writeFeature(fixture, 'billing', {
      'index.ts': "import { users } from '@/features/users';\nexport { users };\n",
    });

    expect(detectCrossFeatureInternalImports(fixture)).toEqual([]);
  });
});
