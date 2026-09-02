import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverFeatureDependencies } from './discover-dependencies';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-dependencies-'));
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

describe('feature dependency discovery', () => {
  it('discovers public-boundary imports across feature files', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'auth', { 'index.ts': 'export const auth = true;\n' });
    writeFeature(fixture, 'users', { 'index.ts': 'export const users = true;\n' });
    writeFeature(fixture, 'billing', {
      'index.ts': `import { auth } from '@/features/auth';
import { users } from '@/features/users';
export { auth, users };
`,
      'server/routes.ts': "export { users } from '@/features/users';\n",
    });

    const result = discoverFeatureDependencies(fixture);

    expect(result.dependencies.map(({ from, to }) => `${from} -> ${to}`)).toEqual([
      'billing -> auth',
      'billing -> users',
    ]);
    expect(result.dependencies[1]).toMatchObject({
      imports: ['@/features/users'],
      sourceFiles: ['src/features/billing/index.ts', 'src/features/billing/server/routes.ts'],
      usesInternalPath: false,
    });
  });

  it('records internal paths for later boundary diagnostics', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', { 'index.ts': 'export const users = true;\n' });
    writeFeature(fixture, 'billing', {
      'index.ts': 'export {};\n',
      'server/service.ts': "import { db } from '../../users/server/repository';\nexport { db };\n",
    });

    const result = discoverFeatureDependencies(fixture);

    expect(result.dependencies).toEqual([
      {
        from: 'billing',
        to: 'users',
        imports: ['../../users/server/repository'],
        sourceFiles: ['src/features/billing/server/service.ts'],
        usesInternalPath: true,
      },
    ]);
  });
});
