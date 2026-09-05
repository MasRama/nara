import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli, type CliIO } from '../router';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createIO(): CliIO & { output: string[]; errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    output,
    errors,
    stdout: (message) => output.push(message),
    stderr: (message) => errors.push(message),
  };
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function initRepo(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nara-diff-cli-'));
  fixtures.push(directory);
  git(directory, 'init');
  git(directory, 'config', 'user.email', 'nara-diff@example.com');
  git(directory, 'config', 'user.name', 'nara diff');
  return directory;
}

function commitAll(cwd: string, message: string): string {
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-m', message);
  return git(cwd, 'rev-parse', 'HEAD');
}

function writeFeature(cwd: string, name: string, files: Record<string, string>): void {
  const directory = path.join(cwd, 'src/features', name);
  for (const [file, content] of Object.entries(files)) {
    const filePath = path.join(directory, file);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
}

function writeFile(cwd: string, relativePath: string, content: string): void {
  const filePath = path.join(cwd, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function runDiff(cwd: string, args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const io = createIO();
  const result = runCli(['diff', ...args], io, { cwd });
  return { exitCode: result.exitCode, stdout: io.output.join(''), stderr: io.errors.join('') };
}

function runDiffJson(cwd: string, args: string[]): { exitCode: number; json: Record<string, unknown>; stderr: string } {
  const outcome = runDiff(cwd, [...args, '--json']);
  expect(outcome.exitCode).toBe(0);
  return { exitCode: outcome.exitCode, json: JSON.parse(outcome.stdout) as Record<string, unknown>, stderr: outcome.stderr };
}

describe('nara diff', () => {
  it('reports no architecture change for a clean tree', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'base');

    const outcome = runDiff(repo, ['--base', 'HEAD']);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('No architecture changes detected');
  });

  it('detects an added feature from uncommitted changes', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'base');
    writeFeature(repo, 'billing', { 'index.ts': 'export const billing = 1;\n' });

    const { json } = runDiffJson(repo, ['--base', 'HEAD']);
    const changes = json.changes as { features: { added: string[]; removed: string[] } };
    expect(changes.features).toEqual({ added: ['billing'], removed: [] });
    const affected = json.affected as { directlyChanged: string[]; scope: string };
    expect(affected.directlyChanged).toContain('billing');
    expect(affected.scope).toBe('structural dependency impact');
  });

  it('detects a removed feature from uncommitted deletion', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    writeFeature(repo, 'legacy', { 'index.ts': 'export const legacy = 1;\n' });
    commitAll(repo, 'base');
    rmSync(path.join(repo, 'src/features/legacy'), { recursive: true, force: true });

    const { json } = runDiffJson(repo, ['--base', 'HEAD']);
    const changes = json.changes as { features: { added: string[]; removed: string[] } };
    expect(changes.features).toEqual({ added: [], removed: ['legacy'] });
  });

  it('detects added and removed public exports', () => {
    const repo = initRepo();
    writeFeature(repo, 'billing', { 'index.ts': 'export const oldApi = 1;\n' });
    commitAll(repo, 'base');
    writeFeature(repo, 'billing', { 'index.ts': 'export const createInvoice = 1;\n' });

    const { json } = runDiffJson(repo, ['--base', 'HEAD']);
    const changes = json.changes as {
      publicExports: Array<{ feature: string; added: string[]; removed: string[] }>;
    };
    expect(changes.publicExports).toEqual([
      { feature: 'billing', added: ['createInvoice'], removed: ['oldApi'] },
    ]);
  });

  it('detects added and removed contract exports', () => {
    const repo = initRepo();
    writeFeature(repo, 'billing', {
      'index.ts': 'export const billing = 1;\n',
      'contract.ts': 'export type OldInput = { id: string };\n',
    });
    commitAll(repo, 'base');
    writeFeature(repo, 'billing', {
      'index.ts': 'export const billing = 1;\n',
      'contract.ts': 'export type NewInput = { id: string };\n',
    });

    const { json } = runDiffJson(repo, ['--base', 'HEAD']);
    const changes = json.changes as {
      contracts: Array<{ feature: string; added: string[]; removed: string[] }>;
    };
    expect(changes.contracts).toEqual([{ feature: 'billing', added: ['NewInput'], removed: ['OldInput'] }]);
  });
  it('reports public boundary provenance changes in JSON and human output', () => {
    const repo = initRepo();
    writeFeature(repo, 'auth', {
      'index.ts': "export { User } from './contract';\n",
      'contract.ts': 'export interface User {}\n',
    });
    writeFeature(repo, 'users', {
      'index.ts': "import type { User } from '@/features/auth';\n",
    });
    commitAll(repo, 'base');
    writeFeature(repo, 'auth', {
      'index.ts': "export { User } from './server/user';\n",
      'contract.ts': 'export interface User {}\n',
      'server/user.ts': 'export interface User {}\n',
    });

    const changed = runDiffJson(repo, ['--base', 'HEAD']);
    const changes = changed.json.changes as {
      publicExports: unknown[];
      boundaryExportProvenance: Array<{
        feature: string;
        boundary: string;
        exportedName: string;
        added: Array<{ sourceSpecifier?: string; sourceSymbol?: string }>;
        removed: Array<{ sourceSpecifier?: string; sourceSymbol?: string }>;
      }>;
    };
    expect(changes.publicExports).toEqual([]);
    expect(changes.boundaryExportProvenance).toEqual([
      {
        feature: 'auth',
        boundary: 'public',
        exportedName: 'User',
        removed: [
          expect.objectContaining({ sourceSpecifier: './contract', sourceSymbol: 'User' }),
        ],
        added: [
          expect.objectContaining({ sourceSpecifier: './server/user', sourceSymbol: 'User' }),
        ],
      },
    ]);
    expect(changed.json.affected).toMatchObject({ directlyChanged: ['auth'] });

    const human = runDiff(repo, ['--base', 'HEAD']);
    expect(human.stdout).toContain('Boundary export provenance changes:');
    expect(human.stdout).toContain('auth [public] User:');
    expect(human.stdout).toContain('- ./contract::User [value-capable syntax]');
    expect(human.stdout).toContain('+ ./server/user::User [value-capable syntax]');
  });


  it('reports symbol consumers and removed API impact across public and web boundaries', () => {
    const repo = initRepo();
    writeFeature(repo, 'auth', {
      'index.ts': 'export const oldApi = 1;\n',
      'web/index.ts': 'export const OldPage = true;\n',
    });
    writeFeature(repo, 'users', {
      'index.ts': "import { oldApi as legacyApi } from '@/features/auth';\n",
      'web/router.ts': "import { OldPage as Page } from '@/features/auth/web';\n",
    });
    commitAll(repo, 'base');
    writeFeature(repo, 'auth', {
      'index.ts': 'export const newApi = 1;\n',
      'web/index.ts': 'export const NewPage = true;\n',
    });

    const changed = runDiffJson(repo, ['--base', 'HEAD']);
    const changes = changed.json.changes as {
      publicExports: Array<{ feature: string; added: string[]; removed: string[] }>;
      webPublicExports: Array<{ feature: string; added: string[]; removed: string[] }>;
      consumerEvidence: { added: unknown[]; removed: unknown[] };
      removedPublicApiConsumers: Array<{
        symbol: string;
        boundary: string;
        exportKind: string;
        consumers: Array<{ targetState: string }>;
      }>;
    };
    expect(changes.publicExports).toEqual([
      { feature: 'auth', added: ['newApi'], removed: ['oldApi'] },
    ]);
    expect(changes.webPublicExports).toEqual([
      { feature: 'auth', added: ['NewPage'], removed: ['OldPage'] },
    ]);
    expect(changes.consumerEvidence).toEqual({ added: [], removed: [] });
    expect(changes.removedPublicApiConsumers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: 'oldApi',
          boundary: 'public',
          exportKind: 'public',
          consumers: expect.arrayContaining([
            expect.objectContaining({ targetState: 'still-imported' }),
          ]),
        }),
        expect.objectContaining({
          symbol: 'OldPage',
          boundary: 'web',
          exportKind: 'web',
          consumers: expect.arrayContaining([
            expect.objectContaining({ targetState: 'still-imported' }),
          ]),
        }),
      ]),
    );
    expect(changed.json.affected).toMatchObject({ directlyChanged: ['auth'] });

    const human = runDiff(repo, ['--base', 'HEAD']);
    expect(human.stdout).toContain('Web public exports:');
    expect(human.stdout).toContain('Removed public API consumer impact:');
    expect(human.stdout).toContain('oldApi');
    expect(human.stdout).toContain('still-imported');

    writeFeature(repo, 'users', {
      'index.ts': 'export const users = 1;\n',
      'web/router.ts': 'export const router = true;\n',
    });
    const removed = runDiffJson(repo, ['--base', 'HEAD']);
    const removedChanges = removed.json.changes as {
      consumerEvidence: { added: unknown[]; removed: unknown[] };
      removedPublicApiConsumers: Array<{ consumers: Array<{ targetState: string }> }>;
    };
    expect(removedChanges.consumerEvidence.added).toEqual([]);
    expect(removedChanges.consumerEvidence.removed).toHaveLength(2);
    expect(
      removedChanges.removedPublicApiConsumers.flatMap((impact) =>
        impact.consumers.map((consumer) => consumer.targetState),
      ),
    ).toEqual(['removed-in-change', 'removed-in-change']);
  });

  it('detects added and removed dependency edges', () => {
    const repo = initRepo();
    writeFeature(repo, 'users', { 'index.ts': 'export const users = 1;\n' });
    writeFeature(repo, 'billing', { 'index.ts': 'export const billing = 1;\n' });
    commitAll(repo, 'base');
    writeFeature(repo, 'billing', {
      'index.ts': "import '@/features/users';\nexport const billing = 1;\n",
    });

    const added = runDiffJson(repo, ['--base', 'HEAD']);
    const addedChanges = added.json.changes as {
      dependencies: { added: Array<{ from: string; to: string }>; removed: Array<unknown> };
    };
    expect(addedChanges.dependencies.added.map((edge) => `${edge.from}->${edge.to}`)).toEqual([
      'billing->users',
    ]);

    commitAll(repo, 'with-edge');
    writeFeature(repo, 'billing', { 'index.ts': 'export const billing = 1;\n' });
    const removed = runDiffJson(repo, ['--base', 'HEAD']);
    const removedChanges = removed.json.changes as {
      dependencies: { added: Array<unknown>; removed: Array<{ from: string; to: string }> };
    };
    expect(removedChanges.dependencies.removed.map((edge) => `${edge.from}->${edge.to}`)).toEqual([
      'billing->users',
    ]);
  });

  it('detects added and removed server, web, and test surfaces', () => {
    const repo = initRepo();
    writeFeature(repo, 'billing', {
      'index.ts': 'export const billing = 1;\n',
      'server/old.ts': 'export const old = 1;\n',
    });
    commitAll(repo, 'base');
    rmSync(path.join(repo, 'src/features/billing/server/old.ts'), { force: true });
    writeFeature(repo, 'billing', {
      'index.ts': 'export const billing = 1;\n',
      'server/routes.ts': 'export const routes = 1;\n',
      'web/page.ts': 'export const page = 1;\n',
      'tests/billing.test.ts': 'export const test = 1;\n',
    });

    const { json } = runDiffJson(repo, ['--base', 'HEAD']);
    const changes = json.changes as {
      surfaces: Array<{ feature: string; kind: string; added: string[]; removed: string[] }>;
    };
    expect(changes.surfaces).toContainEqual({
      feature: 'billing',
      kind: 'server',
      added: ['server/routes.ts'],
      removed: ['server/old.ts'],
    });
    expect(changes.surfaces).toContainEqual({
      feature: 'billing',
      kind: 'web',
      added: ['web/page.ts'],
      removed: [],
    });
    expect(changes.surfaces).toContainEqual({
      feature: 'billing',
      kind: 'test',
      added: ['tests/billing.test.ts'],
      removed: [],
    });
  });


  it('reports dirty and ref-to-ref application composition changes', () => {
    const repo = initRepo();
    writeFeature(repo, 'users', {
      'index.ts': 'export const userRoutes = true;\n',
      'web/index.ts': 'export const UsersPage = true;\n',
    });
    writeFeature(repo, 'billing', {
      'index.ts': "import '@/features/users';\nexport const billing = true;\n",
    });
    writeFile(
      repo,
      'src/app/server.ts',
      `import { Hono } from 'hono';
import { userRoutes } from '../features/users';
const app = new Hono();
app.route('/api/users', userRoutes);
`,
    );
    writeFile(
      repo,
      'src/app/router.ts',
      `import { createRouter } from 'vue-router';
import { UsersPage } from '../features/users/web';
createRouter({ routes: [{ path: '/users', component: UsersPage }] });
`,
    );
    const base = commitAll(repo, 'base composition');

    writeFile(
      repo,
      'src/app/server.ts',
      `import { Hono } from 'hono';
import { userRoutes } from '../features/users';
const app = new Hono();
app.route('/api/members', userRoutes);
`,
    );
    writeFile(
      repo,
      'src/app/router.ts',
      `import { createRouter } from 'vue-router';
import { UsersPage } from '../features/users/web';
createRouter({ routes: [{ path: '/people', component: UsersPage }] });
`,
    );

    const dirty = runDiffJson(repo, ['--base', base]);
    const dirtyChanges = dirty.json.changes as {
      integrations: {
        applicationImports: { added: unknown[]; removed: unknown[] };
        serverRoutes: { added: Array<{ mountPath: string }>; removed: Array<{ mountPath: string }> };
        webRoutes: { added: Array<{ path: string }>; removed: Array<{ path: string }> };
      };
    };
    expect(dirtyChanges.integrations.applicationImports).toEqual({ added: [], removed: [] });
    expect(dirtyChanges.integrations.serverRoutes).toEqual({
      added: [
        {
          feature: 'users',
          appFile: 'src/app/server.ts',
          exportName: 'userRoutes',
          mountPath: '/api/members',
        },
      ],
      removed: [
        {
          feature: 'users',
          appFile: 'src/app/server.ts',
          exportName: 'userRoutes',
          mountPath: '/api/users',
        },
      ],
    });
    expect(dirtyChanges.integrations.webRoutes).toEqual({
      added: [
        {
          feature: 'users',
          appFile: 'src/app/router.ts',
          exportName: 'UsersPage',
          path: '/people',
        },
      ],
      removed: [
        {
          feature: 'users',
          appFile: 'src/app/router.ts',
          exportName: 'UsersPage',
          path: '/users',
        },
      ],
    });
    expect(dirty.json.affected).toMatchObject({
      directlyChanged: ['users'],
      downstream: ['billing'],
    });
    const human = runDiff(repo, ['--base', base]);
    expect(human.stdout).toContain('Application integration changes:');
    expect(human.stdout).toContain('+ server route /api/members via userRoutes');
    expect(human.stdout).toContain('- web route /users via UsersPage');

    const target = commitAll(repo, 'changed composition');
    const refToRef = runDiffJson(repo, ['--base', base, '--head', target]);
    expect(refToRef.json.changes).toEqual(dirty.json.changes);
    expect(refToRef.json.affected).toEqual(dirty.json.affected);
  });
  it('reports a newly introduced doctor diagnostic', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'base');
    mkdirSync(path.join(repo, 'src/features/billing'), { recursive: true });

    const { json } = runDiffJson(repo, ['--base', 'HEAD']);
    const changes = json.changes as {
      diagnostics: { added: Array<{ code: string }>; resolved: Array<unknown> };
    };
    expect(changes.diagnostics.added.map((diagnostic) => diagnostic.code)).toContain(
      'INVALID_FEATURE_SHAPE',
    );
    expect(changes.diagnostics.resolved).toEqual([]);
  });

  it('reports a resolved doctor diagnostic', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    // A tracked file without index.ts is malformed yet committable (git
    // never tracks empty directories).
    writeFeature(repo, 'billing', { 'contract.ts': 'export type BillingInput = 1;\n' });
    commitAll(repo, 'base with violation');
    rmSync(path.join(repo, 'src/features/billing'), { recursive: true, force: true });
    const { json } = runDiffJson(repo, ['--base', 'HEAD']);
    const changes = json.changes as {
      diagnostics: { added: Array<unknown>; resolved: Array<{ code: string }> };
    };
    expect(changes.diagnostics.resolved.map((diagnostic) => diagnostic.code)).toContain(
      'INVALID_FEATURE_SHAPE',
    );
    expect(changes.diagnostics.added).toEqual([]);
  });

  it('computes direct and transitive structural impact', () => {
    const repo = initRepo();
    writeFeature(repo, 'users', { 'index.ts': 'export const users = 1;\n' });
    writeFeature(repo, 'billing', {
      'index.ts': "import '@/features/users';\nexport const billing = 1;\n",
    });
    writeFeature(repo, 'reports', {
      'index.ts': "import '@/features/billing';\nexport const reports = 1;\n",
    });
    commitAll(repo, 'base');
    writeFeature(repo, 'users', { 'index.ts': 'export const users = 1;\nexport const extra = 2;\n' });

    const { json } = runDiffJson(repo, ['--base', 'HEAD']);
    const affected = json.affected as { directlyChanged: string[]; downstream: string[]; all: string[] };
    expect(affected.directlyChanged).toEqual(['users']);
    expect(affected.downstream).toEqual(['billing', 'reports']);
    expect(affected.all).toEqual(['billing', 'reports', 'users']);
  });

  it('compares two refs with --head without touching the working tree', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    const first = commitAll(repo, 'first');
    writeFeature(repo, 'billing', { 'index.ts': 'export const billing = 1;\n' });
    const second = commitAll(repo, 'second');

    const before = readFileSync(path.join(repo, 'src/features/billing/index.ts'), 'utf8');
    const outcome = runDiff(repo, ['--base', first, '--head', second]);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('+ billing');
    // Working tree untouched by the ref-to-ref comparison.
    expect(readFileSync(path.join(repo, 'src/features/billing/index.ts'), 'utf8')).toBe(before);
    expect(git(repo, 'status', '--porcelain')).toBe('');

    const headJson = runDiffJson(repo, ['--base', first, '--head', second]);
    const changes = headJson.json.changes as { features: { added: string[]; removed: string[] } };
    expect(changes.features).toEqual({ added: ['billing'], removed: [] });
    expect(headJson.json.target).toMatchObject({ kind: 'git-ref', ref: second });
  });

  it('fails clearly for an unknown base ref', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'base');

    const outcome = runDiff(repo, ['--base', 'does-not-exist-12345']);
    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr).toContain('Unknown Git ref');
  });

  it('fails clearly outside a Git repository', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'nara-diff-nogit-'));
    fixtures.push(directory);
    writeFeature(directory, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });

    const outcome = runDiff(directory, ['--base', 'main']);
    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.stderr).toContain('Not inside a Git repository');
  });

  it('rejects invalid CLI usage with the usage convention', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'base');

    for (const args of [[], ['--head', 'HEAD'], ['--base'], ['--base', 'HEAD', '--bogus']]) {
      const outcome = runDiff(repo, args);
      expect(outcome.exitCode).toBe(64);
      expect(outcome.stderr).toContain('nara diff --base');
    }
  });

  it('emits stable deterministic JSON ordering', () => {
    const repo = initRepo();
    writeFeature(repo, 'users', { 'index.ts': 'export const users = 1;\n' });
    writeFeature(repo, 'billing', {
      'index.ts': "import '@/features/users';\nexport const b = 1;\nexport const a = 1;\n",
      'contract.ts': 'export type Z = 1;\nexport type A = 1;\n',
    });
    commitAll(repo, 'base');
    writeFeature(repo, 'billing', {
      'index.ts': "import '@/features/users';\nexport const c = 1;\nexport const a = 1;\n",
      'contract.ts': 'export type M = 1;\nexport type A = 1;\n',
    });

    const first = runDiff(repo, ['--base', 'HEAD', '--json']);
    const second = runDiff(repo, ['--base', 'HEAD', '--json']);
    expect(first.exitCode).toBe(0);
    expect(second.stdout).toBe(first.stdout);
    const json = JSON.parse(first.stdout) as {
      changes: {
        publicExports: Array<{ added: string[]; removed: string[] }>;
        contracts: Array<{ added: string[]; removed: string[] }>;
      };
    };
    for (const delta of [...json.changes.publicExports, ...json.changes.contracts]) {
      expect([...delta.added].sort()).toEqual(delta.added);
      expect([...delta.removed].sort()).toEqual(delta.removed);
    }
  });

  it('renders concise hierarchical human output', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'base');
    writeFeature(repo, 'billing', { 'index.ts': 'export const billing = 1;\n' });

    const outcome = runDiff(repo, ['--base', 'HEAD']);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('Architecture changes (base HEAD -> working tree):');
    expect(outcome.stdout).toContain('Features:');
    expect(outcome.stdout).toContain('+ billing');
    expect(outcome.stdout).toContain('Structural dependency impact:');
    // Architecture changes are never an error condition.
    expect(outcome.exitCode).toBe(0);
  });
});
