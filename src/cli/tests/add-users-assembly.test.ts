import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildFeatureContext } from '../architecture/context';
import { analyzeArchitecture } from '../architecture/doctor';
import { discoverFeatureIntegrations } from '../architecture/discover-integrations';
import { inspectFeature } from '../architecture/inspect';
import { resolveOfficialFeatureDirectory } from '../package-root';
import { discoverMigrations } from '../../shared/database/migrator';
import { featureFilesEqual, readFeatureFiles, readFeatureLineage } from '../evolution/lineage';
import { evolveFeature } from '../commands/evolve';
import { installOfficialFeature } from '../composition/install-feature';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-users-assembly-'));
  fixtures.push(fixture);
  return fixture;
}

function writeFiles(directory: string, files: Record<string, string>): void {
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(directory, ...relative.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

const MINIMAL_SERVER_ROOT = `import { Hono } from 'hono';\n\nexport const app = new Hono();\n`;

const MINIMAL_ROUTER_ROOT = `import { createRouter, createWebHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';

export default createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: HomePage,
    },
  ],
});
`;

const AUTH_BOUNDARY = `export const createAccountWithRoles = (): unknown => ({});
export const deleteAccounts = (): number => 0;
export const findAccountById = (): undefined => undefined;
export const findAllRoles = (): Array<{ id: string; slug: string }> => [];
export const getCurrentUser = (): undefined => undefined;
export const getUserRoles = (): Array<{ slug: string }> => [];
export const getUsersWithRole = (): Array<{ id: string }> => [];
export const hashPassword = async (password: string): Promise<string> => password;
export const hasPermission = (): boolean => false;
export const isAdmin = (): boolean => false;
export const listAccounts = (): { data: unknown[]; total: number } => ({ data: [], total: 0 });
export const resetAccountPassword = (): undefined => undefined;
export const SESSION_COOKIE_NAME = 'auth_id';
export const updateAccountWithRoles = (): undefined => undefined;
`;
const AUTH_WEB_BOUNDARY = `export const createAccessClient = (): unknown => ({});
export const createAuthClient = (): unknown => ({});
export const csrfHeaders = (): Record<string, string> => ({});
export const ensureCsrfToken = async (): Promise<void> => {};
export const useAuthSession = (): unknown => ({});
`;

const FIXTURE_PACKAGE_JSON = `{
  "name": "fixture",
  "version": "0.0.0",
  "dependencies": {}
}
`;

function projectShell(fixture: string, options: { auth?: string; authWeb?: string; packageJson?: string } = {}): void {
  writeFiles(fixture, {
    'src/app/server.ts': MINIMAL_SERVER_ROOT,
    'src/app/router.ts': MINIMAL_ROUTER_ROOT,
    'package.json': options.packageJson ?? FIXTURE_PACKAGE_JSON,
    'src/features/auth/index.ts': options.auth ?? AUTH_BOUNDARY,
    'src/features/auth/web/index.ts': options.authWeb ?? AUTH_WEB_BOUNDARY,
  });
}

function officialSource(): string {
  const directory = resolveOfficialFeatureDirectory('users');
  if (!existsSync(directory)) throw new Error('Official users package is missing.');
  return directory;
}

function stageFiles(root: string): string[] {
  const found: string[] = [];
  function visit(directory: string): void {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && full.endsWith('.nara-add-stage')) found.push(full);
    }
  }
  visit(root);
  return found;
}

describe('users feature assembly', () => {
  it('installs the substantial assembly as one transaction', () => {
    const fixture = createFixture();
    projectShell(fixture);

    const result = installOfficialFeature('users', fixture);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(existsSync(path.join(fixture, 'src/features/users/contract.ts'))).toBe(true);
    expect(existsSync(path.join(fixture, 'src/features/users/server/routes.ts'))).toBe(true);
    expect(existsSync(path.join(fixture, 'src/features/users/server/host.ts'))).toBe(true);
    expect(existsSync(path.join(fixture, 'src/features/users/web/host.ts'))).toBe(true);
    expect(existsSync(path.join(fixture, 'src/features/users/web/pages/UsersPage.vue'))).toBe(true);
    expect(existsSync(path.join(fixture, 'src/features/users/server/migrations/202609030007_create_assets.sql'))).toBe(
      true,
    );
    expect(existsSync(path.join(fixture, 'src/features/users/server/migrations/202609030008_assets_owner_reference.sql'))).toBe(
      true,
    );
    expect(existsSync(path.join(fixture, 'src/features/users/server/migrations/202609030001_create_users.sql'))).toBe(
      false,
    );
    const serverBinding = path.join(fixture, 'src/app/bindings/users.server.ts');
    const webBinding = path.join(fixture, 'src/app/bindings/users.web.ts');
    expect(result.feature.bindings).toEqual([serverBinding, webBinding].sort());
    expect(result.feature.composedRoots).toEqual(
      [path.join(fixture, 'src/app/server.ts'), path.join(fixture, 'src/app/router.ts')].sort(),
    );
    expect(readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8')).toContain('composeUsersServer(app);');
    expect(readFileSync(path.join(fixture, 'src/app/router.ts'), 'utf8')).toContain('...usersWebRoutes,');
    expect(readFeatureLineage(fixture, 'users')).toBeDefined();

    const integrations = discoverFeatureIntegrations(fixture).users;
    expect(integrations.serverRoutes).toEqual(
      expect.arrayContaining([
        { feature: 'users', appFile: 'src/app/server.ts', exportName: 'createUserRoutes', mountPath: '/api/users' },
        { feature: 'users', appFile: 'src/app/server.ts', exportName: 'createAssetRoutes', mountPath: '/api/assets' },
      ]),
    );
    expect(integrations.webRoutes).toEqual(
      expect.arrayContaining([
        { feature: 'users', appFile: 'src/app/router.ts', exportName: 'UsersPage', path: '/users', name: 'users' },
        {
          feature: 'users',
          appFile: 'src/app/router.ts',
          exportName: 'ProfilePage',
          path: '/profile',
          name: 'profile',
        },
      ]),
    );
    expect(analyzeArchitecture(fixture).healthy).toBe(true);
  });

  it('leaves the feature graph free of an auth dependency with bindings in reading order', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const installed = installOfficialFeature('users', fixture);
    expect(installed.ok).toBe(true);

    const inspection = inspectFeature('users', fixture);
    expect(inspection.ok).toBe(true);
    if (!inspection.ok) return;
    expect(inspection.feature.dependencies).toEqual([]);

    const context = buildFeatureContext('users', fixture);
    expect(context.ok).toBe(true);
    if (!context.ok) return;
    const order = context.context.readingOrder.map((entry) => entry.path);
    expect(order).toContain('src/app/bindings/users.server.ts');
    expect(order).toContain('src/app/bindings/users.web.ts');
  });

  it('discovers users-owned migrations by convention', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const installed = installOfficialFeature('users', fixture);
    expect(installed.ok).toBe(true);

    const migrations = discoverMigrations({ root: fixture });
    const usersMigrations = migrations.filter((migration) => migration.path.includes(`${path.sep}users${path.sep}`));
    expect(usersMigrations.map((migration) => migration.name).sort()).toEqual([
      '202609030007_create_assets.sql',
      '202609030008_assets_owner_reference.sql',
    ]);
  });

  it('fails closed without the auth provider and without mutation', () => {
    const fixture = createFixture();
    writeFiles(fixture, {
      'src/app/server.ts': MINIMAL_SERVER_ROOT,
      'src/app/router.ts': MINIMAL_ROUTER_ROOT,
      'package.json': FIXTURE_PACKAGE_JSON,
    });
    const serverBefore = readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8');

    const result = installOfficialFeature('users', fixture);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('prerequisite');
    expect(result.error.message).toContain('"auth"');
    expect(existsSync(path.join(fixture, 'src/features/users'))).toBe(false);
    expect(existsSync(path.join(fixture, '.nara/lineage'))).toBe(false);
    expect(existsSync(path.join(fixture, 'src/app/bindings'))).toBe(false);
    expect(readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8')).toBe(serverBefore);
    expect(stageFiles(fixture)).toEqual([]);
  });

  it('fails closed when the provider lacks a required symbol', () => {
    const fixture = createFixture();
    projectShell(fixture, {
      auth: AUTH_BOUNDARY.replace('export const resetAccountPassword = (): undefined => undefined;\n', ''),
    });

    const result = installOfficialFeature('users', fixture);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('prerequisite');
    expect(result.error.message).toContain('resetAccountPassword');
    expect(existsSync(path.join(fixture, 'src/features/users'))).toBe(false);
    expect(existsSync(path.join(fixture, 'src/app/bindings'))).toBe(false);
    expect(stageFiles(fixture)).toEqual([]);
  });

  it('refuses a binding collision without mutation or stage artifacts', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const binding = path.join(fixture, 'src/app/bindings/users.server.ts');
    mkdirSync(path.dirname(binding), { recursive: true });
    writeFileSync(binding, 'local binding\n');

    const result = installOfficialFeature('users', fixture);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('duplicate');
    expect(readFileSync(binding, 'utf8')).toBe('local binding\n');
    expect(existsSync(path.join(fixture, 'src/features/users'))).toBe(false);
    expect(stageFiles(fixture)).toEqual([]);
  });

  it('keeps customized bindings byte-identical across evolution with pure incoming base', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const installed = installOfficialFeature('users', fixture);
    expect(installed.ok).toBe(true);

    const binding = path.join(fixture, 'src/app/bindings/users.server.ts');
    writeFileSync(binding, `${readFileSync(binding, 'utf8')}// Local policy: deny role assignment on Fridays.\n`);
    const customized = readFileSync(binding, 'utf8');

    const incoming = mkdtempSync(path.join(os.tmpdir(), 'nara-users-incoming-'));
    fixtures.push(incoming);
    const officialFiles = readFeatureFiles(officialSource(), false);
    for (const [relative, bytes] of officialFiles) {
      const file = path.join(incoming, ...relative.split('/'));
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, bytes);
    }
    const incomingIndex = path.join(incoming, 'index.ts');
    writeFileSync(incomingIndex, `${readFileSync(incomingIndex, 'utf8')}\nexport const usersNext = 'incoming';\n`);

    const evolved = evolveFeature({ feature: 'users', cwd: fixture, officialDirectory: incoming });
    expect(evolved.ok).toBe(true);
    if (!evolved.ok) return;
    expect(evolved.plan.status).toBe('applied');
    expect(readFileSync(path.join(fixture, 'src/features/users/index.ts'), 'utf8')).toContain(
      "usersNext = 'incoming'",
    );
    expect(readFileSync(binding, 'utf8')).toEqual(customized);

    const lineage = readFeatureLineage(fixture, 'users');
    expect(lineage).toBeDefined();
    if (!lineage) return;
    expect(featureFilesEqual(lineage.files, readFeatureFiles(incoming, false))).toBe(true);
    expect(lineage.files.has('src/app/bindings/users.server.ts')).toBe(false);
    expect(analyzeArchitecture(fixture).healthy).toBe(true);
  });
});
