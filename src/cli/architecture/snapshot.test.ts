import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { captureArchitectureSnapshot } from './snapshot';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-snapshot-'));
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

describe('architecture snapshot', () => {
  it('captures features in deterministic sorted order', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', { 'index.ts': 'export const users = 1;\n' });
    writeFeature(fixture, 'billing', {
      'index.ts': 'export const billing = 1;\n',
      'contract.ts': 'export type BillingInput = { id: string };\n',
      'server/routes.ts': 'export const routes = 1;\n',
      'web/page.ts': 'export const page = 1;\n',
      'tests/billing.test.ts': 'export const test = 1;\n',
    });

    const snapshot = captureArchitectureSnapshot(fixture);

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.features.map((feature) => feature.name)).toEqual(['billing', 'users']);
    expect(snapshot.features[0]).toMatchObject({
      name: 'billing',
      publicExports: ['billing'],
      contractExports: ['BillingInput'],
      serverSurfaces: ['server/routes.ts'],
      webSurfaces: ['web/page.ts'],
      testSurfaces: ['tests/billing.test.ts'],
    });
  });

  it('produces stable output without timestamps or absolute paths', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    mkdirSync(path.join(fixture, 'src/app'), { recursive: true });
    writeFileSync(
      path.join(fixture, 'src/app/server.ts'),
      `import { Hono } from 'hono';
import { healthRoutes } from '../features/health';
const app = new Hono();
app.route('/health', healthRoutes);
`,
    );

    const first = JSON.stringify(captureArchitectureSnapshot(fixture));
    const second = JSON.stringify(captureArchitectureSnapshot(fixture));

    expect(second).toBe(first);
    expect(first).not.toContain(fixture);
    expect(first).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('persists public and web consumer evidence with relative paths', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'auth', {
      'index.ts': 'export const requireAuth = true;\nexport type SessionUser = { id: string };\n',
      'web/index.ts': 'export const LoginPage = true;\n',
    });
    writeFeature(fixture, 'users', {
      'index.ts': `import { requireAuth as authenticate, type SessionUser } from '@/features/auth';
`,
      'web/router.ts': "import { LoginPage as Page } from '@/features/auth/web';\n",
    });

    const snapshot = captureArchitectureSnapshot(fixture);
    const auth = snapshot.features.find((feature) => feature.name === 'auth');

    expect(auth?.webPublicExports).toEqual(['LoginPage']);
    expect(snapshot.importEvidence).toHaveLength(3);
    expect(snapshot.importEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'users',
          to: 'auth',
          sourceFile: 'src/features/users/index.ts',
          boundary: 'public',
          importedSymbol: 'requireAuth',
          localName: 'authenticate',
          precision: 'symbol',
          typeOnly: false,
        }),
        expect.objectContaining({
          from: 'users',
          to: 'auth',
          sourceFile: 'src/features/users/index.ts',
          boundary: 'public',
          importedSymbol: 'SessionUser',
          precision: 'symbol',
          typeOnly: true,
        }),
        expect.objectContaining({
          from: 'users',
          to: 'auth',
          sourceFile: 'src/features/users/web/router.ts',
          boundary: 'web',
          importedSymbol: 'LoginPage',
          localName: 'Page',
          precision: 'symbol',
          typeOnly: false,
        }),
      ]),
    );
    for (const evidence of snapshot.importEvidence) {
      expect(path.isAbsolute(evidence.sourceFile)).toBe(false);
      expect(evidence.sourceFile).not.toContain('\\\\');
    }
  });

  it('sorts dependencies and diagnostics deterministically', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', { 'index.ts': 'export const users = 1;\n' });
    writeFeature(fixture, 'billing', {
      'index.ts': "import '@/features/users';\nexport const billing = 1;\n",
    });
    writeFeature(fixture, 'reports', {
      'index.ts': "import '@/features/users';\nimport '@/features/billing';\nexport const reports = 1;\n",
    });

    const snapshot = captureArchitectureSnapshot(fixture);

    expect(snapshot.dependencies.map((edge) => `${edge.from}->${edge.to}`)).toEqual([
      'billing->users',
      'reports->billing',
      'reports->users',
    ]);
    for (const edge of snapshot.dependencies) {
      expect([...edge.imports].sort()).toEqual(edge.imports);
      expect([...edge.sourceFiles].sort()).toEqual(edge.sourceFiles);
      for (const file of edge.sourceFiles) {
        expect(path.isAbsolute(file)).toBe(false);
        expect(file).not.toContain('\\');
      }
    }

  });
  it('captures application integrations for each Feature', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', {
      'index.ts': 'export const userRoutes = true;\n',
      'web/index.ts': 'export { default as UsersPage } from "./UsersPage.vue";\n',
    });
    mkdirSync(path.join(fixture, 'src/app'), { recursive: true });
    writeFileSync(
      path.join(fixture, 'src/app/server.ts'),
      `import { Hono } from 'hono';
import { userRoutes } from '../features/users';
const app = new Hono();
app.route('/api/users', userRoutes);
`,
    );
    writeFileSync(
      path.join(fixture, 'src/app/router.ts'),
      `import { createRouter } from 'vue-router';
import { UsersPage } from '../features/users/web';
createRouter({ routes: [{ path: '/users', name: 'users', component: UsersPage }] });
`,
    );

    const snapshot = captureArchitectureSnapshot(fixture);

    expect(snapshot.features).toHaveLength(1);
    expect(snapshot.features[0].integrations).toEqual({
      applicationImports: [
        {
          feature: 'users',
          appFile: 'src/app/router.ts',
          boundary: 'web',
          symbols: ['UsersPage'],
        },
        {
          feature: 'users',
          appFile: 'src/app/server.ts',
          boundary: 'public',
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
    });
  });
});
