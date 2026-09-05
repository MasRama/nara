import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { computeAffected, diffSnapshots } from './diff';
import { captureArchitectureSnapshot, type ArchitectureSnapshot } from './snapshot';
import type { BoundaryExportEvidence } from './discover-boundary-exports';
import type { FeatureImportEvidence } from './discover-import-evidence';

function importEvidence(overrides: Partial<FeatureImportEvidence> = {}): FeatureImportEvidence {
  return {
    from: 'users',
    to: 'auth',
    sourceFile: 'src/features/users/index.ts',
    specifier: '@/features/auth',
    boundary: 'public',
    usesInternalPath: false,
    kind: 'named-import',
    precision: 'symbol',
    importedSymbol: 'requireAuth',
    localName: 'requireAuth',
    typeOnly: false,
    ...overrides,
  };
}
function boundaryExport(overrides: Partial<BoundaryExportEvidence> = {}): BoundaryExportEvidence {
  return {
    feature: 'auth',
    boundary: 'public',
    boundaryFile: 'src/features/auth/index.ts',
    exportedName: 'SessionUser',
    kind: 'named-reexport',
    precision: 'symbol',
    sourceSpecifier: './contract',
    sourceSymbol: 'SessionUser',
    typeOnly: true,
    ...overrides,
  };
}

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-diff-'));
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

function emptySnapshot(): ArchitectureSnapshot {
  return { schemaVersion: 1, features: [], importEvidence: [], dependencies: [], diagnostics: [] };
}

function featureSnapshot(
  name: string,
  overrides: Partial<{
    publicExports: string[];
    webPublicExports: string[];
    contractExports: string[];
    boundaryExports: ArchitectureSnapshot['features'][number]['boundaryExports'];
    serverSurfaces: string[];
    webSurfaces: string[];
    testSurfaces: string[];
    integrations: ArchitectureSnapshot['features'][number]['integrations'];
  }> = {},
): ArchitectureSnapshot['features'][number] {
  return {
    name,
    publicExports: [],
    webPublicExports: [],
    boundaryExports: { public: [], web: [] },
    contractExports: [],
    serverSurfaces: [],
    webSurfaces: [],
    testSurfaces: [],
    integrations: {
      applicationImports: [],
      serverRoutes: [],
      webRoutes: [],
    },
    ...overrides,
  };
}

describe('architecture diff', () => {
  it('reports no changes for identical snapshots', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    const base = captureArchitectureSnapshot(fixture);
    const target = captureArchitectureSnapshot(fixture);

    const changes = diffSnapshots(base, target);

    expect(changes.features).toEqual({ added: [], removed: [] });
    expect(changes.publicExports).toEqual([]);
    expect(changes.contracts).toEqual([]);
    expect(changes.dependencies).toEqual({ added: [], removed: [] });
    expect(changes.surfaces).toEqual([]);
    expect(changes.integrations).toEqual({
      applicationImports: { added: [], removed: [] },
      serverRoutes: { added: [], removed: [] },
      webRoutes: { added: [], removed: [] },
    });
    expect(changes.webPublicExports).toEqual([]);
    expect(changes.boundaryExportProvenance).toEqual([]);
    expect(changes.consumerEvidence).toEqual({
      added: [],
      removed: [],
    });
    expect(changes.removedPublicApiConsumers).toEqual([]);
    expect(changes.diagnostics).toEqual({ added: [], resolved: [] });
    expect(computeAffected(changes, target)).toMatchObject({
      scope: 'structural dependency impact',
      directlyChanged: [],
      downstream: [],
      all: [],
    });
  });

  it('detects an added and a removed feature', () => {
    const base: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('legacy')],
    };
    const target: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('billing')],
    };

    const changes = diffSnapshots(base, target);

    expect(changes.features).toEqual({ added: ['billing'], removed: ['legacy'] });
    expect(computeAffected(changes, target).directlyChanged).toEqual(['billing', 'legacy']);
  });

  it('detects added and removed public exports per feature', () => {
    const base: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('billing', { publicExports: ['oldApi'] })],
    };
    const target: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('billing', { publicExports: ['createInvoice'] })],
    };

    const changes = diffSnapshots(base, target);

    expect(changes.publicExports).toEqual([
      { feature: 'billing', added: ['createInvoice'], removed: ['oldApi'] },
    ]);
  });

  it('detects web public export changes and marks the provider directly changed', () => {
    const base: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [
        featureSnapshot('auth', { webPublicExports: [] }),
        featureSnapshot('users'),
      ],
      dependencies: [{ from: 'users', to: 'auth', imports: [], sourceFiles: [] }],
    };
    const target: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [
        featureSnapshot('auth', { webPublicExports: ['LoginPage'] }),
        featureSnapshot('users'),
      ],
      dependencies: [{ from: 'users', to: 'auth', imports: [], sourceFiles: [] }],
    };

    const changes = diffSnapshots(base, target);

    expect(changes.webPublicExports).toEqual([
      { feature: 'auth', added: ['LoginPage'], removed: [] },
    ]);
    expect(computeAffected(changes, target)).toMatchObject({
      directlyChanged: ['auth'],
      downstream: ['users'],
      all: ['auth', 'users'],
    });
  });

  it('detects added and removed contract exports per feature', () => {
    const base: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('billing', { contractExports: ['OldInput'] })],
    };
    const target: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('billing', { contractExports: ['NewInput'] })],
    };

    expect(diffSnapshots(base, target).contracts).toEqual([
      { feature: 'billing', added: ['NewInput'], removed: ['OldInput'] },
    ]);
  });

  it('connects removed public, web, and contract symbols to baseline consumers', () => {
    const baseEvidence = [
      importEvidence(),
      importEvidence({
        boundary: 'web',
        specifier: '@/features/auth/web',
        importedSymbol: 'LoginPage',
        localName: 'Page',
      }),
      importEvidence({
        importedSymbol: 'SessionUser',
        localName: 'SessionUser',
        typeOnly: true,
      }),
    ];
    const base: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [
        featureSnapshot('auth', {
          publicExports: ['requireAuth'],
          webPublicExports: ['LoginPage'],
          contractExports: ['SessionUser'],
          boundaryExports: {
            public: [boundaryExport()],
            web: [],
          },
        }),
        featureSnapshot('users'),
      ],
      importEvidence: baseEvidence,
    };
    const target: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('auth'), featureSnapshot('users')],
      importEvidence: baseEvidence,
    };

    const changes = diffSnapshots(base, target);

    expect(changes.removedPublicApiConsumers).toHaveLength(3);
    expect(changes.removedPublicApiConsumers).toEqual(
      expect.arrayContaining([
        {
          feature: 'auth',
          boundary: 'public',
          symbol: 'requireAuth',
          exportKind: 'public',
          change: 'removed',
          consumers: [
            {
              ...baseEvidence[0],
              targetState: 'still-imported',
            },
          ],
        },
        {
          feature: 'auth',
          boundary: 'web',
          symbol: 'LoginPage',
          exportKind: 'web',
          change: 'removed',
          consumers: [
            {
              ...baseEvidence[1],
              targetState: 'still-imported',
            },
          ],
        },
        {
          feature: 'auth',
          boundary: 'public',
          symbol: 'SessionUser',
          exportKind: 'contract',
          change: 'removed',
          consumers: [
            {
              ...baseEvidence[2],
              targetState: 'still-imported',
            },
          ],
        },
      ]),
    );
    expect(computeAffected(changes, target).directlyChanged).toEqual(['auth']);

    const consumerRemoved = diffSnapshots(base, {
      ...target,
      importEvidence: [],
    });
    expect(consumerRemoved.removedPublicApiConsumers.flatMap((impact) => impact.consumers.map((consumer) => consumer.targetState)))
      .toEqual(['removed-in-change', 'removed-in-change', 'removed-in-change']);
  });

  it('connects removed contract exports through direct public and web aliases', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'auth', {
      'index.ts': "export type { SessionUser as CurrentUser } from './contract';\n",
      'web/index.ts': "export type { SessionUser as BrowserUser } from '../contract';\n",
      'contract.ts': 'export interface SessionUser { id: string };\n',
    });
    writeFeature(fixture, 'users', {
      'index.ts': "import type { CurrentUser } from '@/features/auth';\n",
      'web/client.ts': "import type { BrowserUser } from '@/features/auth/web';\n",
    });
    const base = captureArchitectureSnapshot(fixture);
    writeFeature(fixture, 'auth', {
      'index.ts': "export type { SessionUser as CurrentUser } from './contract';\n",
      'web/index.ts': "export type { SessionUser as BrowserUser } from '../contract';\n",
      'contract.ts': 'export interface Replacement { id: string };\n',
    });
    const target = captureArchitectureSnapshot(fixture);

    const changes = diffSnapshots(base, target);
    expect(changes.publicExports).toEqual([]);
    expect(changes.webPublicExports).toEqual([]);
    expect(changes.removedPublicApiConsumers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feature: 'auth',
          boundary: 'public',
          symbol: 'SessionUser',
          exportKind: 'contract',
          consumers: [
            expect.objectContaining({
              importedSymbol: 'CurrentUser',
              targetState: 'still-imported',
            }),
          ],
        }),
        expect.objectContaining({
          feature: 'auth',
          boundary: 'web',
          symbol: 'SessionUser',
          exportKind: 'contract',
          consumers: [
            expect.objectContaining({
              importedSymbol: 'BrowserUser',
              targetState: 'still-imported',
            }),
          ],
        }),
      ]),
    );
    expect(changes.removedPublicApiConsumers).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exportKind: 'contract',
          consumers: [expect.objectContaining({ importedSymbol: 'SessionUser' })],
        }),
      ]),
    );
  });

  it('rejects same-name local boundary exports as contract provenance', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'provider', {
      'index.ts': "export const Status = 'ready';\n",
      'contract.ts': 'export interface Status {}\n',
    });
    writeFeature(fixture, 'consumer', {
      'index.ts': "import { Status } from '@/features/provider';\n",
    });
    const base = captureArchitectureSnapshot(fixture);
    writeFeature(fixture, 'provider', {
      'index.ts': "export const Status = 'ready';\n",
      'contract.ts': 'export interface Replacement {}\n',
    });
    const target = captureArchitectureSnapshot(fixture);

    const changes = diffSnapshots(base, target);
    expect(changes.contracts).toEqual([
      { feature: 'provider', added: ['Replacement'], removed: ['Status'] },
    ]);
    expect(changes.removedPublicApiConsumers).toEqual([]);
  });

  it('does not infer contract provenance through unrelated re-exports or export-all', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'provider', {
      'index.ts': "export { SessionUser as CurrentUser } from './other';\nexport * from './contract';\n",
      'contract.ts': 'export interface SessionUser {}\n',
      'other.ts': 'export interface SessionUser {}\n',
    });
    writeFeature(fixture, 'consumer', {
      'index.ts': `import type { CurrentUser, SessionUser } from '@/features/provider';
`,
    });
    const base = captureArchitectureSnapshot(fixture);
    writeFeature(fixture, 'provider', {
      'index.ts': "export { SessionUser as CurrentUser } from './other';\nexport * from './contract';\n",
      'contract.ts': 'export interface Replacement {}\n',
      'other.ts': 'export interface SessionUser {}\n',
    });
    const target = captureArchitectureSnapshot(fixture);

    const changes = diffSnapshots(base, target);
    expect(changes.contracts).toEqual([
      { feature: 'provider', added: ['Replacement'], removed: ['SessionUser'] },
    ]);
    expect(changes.removedPublicApiConsumers).toEqual([]);
  });

  it('reports same-name boundary provenance changes without export-name deltas', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'auth', {
      'index.ts': "export { User } from './contract';\n",
      'web/index.ts': "export { User as BrowserUser } from '../contract';\n",
      'contract.ts': 'export interface User {}\n',
      'server/user.ts': 'export interface User {}\nexport interface AccountUser {}\n',
    });
    const base = captureArchitectureSnapshot(fixture);
    writeFeature(fixture, 'auth', {
      'index.ts': "export { User } from './server/user';\n",
      'web/index.ts': "export { AccountUser as BrowserUser } from '../server/user';\n",
      'contract.ts': 'export interface User {}\n',
      'server/user.ts': 'export interface User {}\nexport interface AccountUser {}\n',
    });
    const target = captureArchitectureSnapshot(fixture);

    const changes = diffSnapshots(base, target);
    expect(changes.publicExports).toEqual([]);
    expect(changes.webPublicExports).toEqual([]);
    expect(changes.boundaryExportProvenance).toEqual([
      {
        feature: 'auth',
        boundary: 'public',
        exportedName: 'User',
        removed: [
          expect.objectContaining({
            sourceSpecifier: './contract',
            sourceSymbol: 'User',
          }),
        ],
        added: [
          expect.objectContaining({
            sourceSpecifier: './server/user',
            sourceSymbol: 'User',
          }),
        ],
      },
      {
        feature: 'auth',
        boundary: 'web',
        exportedName: 'BrowserUser',
        removed: [
          expect.objectContaining({
            sourceSpecifier: '../contract',
            sourceSymbol: 'User',
          }),
        ],
        added: [
          expect.objectContaining({
            sourceSpecifier: '../server/user',
            sourceSymbol: 'AccountUser',
          }),
        ],
      },
    ]);
    expect(computeAffected(changes, target).directlyChanged).toEqual(['auth']);
  });

  it('does not claim symbol impact for module-level namespace evidence', () => {
    const moduleImport = importEvidence({
      kind: 'namespace-import',
      precision: 'module',
      importedSymbol: undefined,
      localName: 'Auth',
    });
    const base: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('auth', { publicExports: ['requireAuth'] }), featureSnapshot('users')],
      importEvidence: [moduleImport],
    };
    const target: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('auth'), featureSnapshot('users')],
      importEvidence: [],
    };

    const changes = diffSnapshots(base, target);

    expect(changes.consumerEvidence.removed).toEqual([moduleImport]);
    expect(changes.removedPublicApiConsumers).toEqual([]);
  });

  it('treats an alias-only consumer change as still imported', () => {
    const base: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('auth', { publicExports: ['requireAuth'] }), featureSnapshot('users')],
      importEvidence: [importEvidence({ localName: 'authenticate' })],
    };
    const target: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('auth'), featureSnapshot('users')],
      importEvidence: [importEvidence({ localName: 'authorize' })],
    };

    const changes = diffSnapshots(base, target);

    expect(changes.publicExports).toEqual([
      { feature: 'auth', added: [], removed: ['requireAuth'] },
    ]);
    expect(changes.consumerEvidence.added).toHaveLength(1);
    expect(changes.consumerEvidence.removed).toHaveLength(1);
    expect(changes.removedPublicApiConsumers[0]?.consumers[0]?.targetState).toBe('still-imported');
  });

  it('detects added and removed dependency edges with evidence', () => {
    const base: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('a'), featureSnapshot('b'), featureSnapshot('c')],
      dependencies: [
        { from: 'a', to: 'b', imports: ['@/features/b'], sourceFiles: ['src/features/a/index.ts'] },
      ],
    };
    const target: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('a'), featureSnapshot('b'), featureSnapshot('c')],
      dependencies: [
        { from: 'a', to: 'c', imports: ['@/features/c'], sourceFiles: ['src/features/a/index.ts'] },
      ],
    };

    const changes = diffSnapshots(base, target);

    expect(changes.dependencies.added).toEqual([
      { from: 'a', to: 'c', imports: ['@/features/c'], sourceFiles: ['src/features/a/index.ts'] },
    ]);
    expect(changes.dependencies.removed).toEqual([
      { from: 'a', to: 'b', imports: ['@/features/b'], sourceFiles: ['src/features/a/index.ts'] },
    ]);
  });

  it('reports symbol consumer changes and seeds only consuming Features', () => {
    const typeEvidence = importEvidence({
      importedSymbol: 'SessionUser',
      localName: 'SessionUser',
      typeOnly: true,
    });
    const base: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('auth'), featureSnapshot('users'), featureSnapshot('reports')],
      dependencies: [
        { from: 'users', to: 'auth', imports: [], sourceFiles: [] },
        { from: 'reports', to: 'users', imports: [], sourceFiles: [] },
      ],
    };
    const target: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('auth'), featureSnapshot('users'), featureSnapshot('reports')],
      dependencies: base.dependencies,
      importEvidence: [importEvidence(), typeEvidence],
    };

    const changes = diffSnapshots(base, target);

    expect(changes.consumerEvidence.removed).toEqual([]);
    expect(changes.consumerEvidence.added).toEqual(
      expect.arrayContaining([importEvidence(), typeEvidence]),
    );
    expect(changes.consumerEvidence.added).toHaveLength(2);
    expect(computeAffected(changes, target)).toMatchObject({
      directlyChanged: ['users'],
      downstream: ['reports'],
      all: ['reports', 'users'],
    });
  });

  it('detects added and removed server, web, and test surfaces', () => {
    const base: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [
        featureSnapshot('billing', {
          serverSurfaces: ['server/old.ts'],
          webSurfaces: ['web/page.ts'],
          testSurfaces: [],
        }),
      ],
    };
    const target: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [
        featureSnapshot('billing', {
          serverSurfaces: ['server/routes.ts'],
          webSurfaces: ['web/page.ts'],
          testSurfaces: ['tests/billing.test.ts'],
        }),
      ],
    };

    const changes = diffSnapshots(base, target);

    expect(changes.surfaces).toEqual([
      { feature: 'billing', kind: 'server', added: ['server/routes.ts'], removed: ['server/old.ts'] },
      { feature: 'billing', kind: 'test', added: ['tests/billing.test.ts'], removed: [] },
    ]);
  });

  it('reports application integration changes and seeds affected Features', () => {
    const usersBase = {
      applicationImports: [
        {
          feature: 'users',
          appFile: 'src/app/server.ts',
          boundary: 'public' as const,
          symbols: ['userRoutes'],
        },
      ],
      serverRoutes: [
        {
          feature: 'users',
          appFile: 'src/app/server.ts',
          exportName: 'userRoutes',
          mountPath: '/api/users',
        },
      ],
      webRoutes: [
        {
          feature: 'users',
          appFile: 'src/app/router.ts',
          exportName: 'UsersPage',
          path: '/users',
          name: 'users',
        },
      ],
    };
    const usersTarget = {
      applicationImports: [
        {
          feature: 'users',
          appFile: 'src/app/server.ts',
          boundary: 'public' as const,
          symbols: ['userRoutes', 'resetUsers'],
        },
      ],
      serverRoutes: [
        {
          feature: 'users',
          appFile: 'src/app/server.ts',
          exportName: 'userRoutes',
          mountPath: '/api/members',
        },
      ],
      webRoutes: [
        {
          feature: 'users',
          appFile: 'src/app/router.ts',
          exportName: 'UsersPage',
          path: '/people',
          name: 'people',
        },
      ],
    };
    const base: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('users', { integrations: usersBase }), featureSnapshot('billing')],
      dependencies: [{ from: 'billing', to: 'users', imports: [], sourceFiles: [] }],
    };
    const target: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('users', { integrations: usersTarget }), featureSnapshot('billing')],
      dependencies: [{ from: 'billing', to: 'users', imports: [], sourceFiles: [] }],
    };

    const changes = diffSnapshots(base, target);

    expect(changes.integrations.applicationImports).toEqual({
      added: [{ ...usersTarget.applicationImports[0] }],
      removed: [{ ...usersBase.applicationImports[0] }],
    });
    expect(changes.integrations.serverRoutes).toEqual({
      added: [usersTarget.serverRoutes[0]],
      removed: [usersBase.serverRoutes[0]],
    });
    expect(changes.integrations.webRoutes).toEqual({
      added: [usersTarget.webRoutes[0]],
      removed: [usersBase.webRoutes[0]],
    });
    expect(computeAffected(changes, target)).toMatchObject({
      directlyChanged: ['users'],
      downstream: ['billing'],
      all: ['billing', 'users'],
    });
  });

  it('detects newly introduced and resolved doctor diagnostics', () => {
    const base: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('billing')],
      diagnostics: [
        { code: 'CROSS_FEATURE_INTERNAL_IMPORT', file: 'src/features/billing/index.ts', relationship: 'billing -> users' },
      ],
    };
    const target: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('billing')],
      diagnostics: [
        { code: 'CIRCULAR_FEATURE_DEPENDENCY', file: 'src/features/billing/index.ts', relationship: 'billing -> billing' },
      ],
    };

    const changes = diffSnapshots(base, target);

    expect(changes.diagnostics.added).toEqual([
      { code: 'CIRCULAR_FEATURE_DEPENDENCY', file: 'src/features/billing/index.ts', relationship: 'billing -> billing' },
    ]);
    expect(changes.diagnostics.resolved).toEqual([
      { code: 'CROSS_FEATURE_INTERNAL_IMPORT', file: 'src/features/billing/index.ts', relationship: 'billing -> users' },
    ]);
  });

  it('computes direct and transitive structural impact without claiming behavior', () => {
    const target: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('users'), featureSnapshot('billing'), featureSnapshot('reports')],
      dependencies: [
        { from: 'billing', to: 'users', imports: [], sourceFiles: [] },
        { from: 'reports', to: 'billing', imports: [], sourceFiles: [] },
      ],
    };
    const base: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('users'), featureSnapshot('billing'), featureSnapshot('reports')],
      dependencies: [],
    };

    const changes = diffSnapshots(base, target);
    const affected = computeAffected(changes, target);

    expect(affected.scope).toBe('structural dependency impact');
    expect(affected.directlyChanged).toEqual(['billing', 'reports', 'users']);
    // reports depends on billing which depends on users; changing users
    // structurally reaches both, but they are already directly changed here.
    // A narrower change shows transitive reach:
    const narrow = diffSnapshots(
      {
        ...emptySnapshot(),
        features: [featureSnapshot('users', { publicExports: ['a'] })],
      },
      {
        ...emptySnapshot(),
        features: [featureSnapshot('users', { publicExports: ['a', 'b'] })],
      },
    );
    const narrowTarget: ArchitectureSnapshot = {
      ...emptySnapshot(),
      features: [featureSnapshot('users'), featureSnapshot('billing'), featureSnapshot('reports')],
      dependencies: [
        { from: 'billing', to: 'users', imports: [], sourceFiles: [] },
        { from: 'reports', to: 'billing', imports: [], sourceFiles: [] },
      ],
    };
    // Re-target the narrow export change onto the connected graph.
    const narrowAffected = computeAffected(
      { ...narrow, features: { added: [], removed: [] } },
      narrowTarget,
    );
    // Direct: users; downstream: billing (direct dependent) + reports (transitive).
    expect(narrowAffected.directlyChanged).toEqual(['users']);
    expect(narrowAffected.downstream).toEqual(['billing', 'reports']);
    expect(narrowAffected.all).toEqual(['billing', 'reports', 'users']);
  });

  it('captures end-to-end fixture changes through real discovery', () => {
    // End-to-end through real fixtures: an added export plus a new edge.
    const fixture = createFixture();
    writeFeature(fixture, 'users', { 'index.ts': 'export const users = 1;\n' });
    const base = captureArchitectureSnapshot(fixture);
    writeFeature(fixture, 'billing', {
      'index.ts': "import '@/features/users';\nexport const billing = 1;\nexport const createInvoice = 1;\n",
    });
    const target = captureArchitectureSnapshot(fixture);

    const changes = diffSnapshots(base, target);
    expect(changes.features).toEqual({ added: ['billing'], removed: [] });
    expect(changes.dependencies.added.map((edge) => `${edge.from}->${edge.to}`)).toEqual([
      'billing->users',
    ]);
  });
});
