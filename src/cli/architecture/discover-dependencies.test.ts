import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverFeatureDependencies } from './discover-dependencies';
import { discoverFeatureImportEvidence } from './discover-import-evidence';

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
  it('records symbol and module import evidence deterministically', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'auth', {
      'index.ts': 'export const requireAuth = true;\nexport type SessionUser = { id: string };\n',
      'web/index.ts': 'export const LoginPage = true;\n',
      'server/internal.ts': 'export const privateThing = true;\n',
    });
    writeFeature(fixture, 'users', {
      'index.ts': `import { requireAuth as authenticate, type SessionUser } from '@/features/auth';
import type { SessionUser as ImportedUser } from '@/features/auth';
import authThing from '@/features/auth';
import * as Auth from '@/features/auth';
import '@/features/auth';
import AuthModule = require('@/features/auth');
const loaded = require('@/features/auth');
const lazy = import('@/features/auth');
export { SessionUser as AuthUser } from '@/features/auth';
export type { SessionUser as AuthType } from '@/features/auth';
export * from '@/features/auth';
import { LoginPage } from '@/features/auth/web';
import { privateThing } from '@/features/auth/server/internal';
`,
    });

    const first = discoverFeatureImportEvidence(fixture);
    const second = discoverFeatureImportEvidence(fixture);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.every((evidence) => !Object.values(evidence).includes(undefined))).toBe(true);

    const users = first.filter((evidence) => evidence.from === 'users');
    expect(users.filter((evidence) => evidence.precision === 'symbol')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          to: 'auth',
          boundary: 'public',
          kind: 'named-import',
          importedSymbol: 'requireAuth',
          localName: 'authenticate',
          typeOnly: false,
          precision: 'symbol',
        }),
        expect.objectContaining({
          to: 'auth',
          boundary: 'public',
          kind: 'named-import',
          importedSymbol: 'SessionUser',
          localName: 'SessionUser',
          typeOnly: true,
          precision: 'symbol',
        }),
        expect.objectContaining({
          to: 'auth',
          boundary: 'public',
          kind: 'named-import',
          importedSymbol: 'SessionUser',
          localName: 'ImportedUser',
          typeOnly: true,
          precision: 'symbol',
        }),
        expect.objectContaining({
          to: 'auth',
          boundary: 'public',
          kind: 'default-import',
          importedSymbol: 'default',
          localName: 'authThing',
          typeOnly: false,
          precision: 'symbol',
        }),
        expect.objectContaining({
          to: 'auth',
          boundary: 'web',
          kind: 'named-import',
          importedSymbol: 'LoginPage',
          localName: 'LoginPage',
          typeOnly: false,
          precision: 'symbol',
        }),
        expect.objectContaining({
          to: 'auth',
          boundary: 'public',
          kind: 'named-reexport',
          importedSymbol: 'SessionUser',
          exportedName: 'AuthUser',
          typeOnly: false,
          precision: 'symbol',
        }),
        expect.objectContaining({
          to: 'auth',
          boundary: 'public',
          kind: 'named-reexport',
          importedSymbol: 'SessionUser',
          exportedName: 'AuthType',
          typeOnly: true,
          precision: 'symbol',
        }),
      ]),
    );

    expect(users.filter((evidence) => evidence.precision === 'module')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'namespace-import', localName: 'Auth', precision: 'module' }),
        expect.objectContaining({ kind: 'side-effect-import', precision: 'module' }),
        expect.objectContaining({ kind: 'require', precision: 'module' }),
        expect.objectContaining({ kind: 'dynamic-import', precision: 'module' }),
        expect.objectContaining({ kind: 'export-all', precision: 'module' }),
      ]),
    );
    expect(
      users.find(
        (evidence) =>
          evidence.specifier === '@/features/auth/server/internal' &&
          evidence.importedSymbol === 'privateThing',
      ),
    ).toMatchObject({
      usesInternalPath: true,
      kind: 'named-import',
      precision: 'symbol',
    });

    const dependency = discoverFeatureDependencies(fixture).dependencies;
    expect(dependency).toEqual([
      {
        from: 'users',
        to: 'auth',
        imports: [
          '@/features/auth',
          '@/features/auth/server/internal',
          '@/features/auth/web',
        ],
        sourceFiles: ['src/features/users/index.ts'],
        usesInternalPath: true,
      },
    ]);
  });
});
