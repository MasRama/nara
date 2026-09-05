import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ensurePackedNara,
  npmCommand,
  pointNaraAtTarball,
  publishablePackageDir,
  runCommand,
  runLocalNara,
} from './pack-helpers';

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

      // Pre-publish stand-in for the registry: same tarball bytes via file:.
      pointNaraAtTarball(projectDirectory, tarball);
      await runCommand(npmCommand, ['install', '--no-audit', '--no-fund'], projectDirectory);

      // Local tooling works from inside the generated project.
      const doctor = await runLocalNara(projectDirectory, ['doctor']);
      expect(doctor.stdout).toBe('Architecture looks healthy.\n');
      const inspect = await runLocalNara(projectDirectory, ['inspect', 'health', '--json']);
      expect(JSON.parse(inspect.stdout).name).toBe('health');
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
});
