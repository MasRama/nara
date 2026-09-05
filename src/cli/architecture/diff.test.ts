import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { computeAffected, diffSnapshots } from './diff';
import { captureArchitectureSnapshot, type ArchitectureSnapshot } from './snapshot';

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
  return { schemaVersion: 1, features: [], dependencies: [], diagnostics: [] };
}

function featureSnapshot(
  name: string,
  overrides: Partial<{
    publicExports: string[];
    contractExports: string[];
    serverSurfaces: string[];
    webSurfaces: string[];
    testSurfaces: string[];
    integrations: ArchitectureSnapshot['features'][number]['integrations'];
  }> = {},
): ArchitectureSnapshot['features'][number] {
  return {
    name,
    publicExports: [],
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
