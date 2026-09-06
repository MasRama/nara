import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { digestFeatureFiles, featureFilesEqual, readFeatureFiles, readFeatureLineage } from '../../src/cli/evolution/lineage';
import { describe, expect, it } from 'vitest';
import {
  ensurePackedNara,
  npmCommand,
  pointNaraAtTarball,
  publishablePackageDir,
  repoRoot,
  runCommand,
  runLocalNara,
} from './pack-helpers';
interface EvolutionSummary {
  status: string;
  applied: boolean;
}

function parseEvolutionSummary(output: string): EvolutionSummary {
  const value: unknown = JSON.parse(output);
  if (
    typeof value !== 'object' ||
    value === null ||
    !('status' in value) ||
    typeof value.status !== 'string' ||
    !('applied' in value) ||
    typeof value.applied !== 'boolean'
  ) {
    throw new Error('Packaged evolve output did not contain a valid status summary.');
  }
  return { status: value.status, applied: value.applied };
}

function findFreePort(): Promise<number> {
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      reject(new Error('Could not determine a free TCP port'));
      return;
    }
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(address.port);
    });
  });
  return promise;
}

function startProductionServer(projectDirectory: string, port: number): ChildProcess {
  return spawn(npmCommand, ['start'], {
    cwd: projectDirectory,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), APP_URL: `http://127.0.0.1:${port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
}

async function waitForHealth(child: ChildProcess, port: number): Promise<void> {
  const deadline = Date.now() + 60_000;
  for (; ;) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.status === 200) {
        await expect(response.json()).resolves.toEqual({ status: 'ok' });
        return;
      }
    } catch {
      // Server is still starting.
    }
    if (Date.now() > deadline) throw new Error('Production server did not become healthy in time');
    if (child.exitCode !== null) throw new Error(`Production server exited early with code ${child.exitCode}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  if (child.pid !== undefined && process.platform !== 'win32') {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  } else {
    child.kill('SIGTERM');
  }
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 10_000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

describe('packaged Nara lifecycle', () => {
  it('pack -> install -> new -> check -> add -> doctor -> build -> start', { timeout: 600_000 }, async () => {
    const tarball = await ensurePackedNara();
    const root = mkdtempSync(path.join(os.tmpdir(), 'nara-pack-lifecycle-'));
    try {
      // Install the packed artifact exactly as a user would (no repo checkout).
      const prefix = path.join(root, 'prefix');
      await runCommand(npmCommand, ['install', '--prefix', prefix, tarball], root);
      const installedRoot = path.join(prefix, 'node_modules', '@nara-web', 'cli');
      expect(existsSync(path.join(installedRoot, 'dist', 'index.js'))).toBe(true);
      expect(existsSync(path.join(installedRoot, 'official-features', 'health', 'index.ts'))).toBe(true);
      expect(existsSync(path.join(installedRoot, 'official-features', 'audit', 'index.ts'))).toBe(true);
      const installedCli =
        process.platform === 'win32'
          ? ['node', path.join(installedRoot, 'dist', 'index.js')]
          : [path.join(prefix, 'node_modules', '.bin', 'nara')];

      // Installed-package `nara new` works outside the repository.
      const workspace = path.join(root, 'workspace');
      mkdirSync(workspace, { recursive: true });
      await runCommand(installedCli[0], [...installedCli.slice(1), 'new', 'fresh-app'], workspace);

      const projectDirectory = path.join(workspace, 'fresh-app');
      const generated = JSON.parse(readFileSync(path.join(projectDirectory, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
        devDependencies: Record<string, string>;
      };
      // Generated project pins the creating CLI version exactly (no range).
      const packageManifest = JSON.parse(
        readFileSync(path.join(publishablePackageDir(), 'package.json'), 'utf8'),
      ) as {
        version: string;
      };
      expect(generated.devDependencies['@nara-web/cli']).toBe(packageManifest.version);
      expect(generated.devDependencies.nara).toBeUndefined();
      expect(generated.scripts['architecture:doctor']).toBe('nara doctor');
      expect(generated.scripts.check).toContain('architecture:doctor');
      expect(existsSync(path.join(projectDirectory, 'src', 'app', 'bindings', 'health.server.ts'))).toBe(true);
      expect(readFileSync(path.join(projectDirectory, 'src', 'app', 'server.ts'), 'utf8')).toContain(
        'composeHealthServer(app);',
      );

      // Pre-publish stand-in for the registry: same tarball bytes via file:.
      pointNaraAtTarball(projectDirectory, tarball);
      await runCommand(npmCommand, ['install', '--no-audit', '--no-fund'], projectDirectory);

      // Local tooling works from inside the generated project.
      const doctor = await runLocalNara(projectDirectory, ['doctor']);
      expect(doctor.stdout).toBe('Architecture looks healthy.\n');
      const inspect = await runLocalNara(projectDirectory, ['inspect', 'health', '--json']);
      expect(JSON.parse(inspect.stdout).name).toBe('health');
      expect(
        (JSON.parse(inspect.stdout) as { integrations: { serverRoutes: { mountPath: string }[] } }).integrations
          .serverRoutes,
      ).toEqual([
        { feature: 'health', appFile: 'src/app/server.ts', exportName: 'healthRoutes', mountPath: '/health' },
      ]);
      const context = await runLocalNara(projectDirectory, ['context', 'health', '--json']);
      expect(JSON.parse(context.stdout).target).toMatchObject({ feature: 'health', selectedBy: 'feature' });
      const impact = await runLocalNara(projectDirectory, ['impact', 'health', '--json']);
      expect(JSON.parse(impact.stdout).name).toBe('health');

      // Local `nara add` resolves official Features from the installed package.
      const add = await runLocalNara(projectDirectory, ['add', 'audit']);
      expect(add.stdout).toContain('src/features/audit/index.ts');
      expect(existsSync(path.join(projectDirectory, 'src', 'features', 'audit', 'contract.ts'))).toBe(true);
      const doctorAfterAdd = await runLocalNara(projectDirectory, ['doctor']);
      expect(doctorAfterAdd.stdout).toBe('Architecture looks healthy.\n');
      // A packaged official source update evolves an installed Feature without losing local code.
      const auditDirectory = path.join(projectDirectory, 'src', 'features', 'audit');
      const localCustomization = path.join(auditDirectory, 'local.ts');
      writeFileSync(localCustomization, 'export const localCustomization = true;\n');
      const lineageDirectory = path.join(
        projectDirectory,
        '.nara',
        'lineage',
        'official-features',
        'audit',
      );
      const beforeLineage = readFileSync(path.join(lineageDirectory, 'lineage.json'));
      const packagedOfficialAudit = path.join(projectDirectory, 'node_modules', '@nara-web', 'cli', 'official-features', 'audit', 'index.ts');
      const packagedBase = readFileSync(packagedOfficialAudit, 'utf8');
      writeFileSync(packagedOfficialAudit, `${packagedBase}\nexport const auditVersion = 'packaged-next';\n`);
      const beforeFeature = readFileSync(path.join(auditDirectory, 'index.ts'));

      const dryRun = await runLocalNara(projectDirectory, ['evolve', 'audit', '--dry-run', '--json']);
      const dryRunPlan = parseEvolutionSummary(dryRun.stdout);
      expect(dryRunPlan.status).toBe('dry-run');
      expect(dryRunPlan.applied).toBe(false);
      expect(readFileSync(path.join(auditDirectory, 'index.ts'))).toEqual(beforeFeature);
      expect(readFileSync(path.join(lineageDirectory, 'lineage.json'))).toEqual(beforeLineage);

      const evolved = await runLocalNara(projectDirectory, ['evolve', 'audit', '--json']);
      const evolutionPlan = parseEvolutionSummary(evolved.stdout);
      expect(evolutionPlan.status).toBe('applied');
      expect(evolutionPlan.applied).toBe(true);
      expect(readFileSync(path.join(auditDirectory, 'index.ts'), 'utf8')).toContain(
        "auditVersion = 'packaged-next'",
      );
      expect(readFileSync(localCustomization, 'utf8')).toContain('localCustomization');
      expect(readFileSync(path.join(lineageDirectory, 'base', 'index.ts'), 'utf8')).toBe(
        readFileSync(packagedOfficialAudit, 'utf8'),
      );
      expect(existsSync(path.join(lineageDirectory, 'base', 'local.ts'))).toBe(false);
      expect(readFileSync(path.join(lineageDirectory, 'lineage.json'))).not.toEqual(beforeLineage);
      const unchanged = await runLocalNara(projectDirectory, ['evolve', 'audit', '--json']);
      expect(parseEvolutionSummary(unchanged.stdout).status).toBe('up-to-date');

      const doctorAfterEvolution = await runLocalNara(projectDirectory, ['doctor']);
      expect(doctorAfterEvolution.stdout).toBe('Architecture looks healthy.\n');

      // The generated project's own check defends the architecture rules.
      await runCommand(npmCommand, ['run', 'check'], projectDirectory);
      await runCommand(npmCommand, ['run', 'build'], projectDirectory);

      const port = await findFreePort();
      const server = startProductionServer(projectDirectory, port);
      try {
        await waitForHealth(server, port);
        const shell = await fetch(`http://127.0.0.1:${port}/`);
        expect(shell.status).toBe(200);
        expect(await shell.text()).toContain('<div id="app"></div>');
      } finally {
        await stopServer(server);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('installed nara new evolves the generated Health Feature from lineage', { timeout: 300_000 }, async () => {
    const tarball = await ensurePackedNara();
    const root = mkdtempSync(path.join(os.tmpdir(), 'nara-pack-new-health-'));
    try {
      const prefix = path.join(root, 'prefix');
      await runCommand(npmCommand, ['install', '--prefix', prefix, tarball], root);
      const installedRoot = path.join(prefix, 'node_modules', '@nara-web', 'cli');
      const installedCli =
        process.platform === 'win32'
          ? ['node', path.join(installedRoot, 'dist', 'index.js')]
          : [path.join(prefix, 'node_modules', '.bin', 'nara')];

      const workspace = path.join(root, 'workspace');
      mkdirSync(workspace, { recursive: true });
      await runCommand(installedCli[0], [...installedCli.slice(1), 'new', 'app'], workspace);

      const projectDirectory = path.join(workspace, 'app');
      const packagedHealthDirectory = path.join(installedRoot, 'official-features', 'health');
      const generatedHealthDirectory = path.join(projectDirectory, 'src', 'features', 'health');
      const officialHealth = readFeatureFiles(packagedHealthDirectory, false);
      expect(featureFilesEqual(readFeatureFiles(generatedHealthDirectory), officialHealth)).toBe(true);

      const initialLineage = readFeatureLineage(projectDirectory, 'health');
      expect(initialLineage).toBeDefined();
      if (!initialLineage) return;
      expect(featureFilesEqual(initialLineage.files, officialHealth)).toBe(true);
      expect(initialLineage.record.baseDigest).toBe(digestFeatureFiles(officialHealth));

      pointNaraAtTarball(projectDirectory, tarball);
      await runCommand(npmCommand, ['install', '--no-audit', '--no-fund'], projectDirectory);
      const localPackagedHealthDirectory = path.join(
        projectDirectory,
        'node_modules',
        '@nara-web',
        'cli',
        'official-features',
        'health',
      );

      const fresh = await runLocalNara(projectDirectory, ['evolve', 'health', '--json']);
      expect(parseEvolutionSummary(fresh.stdout)).toEqual({ status: 'up-to-date', applied: false });

      const localCustomization = path.join(generatedHealthDirectory, 'local.ts');
      writeFileSync(localCustomization, 'export const localCustomization = true;\n');
      const incomingIndex = path.join(localPackagedHealthDirectory, 'index.ts');
      writeFileSync(
        incomingIndex,
        `${readFileSync(incomingIndex, 'utf8')}\nexport const healthVersion = 'packaged-next';\n`,
      );
      const incomingHealth = readFeatureFiles(localPackagedHealthDirectory, false);

      const evolved = await runLocalNara(projectDirectory, ['evolve', 'health', '--json']);
      expect(parseEvolutionSummary(evolved.stdout)).toEqual({ status: 'applied', applied: true });
      expect(readFileSync(path.join(generatedHealthDirectory, 'index.ts'), 'utf8')).toContain(
        "healthVersion = 'packaged-next'",
      );
      expect(readFileSync(localCustomization, 'utf8')).toContain('localCustomization');

      const evolvedLineage = readFeatureLineage(projectDirectory, 'health');
      expect(evolvedLineage).toBeDefined();
      if (!evolvedLineage) return;
      expect(featureFilesEqual(evolvedLineage.files, incomingHealth)).toBe(true);
      expect(evolvedLineage.record.baseDigest).toBe(digestFeatureFiles(incomingHealth));
      expect(evolvedLineage.files.has('local.ts')).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('installed nara add composes server and web assemblies from distribution templates', { timeout: 300_000 }, async () => {
    const tarball = await ensurePackedNara();
    const root = mkdtempSync(path.join(os.tmpdir(), 'nara-pack-assembly-'));
    try {
      const prefix = path.join(root, 'prefix');
      await runCommand(npmCommand, ['install', '--prefix', prefix, tarball], root);
      const installedRoot = path.join(prefix, 'node_modules', '@nara-web', 'cli');
      const installedCli =
        process.platform === 'win32'
          ? ['node', path.join(installedRoot, 'dist', 'index.js')]
          : [path.join(prefix, 'node_modules', '.bin', 'nara')];

      // Isolated fixture Feature: proves both composition surfaces without
      // adding a fake Feature to the production catalog.
      const galleryDirectory = path.join(installedRoot, 'official-features', 'gallery');
      mkdirSync(path.join(galleryDirectory, 'web'), { recursive: true });
      mkdirSync(path.join(galleryDirectory, '.nara', 'assembly'), { recursive: true });
      writeFileSync(
        path.join(galleryDirectory, 'index.ts'),
        `import { Hono } from 'hono';\n\nexport const galleryRoutes = new Hono().get('/', (context) => context.text('gallery'));\n`,
      );
      writeFileSync(
        path.join(galleryDirectory, 'web', 'index.ts'),
        `export const GalleryPage = { template: '<div>gallery</div>' };\n`,
      );
      writeFileSync(
        path.join(galleryDirectory, '.nara', 'assembly', 'server.ts'),
        `import type { Hono } from 'hono';\nimport { galleryRoutes } from '../../features/gallery';\n\nexport default function composeGalleryServer(app: Hono): void {\n  app.route('/gallery', galleryRoutes);\n}\n`,
      );
      writeFileSync(
        path.join(galleryDirectory, '.nara', 'assembly', 'web.ts'),
        `import type { RouteRecordRaw } from 'vue-router';\nimport { GalleryPage } from '../../features/gallery/web';\n\nexport default [\n  {\n    path: '/gallery',\n    name: 'gallery',\n    component: GalleryPage,\n  },\n] satisfies RouteRecordRaw[];\n`,
      );

      const fixture = path.join(root, 'fixture');
      mkdirSync(path.join(fixture, 'src', 'app'), { recursive: true });
      writeFileSync(
        path.join(fixture, 'src', 'app', 'server.ts'),
        `import { Hono } from 'hono';\n\nexport const app = new Hono();\n`,
      );
      writeFileSync(
        path.join(fixture, 'src', 'app', 'router.ts'),
        `import { createRouter, createWebHistory } from 'vue-router';\nimport HomePage from './pages/HomePage.vue';\n\nexport default createRouter({\n  history: createWebHistory(),\n  routes: [\n    {\n      path: '/',\n      name: 'home',\n      component: HomePage,\n    },\n    {\n      path: '/:pathMatch(.*)*',\n      name: 'not-found',\n      component: HomePage,\n    },\n  ],\n});\n`,
      );

      const add = await runCommand(installedCli[0], [...installedCli.slice(1), 'add', 'gallery'], fixture);
      expect(add.stdout).toContain('src/features/gallery/index.ts');
      expect(add.stdout).toContain('src/app/bindings/gallery.server.ts');
      expect(add.stdout).toContain('src/app/bindings/gallery.web.ts');
      expect(existsSync(path.join(fixture, 'src', 'features', 'gallery', 'index.ts'))).toBe(true);
      expect(existsSync(path.join(fixture, 'src', 'app', 'bindings', 'gallery.server.ts'))).toBe(true);
      expect(existsSync(path.join(fixture, 'src', 'app', 'bindings', 'gallery.web.ts'))).toBe(true);
      expect(readFileSync(path.join(fixture, 'src', 'app', 'server.ts'), 'utf8')).toContain(
        'composeGalleryServer(app);',
      );
      expect(readFileSync(path.join(fixture, 'src', 'app', 'router.ts'), 'utf8')).toContain('...galleryWebRoutes,');

      const doctor = await runCommand(installedCli[0], [...installedCli.slice(1), 'doctor'], fixture);
      expect(doctor.stdout).toBe('Architecture looks healthy.\n');
      const inspect = await runCommand(installedCli[0], [...installedCli.slice(1), 'inspect', 'gallery', '--json'], fixture);
      const feature = JSON.parse(inspect.stdout) as {
        integrations: {
          applicationImports: { appFile: string }[];
          serverRoutes: { mountPath: string }[];
          webRoutes: { path: string }[];
        };
      };
      expect(feature.integrations.serverRoutes.map((route) => route.mountPath)).toEqual(['/gallery']);
      expect(feature.integrations.webRoutes.map((route) => route.path)).toEqual(['/gallery']);
      expect(feature.integrations.applicationImports.map((fact) => fact.appFile).sort()).toEqual([
        'src/app/bindings/gallery.server.ts',
        'src/app/bindings/gallery.web.ts',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('installed nara diff explains architecture changes from working tree and refs', { timeout: 300_000 }, async () => {
    const tarball = await ensurePackedNara();
    const root = mkdtempSync(path.join(os.tmpdir(), 'nara-pack-diff-'));
    try {
      const prefix = path.join(root, 'prefix');
      await runCommand(npmCommand, ['install', '--prefix', prefix, tarball], root);
      const installedRoot = path.join(prefix, 'node_modules', '@nara-web', 'cli');
      expect(existsSync(path.join(installedRoot, 'dist', 'commands', 'diff.js'))).toBe(true);
      expect(existsSync(path.join(installedRoot, 'dist', 'architecture', 'diff.js'))).toBe(true);
      expect(existsSync(path.join(installedRoot, 'dist', 'architecture', 'snapshot.js'))).toBe(true);
      const installedCli =
        process.platform === 'win32'
          ? ['node', path.join(installedRoot, 'dist', 'index.js')]
          : [path.join(prefix, 'node_modules', '.bin', 'nara')];

      const fixture = path.join(root, 'fixture');
      mkdirSync(path.join(fixture, 'src/features/health'), { recursive: true });
      writeFileSync(path.join(fixture, 'src/features/health/index.ts'), 'export const healthRoutes = 1;\n');
      mkdirSync(path.join(fixture, 'src/features/users'), { recursive: true });
      writeFileSync(path.join(fixture, 'src/features/users/index.ts'), 'export const userRoutes = 1;\n');
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
createRouter({ routes: [{ path: '/users', component: UsersPage }] });
`,
      );
      await runCommand('git', ['init'], fixture);
      await runCommand('git', ['config', 'user.email', 'nara-diff@example.com'], fixture);
      await runCommand('git', ['config', 'user.name', 'nara diff'], fixture);
      await runCommand('git', ['add', '-A'], fixture);
      await runCommand('git', ['commit', '-m', 'base'], fixture);
      mkdirSync(path.join(fixture, 'src/features/billing'), { recursive: true });
      writeFileSync(path.join(fixture, 'src/features/billing/index.ts'), 'export const billing = 1;\n');
      writeFileSync(
        path.join(fixture, 'src/app/server.ts'),
        `import { Hono } from 'hono';
import { userRoutes } from '../features/users';
const app = new Hono();
app.route('/api/members', userRoutes);
`,
      );
      writeFileSync(
        path.join(fixture, 'src/app/router.ts'),
        `import { createRouter } from 'vue-router';
import { UsersPage } from '../features/users/web';
createRouter({ routes: [{ path: '/people', component: UsersPage }] });
`,
      );

      const human = await runCommand(installedCli[0], [...installedCli.slice(1), 'diff', '--base', 'HEAD'], fixture);
      expect(human.stdout).toContain('+ billing');
      expect(human.stdout).toContain('Structural dependency impact:');
      expect(human.stdout).toContain('+ server route /api/members via userRoutes');
      expect(human.stdout).toContain('- web route /users via UsersPage');
      const machine = await runCommand(
        installedCli[0],
        [...installedCli.slice(1), 'diff', '--base', 'HEAD', '--json'],
        fixture,
      );
      const payload = JSON.parse(machine.stdout) as {
        schemaVersion: number;
        changes: {
          features: { added: string[]; removed: string[] };
          integrations: {
            applicationImports: { added: unknown[]; removed: unknown[] };
            serverRoutes: {
              added: Array<{ mountPath: string }>;
              removed: Array<{ mountPath: string }>;
            };
            webRoutes: { added: Array<{ path: string }>; removed: Array<{ path: string }> };
          };
        };
        affected: { scope: string; directlyChanged: string[] };
      };
      expect(payload.schemaVersion).toBe(1);
      expect(payload.changes.features).toEqual({ added: ['billing'], removed: [] });
      expect(payload.changes.integrations.applicationImports).toEqual({ added: [], removed: [] });
      expect(payload.changes.integrations.serverRoutes.added.map((route) => route.mountPath)).toEqual([
        '/api/members',
      ]);
      expect(payload.changes.integrations.serverRoutes.removed.map((route) => route.mountPath)).toEqual([
        '/api/users',
      ]);
      expect(payload.changes.integrations.webRoutes.added.map((route) => route.path)).toEqual(['/people']);
      expect(payload.changes.integrations.webRoutes.removed.map((route) => route.path)).toEqual(['/users']);
      expect(payload.affected.scope).toBe('structural dependency impact');
      expect(payload.affected.directlyChanged).toEqual(['billing', 'users']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('installed nara guard passes clean trees and fails new violations', { timeout: 300_000 }, async () => {
    const tarball = await ensurePackedNara();
    const root = mkdtempSync(path.join(os.tmpdir(), 'nara-pack-guard-'));
    try {
      const prefix = path.join(root, 'prefix');
      await runCommand(npmCommand, ['install', '--prefix', prefix, tarball], root);
      const installedRoot = path.join(prefix, 'node_modules', '@nara-web', 'cli');
      expect(existsSync(path.join(installedRoot, 'dist', 'commands', 'guard.js'))).toBe(true);
      const installedCli =
        process.platform === 'win32'
          ? ['node', path.join(installedRoot, 'dist', 'index.js')]
          : [path.join(prefix, 'node_modules', '.bin', 'nara')];

      const fixture = path.join(root, 'fixture');
      mkdirSync(path.join(fixture, 'src/features/health'), { recursive: true });
      writeFileSync(path.join(fixture, 'src/features/health/index.ts'), 'export const healthRoutes = 1;\n');
      await runCommand('git', ['init'], fixture);
      await runCommand('git', ['config', 'user.email', 'nara-guard@example.com'], fixture);
      await runCommand('git', ['config', 'user.name', 'nara guard'], fixture);
      await runCommand('git', ['add', '-A'], fixture);
      await runCommand('git', ['commit', '-m', 'clean base'], fixture);
      const baseCommit = (await runCommand('git', ['rev-parse', 'HEAD'], fixture)).stdout.trim();

      const clean = await runCommand(installedCli[0], [...installedCli.slice(1), 'guard', '--base', 'HEAD'], fixture);
      expect(clean.stdout).toContain('Architecture guard passed.');

      mkdirSync(path.join(fixture, 'src/features/users/server'), { recursive: true });
      mkdirSync(path.join(fixture, 'src/features/billing/server'), { recursive: true });
      writeFileSync(path.join(fixture, 'src/features/users/index.ts'), 'export const users = 1;\n');
      writeFileSync(
        path.join(fixture, 'src/features/users/server/repository.ts'),
        'export const findUserById = 1;\n',
      );
      writeFileSync(path.join(fixture, 'src/features/billing/index.ts'), 'export const billing = 1;\n');
      writeFileSync(
        path.join(fixture, 'src/features/billing/server/checkout.ts'),
        "import { findUserById } from '@/features/users/server/repository';\nexport const checkout = 1;\n",
      );

      await expect(
        runCommand(installedCli[0], [...installedCli.slice(1), 'guard', '--base', 'HEAD'], fixture),
      ).rejects.toThrow('Architecture guard failed.');

      await runCommand('git', ['add', '-A'], fixture);
      await runCommand('git', ['commit', '-m', 'head with violation'], fixture);
      const headCommit = (await runCommand('git', ['rev-parse', 'HEAD'], fixture)).stdout.trim();
      await expect(
        runCommand(installedCli[0], [...installedCli.slice(1), 'guard', '--base', baseCommit, '--head', headCommit], fixture),
      ).rejects.toThrow('CROSS_FEATURE_INTERNAL_IMPORT');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('installed nara add composes the users assembly from an auth-backed binding', { timeout: 600_000 }, async () => {
    const tarball = await ensurePackedNara();
    const root = mkdtempSync(path.join(os.tmpdir(), 'nara-pack-users-'));
    try {
      const prefix = path.join(root, 'prefix');
      await runCommand(npmCommand, ['install', '--prefix', prefix, tarball], root);
      const installedRoot = path.join(prefix, 'node_modules', '@nara-web', 'cli');
      expect(existsSync(path.join(installedRoot, 'official-features', 'users', 'index.ts'))).toBe(true);
      expect(existsSync(path.join(installedRoot, 'official-features', 'users', '.nara', 'assembly', 'server.ts'))).toBe(
        true,
      );
      const installedCli =
        process.platform === 'win32'
          ? ['node', path.join(installedRoot, 'dist', 'index.js')]
          : [path.join(prefix, 'node_modules', '.bin', 'nara')];

      const workspace = path.join(root, 'workspace');
      mkdirSync(workspace, { recursive: true });
      await runCommand(installedCli[0], [...installedCli.slice(1), 'new', 'users-app'], workspace);
      const projectDirectory = path.join(workspace, 'users-app');

      // Supported fixture strategy: the Auth prerequisite is ordinary project
      // source, not an installable official Feature. Business-neutral shared
      // infrastructure travels with it; test-only files stay behind.
      const repository = repoRoot();
      const withoutTests = (source: string): boolean => !source.split(path.sep).includes('tests');
      cpSync(path.join(repository, 'src', 'features', 'auth'), path.join(projectDirectory, 'src', 'features', 'auth'), {
        recursive: true,
        filter: withoutTests,
      });
      for (const module of ['config', 'database', 'errors', 'logging', 'security']) {
        cpSync(path.join(repository, 'src', 'shared', module), path.join(projectDirectory, 'src', 'shared', module), {
          recursive: true,
          filter: withoutTests,
        });
      }
      const rootManifest = JSON.parse(readFileSync(path.join(repository, 'package.json'), 'utf8')) as {
        dependencies: Record<string, string>;
      };
      const projectManifestPath = path.join(projectDirectory, 'package.json');
      const projectManifest = JSON.parse(readFileSync(projectManifestPath, 'utf8')) as {
        dependencies: Record<string, string>;
      };
      for (const name of ['better-sqlite3', 'dotenv', 'pino', 'pino-pretty', 'pino-roll', 'sharp', 'zod']) {
        projectManifest.dependencies[name] = rootManifest.dependencies[name];
      }
      writeFileSync(projectManifestPath, `${JSON.stringify(projectManifest, null, 2)}\n`);

      pointNaraAtTarball(projectDirectory, tarball);
      await runCommand(npmCommand, ['install', '--no-audit', '--no-fund'], projectDirectory);

      const add = await runLocalNara(projectDirectory, ['add', 'users']);
      expect(add.stdout).toContain('src/app/bindings/users.server.ts');
      expect(add.stdout).toContain('src/app/bindings/users.web.ts');
      expect(add.stdout).toContain('src/features/users/server/host.ts');
      expect(existsSync(path.join(projectDirectory, 'src', 'features', 'users', 'web', 'host.ts'))).toBe(true);

      const doctor = await runLocalNara(projectDirectory, ['doctor']);
      expect(doctor.stdout).toBe('Architecture looks healthy.\n');
      const inspection = JSON.parse(
        (await runLocalNara(projectDirectory, ['inspect', 'users', '--json'])).stdout,
      ) as {
        dependencies: string[];
        integrations: {
          serverRoutes: Array<{ mountPath: string; exportName: string }>;
          webRoutes: Array<{ path: string; exportName: string }>;
        };
      };
      expect(inspection.dependencies).toEqual([]);
      expect(inspection.integrations.serverRoutes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ mountPath: '/api/users', exportName: 'createUserRoutes' }),
          expect.objectContaining({ mountPath: '/api/assets', exportName: 'createAssetRoutes' }),
        ]),
      );
      expect(inspection.integrations.webRoutes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: '/users', exportName: 'UsersPage' }),
          expect.objectContaining({ path: '/profile', exportName: 'ProfilePage' }),
        ]),
      );
      const context = JSON.parse(
        (await runLocalNara(projectDirectory, ['context', 'users', '--json'])).stdout,
      ) as { readingOrder: Array<{ path: string }> };
      expect(context.readingOrder.map((entry) => entry.path)).toEqual(
        expect.arrayContaining(['src/app/bindings/users.server.ts', 'src/app/bindings/users.web.ts']),
      );

      await runCommand(npmCommand, ['run', 'check'], projectDirectory);
      await runCommand(npmCommand, ['run', 'build'], projectDirectory);

      const binding = path.join(projectDirectory, 'src', 'app', 'bindings', 'users.server.ts');
      writeFileSync(binding, `${readFileSync(binding, 'utf8')}// Local policy: deny role assignment on Fridays.\n`);
      const customized = readFileSync(binding, 'utf8');
      const packagedUsersIndex = path.join(
        projectDirectory,
        'node_modules',
        '@nara-web',
        'cli',
        'official-features',
        'users',
        'index.ts',
      );
      writeFileSync(packagedUsersIndex, `${readFileSync(packagedUsersIndex, 'utf8')}\nexport const usersVersion = 'packaged-next';\n`);
      const evolved = await runLocalNara(projectDirectory, ['evolve', 'users', '--json']);
      expect(parseEvolutionSummary(evolved.stdout)).toEqual({ status: 'applied', applied: true });
      expect(readFileSync(path.join(projectDirectory, 'src', 'features', 'users', 'index.ts'), 'utf8')).toContain(
        "usersVersion = 'packaged-next'",
      );
      expect(readFileSync(binding, 'utf8')).toEqual(customized);

      const doctorAfterEvolution = await runLocalNara(projectDirectory, ['doctor']);
      expect(doctorAfterEvolution.stdout).toBe('Architecture looks healthy.\n');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
