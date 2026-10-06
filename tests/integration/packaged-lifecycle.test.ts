import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensurePackedNara, npmCommand, runCommand } from './pack-helpers';

describe('packaged Nara lifecycle', () => {
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


});
