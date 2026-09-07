import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeArchitecture } from '../architecture/doctor';
import { inspectFeature } from '../architecture/inspect';
import { evolveFeature } from '../commands/evolve';
import { runCli } from '../router';
import { installOfficialFeature } from './install-feature';
import {
  collectBareImports,
  readFeatureRequirements,
  validateRequirementsAgainstSource,
} from './requirements';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-requirements-'));
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
    { path: '/', name: 'home', component: HomePage },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: HomePage },
  ],
});
`;
const FIXTURE_PACKAGE_JSON = `{
  "name": "fixture",
  "version": "0.0.0",
  "dependencies": {}
}
`;

function officialFixture(files: Record<string, string>): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nara-official-'));
  fixtures.push(directory);
  writeFiles(directory, files);
  return directory;
}

function projectShell(fixture: string, files: Record<string, string> = {}): void {
  writeFiles(fixture, {
    'src/app/server.ts': MINIMAL_SERVER_ROOT,
    'src/app/router.ts': MINIMAL_ROUTER_ROOT,
    'package.json': FIXTURE_PACKAGE_JSON,
    ...files,
  });
}

const GALLERY_INDEX = `import { Hono } from 'hono';

export const galleryRoutes = new Hono().get('/', (context) => context.text('gallery'));
`;

const GALLERY_SERVER_ASSEMBLY = `import type { Hono } from 'hono';
import { galleryRoutes } from '../../features/gallery';

export default function composeGalleryServer(app: Hono): void {
  app.route('/gallery', galleryRoutes);
}
`;

describe('feature requirements metadata', () => {
  it('reads absent requirements as no requirements', () => {
    const official = officialFixture({ 'index.ts': 'export const value = 1;\n' });
    expect(readFeatureRequirements(official)).toEqual({ ok: true, requirements: undefined });
  });

  it('rejects malformed requirements deterministically', () => {
    const invalidJson = officialFixture({
      'index.ts': 'export const value = 1;\n',
      '.nara/requirements.json': '{ nope',
    });
    expect(readFeatureRequirements(invalidJson).ok).toBe(false);

    const badSchema = officialFixture({
      'index.ts': 'export const value = 1;\n',
      '.nara/requirements.json': JSON.stringify({ schemaVersion: 2, providers: [], packages: {} }),
    });
    const schema = readFeatureRequirements(badSchema);
    expect(schema.ok).toBe(false);
    if (!schema.ok) expect(schema.error).toContain('schemaVersion');

    const badProvider = officialFixture({
      'index.ts': 'export const value = 1;\n',
      '.nara/requirements.json': JSON.stringify({ schemaVersion: 1, providers: ['Bad Name'], packages: {} }),
    });
    expect(readFeatureRequirements(badProvider).ok).toBe(false);

    const badPackage = officialFixture({
      'index.ts': 'export const value = 1;\n',
      '.nara/requirements.json': JSON.stringify({ schemaVersion: 1, providers: [], packages: { '../evil': '^1.0.0' } }),
    });
    expect(readFeatureRequirements(badPackage).ok).toBe(false);
  });

  it('collects bare imports with platform and alias normalization', () => {
    const files = new Map<string, string>([
      ['index.ts', `import { z } from 'zod';\nimport type { Hono } from 'hono';\nimport { trim } from '../../shared/x';\nimport fs from 'node:fs';\nimport { app } from '@/app/server';\nexport const schema = z.string();\n`],
      ['web/page.vue', `<script setup lang="ts">\nimport { ref } from 'vue';\nimport sharp from 'sharp';\nimport { thing } from '@scope/pkg/sub';\n</script>\n<template><div /></template>\n`],
      ['tests/ignored.test.ts', `import axios from 'axios';\n`],
      ['server/dynamic.ts', `const mod = await import('pino');\nconst req = require('dotenv');\n`],
    ]);
    expect([...collectBareImports(files, {})].sort()).toEqual(['@scope/pkg', 'dotenv', 'pino', 'sharp', 'zod']);
  });

  it('rejects hidden and stale package declarations in both directions', () => {
    const files = new Map<string, string>([['index.ts', `import { z } from 'zod';\nimport sharp from 'sharp';\n`]]);
    const hidden = validateRequirementsAgainstSource(
      { schemaVersion: 1, providers: [], packages: { zod: '^4.4.3' } },
      files,
      {},
    );
    expect(hidden).toContain('"sharp"');

    const stale = validateRequirementsAgainstSource(
      { schemaVersion: 1, providers: [], packages: { zod: '^4.4.3', sharp: '^0.35.3', axios: '^1.0.0' } },
      files,
      {},
    );
    expect(stale).toContain('"axios"');

    const clean = validateRequirementsAgainstSource(
      { schemaVersion: 1, providers: [], packages: { sharp: '^0.35.3', zod: '^4.4.3' } },
      files,
      {},
    );
    expect(clean).toBeUndefined();
  });
});

describe('requirements-gated installation', () => {
  function providerFixture(extra: Record<string, string> = {}): string {
    return officialFixture({
      'index.ts': `import { z } from 'zod';\n\nexport const schema = z.string();\nexport const widgetRoutes = {};\n`,
      '.nara/assembly/server.ts': `import type { Hono } from 'hono';
import { getCurrentUser } from '../../features/auth';
import { widgetRoutes } from '../../features/widget';

export default function composeWidgetServer(app: Hono): void {
  app.route('/widget', widgetRoutes);
}
`,
      '.nara/requirements.json': JSON.stringify({
        schemaVersion: 1,
        providers: ['auth'],
        packages: { zod: '^4.4.3' },
      }),
      ...extra,
    });
  }

  it('fails closed on malformed requirements before mutation', () => {
    const fixture = createFixture();
    projectShell(fixture, { 'src/features/auth/index.ts': 'export const getCurrentUser = 1;\n' });
    const official = providerFixture({ '.nara/requirements.json': '{ broken' });

    const result = installOfficialFeature('widget', fixture, { officialDirectory: official });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('requirements');
    expect(existsSync(path.join(fixture, 'src/features/widget'))).toBe(false);
    expect(existsSync(path.join(fixture, '.nara/lineage'))).toBe(false);
  });

  it('fails closed when the assembly needs an undeclared provider', () => {
    const fixture = createFixture();
    projectShell(fixture, {
      'src/features/auth/index.ts': 'export const getCurrentUser = 1;\n',
      'src/features/billing/index.ts': 'export const charge = 1;\n',
    });
    const official = officialFixture({
      'index.ts': GALLERY_INDEX,
      '.nara/assembly/server.ts': `import type { Hono } from 'hono';
import { charge } from '../../features/billing';
import { galleryRoutes } from '../../features/gallery';

export default function composeGalleryServer(app: Hono): void {
  app.route('/gallery', galleryRoutes);
  void charge;
}
`,
      '.nara/requirements.json': JSON.stringify({ schemaVersion: 1, providers: [], packages: {} }),
    });

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('prerequisite');
    expect(result.error.message).toContain('"billing"');
    expect(existsSync(path.join(fixture, 'src/features/gallery'))).toBe(false);
  });

  it('fails closed on a declared but unused provider', () => {
    const fixture = createFixture();
    projectShell(fixture, { 'src/features/auth/index.ts': 'export const getCurrentUser = 1;\n' });
    const official = officialFixture({
      'index.ts': GALLERY_INDEX,
      '.nara/assembly/server.ts': GALLERY_SERVER_ASSEMBLY,
      '.nara/requirements.json': JSON.stringify({ schemaVersion: 1, providers: ['auth'], packages: {} }),
    });

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('prerequisite');
    expect(result.error.message).toContain('"auth"');
    expect(existsSync(path.join(fixture, 'src/features/gallery'))).toBe(false);
  });

  it('requires the declared provider with the task wording', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const official = providerFixture();

    const result = installOfficialFeature('widget', fixture, { officialDirectory: official });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('prerequisite');
    expect(result.error.message).toContain('requires an "auth" provider');
    expect(existsSync(path.join(fixture, 'src/features/widget'))).toBe(false);
    expect(existsSync(path.join(fixture, 'src/app/bindings'))).toBe(false);
  });

  it('adds missing packages to package.json and reports them', () => {
    const fixture = createFixture();
    projectShell(fixture, { 'src/features/auth/index.ts': 'export const getCurrentUser = 1;\n' });
    const official = providerFixture();

    const result = installOfficialFeature('widget', fixture, { officialDirectory: official });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feature.packageDependencies).toEqual([{ name: 'zod', version: '^4.4.3' }]);
    const manifest = JSON.parse(readFileSync(path.join(fixture, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(manifest.dependencies).toEqual({ zod: '^4.4.3' });
  });

  it('keeps identical declarations byte-identical and preserves unrelated content', () => {
    const fixture = createFixture();
    projectShell(fixture, {
      'src/features/auth/index.ts': 'export const getCurrentUser = 1;\n',
      'package.json': `{
  "name": "fixture",
  "version": "0.0.0",
  "scripts": { "test": "vitest run" },
  "dependencies": { "hono": "^4.13.5", "zod": "^4.4.3" }
}
`,
    });
    const manifestBefore = readFileSync(path.join(fixture, 'package.json'), 'utf8');
    const official = providerFixture();

    const result = installOfficialFeature('widget', fixture, { officialDirectory: official });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feature.packageDependencies).toEqual([]);
    expect(readFileSync(path.join(fixture, 'package.json'), 'utf8')).toBe(manifestBefore);
  });

  it('fails closed on a conflicting declaration with full rollback', () => {
    const fixture = createFixture();
    const packageJson = `{
  "name": "fixture",
  "version": "0.0.0",
  "dependencies": { "zod": "^3.0.0" }
}
`;
    projectShell(fixture, {
      'src/features/auth/index.ts': 'export const getCurrentUser = 1;\n',
      'package.json': packageJson,
    });
    const serverBefore = readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8');
    const official = providerFixture();

    const result = installOfficialFeature('widget', fixture, { officialDirectory: official });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('package-conflict');
    expect(result.error.message).toContain('"zod"');
    expect(result.error.message).toContain('^3.0.0');
    expect(result.error.message).toContain('^4.4.3');
    expect(existsSync(path.join(fixture, 'src/features/widget'))).toBe(false);
    expect(existsSync(path.join(fixture, '.nara/lineage'))).toBe(false);
    expect(existsSync(path.join(fixture, 'src/app/bindings'))).toBe(false);
    expect(readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8')).toBe(serverBefore);
    expect(readFileSync(path.join(fixture, 'package.json'), 'utf8')).toBe(packageJson);
  });

  it('fails closed without package.json when packages are required', () => {
    const fixture = createFixture();
    writeFiles(fixture, {
      'src/app/server.ts': MINIMAL_SERVER_ROOT,
      'src/app/router.ts': MINIMAL_ROUTER_ROOT,
      'src/features/auth/index.ts': 'export const getCurrentUser = 1;\n',
    });
    const official = providerFixture();

    const result = installOfficialFeature('widget', fixture, { officialDirectory: official });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('composition');
    expect(existsSync(path.join(fixture, 'src/features/widget'))).toBe(false);
  });

  it('installs source-only features with package requirements and no bindings', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const official = officialFixture({
      'index.ts': `import { z } from 'zod';\n\nexport const schema = z.string();\n`,
      '.nara/requirements.json': JSON.stringify({ schemaVersion: 1, providers: [], packages: { zod: '^4.4.3' } }),
    });

    const result = installOfficialFeature('plain', fixture, { officialDirectory: official });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feature.bindings).toEqual([]);
    expect(result.feature.packageDependencies).toEqual([{ name: 'zod', version: '^4.4.3' }]);
    const manifest = JSON.parse(readFileSync(path.join(fixture, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(manifest.dependencies).toEqual({ zod: '^4.4.3' });
  });
});

describe('evolution requirements separation', () => {
  it('reports unsatisfied incoming requirements without touching bindings or package.json', () => {
    const fixture = createFixture();
    projectShell(fixture, { 'src/features/auth/index.ts': 'export const getCurrentUser = 1;\n' });
    const assemblyWithProvider = `import type { Hono } from 'hono';
import { getCurrentUser } from '../../features/auth';
import { galleryRoutes } from '../../features/gallery';

export default function composeGalleryServer(app: Hono): void {
  app.route('/gallery', galleryRoutes);
  void getCurrentUser;
}
`;
    const official = officialFixture({
      'index.ts': GALLERY_INDEX,
      '.nara/assembly/server.ts': assemblyWithProvider,
      '.nara/requirements.json': JSON.stringify({ schemaVersion: 1, providers: ['auth'], packages: {} }),
    });
    const installed = installOfficialFeature('gallery', fixture, { officialDirectory: official });
    expect(installed.ok).toBe(true);

    const incoming = mkdtempSync(path.join(os.tmpdir(), 'nara-gallery-incoming-'));
    fixtures.push(incoming);
    writeFiles(incoming, {
      'index.ts': `${GALLERY_INDEX}\nexport const galleryNext = 'incoming';\n`,
      '.nara/assembly/server.ts': assemblyWithProvider,
      '.nara/requirements.json': JSON.stringify({ schemaVersion: 1, providers: ['auth'], packages: { zod: '^4.4.3' } }),
    });
    rmSync(path.join(fixture, 'src/features/auth'), { recursive: true, force: true });
    const bindingBefore = readFileSync(path.join(fixture, 'src/app/bindings/gallery.server.ts'), 'utf8');
    const manifestBefore = readFileSync(path.join(fixture, 'package.json'), 'utf8');

    const evolved = evolveFeature({ feature: 'gallery', cwd: fixture, officialDirectory: incoming });

    expect(evolved.ok).toBe(true);
    if (!evolved.ok) return;
    expect(evolved.plan.status).toBe('applied');
    expect(evolved.plan.requirementsNotice ?? []).toEqual(
      expect.arrayContaining([
        expect.stringContaining('"auth"'),
        expect.stringContaining('"zod"'),
      ]),
    );
    expect(readFileSync(path.join(fixture, 'src/app/bindings/gallery.server.ts'), 'utf8')).toBe(bindingBefore);
    expect(readFileSync(path.join(fixture, 'package.json'), 'utf8')).toBe(manifestBefore);
  });

  it('omits the notice when incoming requirements stay satisfied', () => {
    const fixture = createFixture();
    projectShell(fixture, { 'src/features/auth/index.ts': 'export const getCurrentUser = 1;\n' });
    const official = officialFixture({
      'index.ts': GALLERY_INDEX,
      '.nara/assembly/server.ts': `import type { Hono } from 'hono';
import { getCurrentUser } from '../../features/auth';
import { galleryRoutes } from '../../features/gallery';

export default function composeGalleryServer(app: Hono): void {
  app.route('/gallery', galleryRoutes);
  void getCurrentUser;
}
`,
      '.nara/requirements.json': JSON.stringify({ schemaVersion: 1, providers: ['auth'], packages: {} }),
    });
    const installed = installOfficialFeature('gallery', fixture, { officialDirectory: official });
    expect(installed.ok).toBe(true);

    const incoming = mkdtempSync(path.join(os.tmpdir(), 'nara-gallery-incoming-'));
    fixtures.push(incoming);
    writeFiles(incoming, {
      'index.ts': `${GALLERY_INDEX}\nexport const galleryNext = 'incoming';\n`,
      '.nara/assembly/server.ts': readFileSync(path.join(official, '.nara/assembly/server.ts'), 'utf8'),
      '.nara/requirements.json': readFileSync(path.join(official, '.nara/requirements.json'), 'utf8'),
    });

    const evolved = evolveFeature({ feature: 'gallery', cwd: fixture, officialDirectory: incoming });

    expect(evolved.ok).toBe(true);
    if (!evolved.ok) return;
    expect(evolved.plan.status).toBe('applied');
    expect(evolved.plan.requirementsNotice).toBeUndefined();
  });
});

describe('requirements metadata separation', () => {
  it('leaves architecture interpretation untouched without requirements metadata', () => {
    const fixture = createFixture();
    projectShell(fixture, { 'src/features/auth/index.ts': 'export const getCurrentUser = 1;\n' });
    const official = officialFixture({
      'index.ts': GALLERY_INDEX,
      '.nara/assembly/server.ts': GALLERY_SERVER_ASSEMBLY,
      '.nara/requirements.json': JSON.stringify({ schemaVersion: 1, providers: [], packages: {} }),
    });
    const installed = installOfficialFeature('gallery', fixture, { officialDirectory: official });
    expect(installed.ok).toBe(true);

    const doctorBefore = analyzeArchitecture(fixture);
    const inspection = inspectFeature('gallery', fixture);
    expect(inspection.ok).toBe(true);

    rmSync(path.join(official, '.nara', 'requirements.json'));

    const doctorAfter = analyzeArchitecture(fixture);
    const inspectionAfter = inspectFeature('gallery', fixture);
    expect(doctorAfter).toEqual(doctorBefore);
    expect(inspectionAfter).toEqual(inspection);
  });

  it('reports installed package dependencies through the add command', () => {
    const output: string[] = [];
    const errors: string[] = [];
    const io = {
      output,
      errors,
      stdout: (message: string) => output.push(message),
      stderr: (message: string) => errors.push(message),
    };
    const fixture = createFixture();
    projectShell(fixture, {
      'src/features/auth/index.ts': [
        'export const createAccountWithRoles = (): unknown => ({});',
        'export const deleteAccounts = (): number => 0;',
        'export const findAccountById = (): undefined => undefined;',
        'export const findAllRoles = (): Array<{ id: string; slug: string }> => [];',
        'export const getCurrentUser = (): undefined => undefined;',
        'export const getUserRoles = (): Array<{ slug: string }> => [];',
        'export const getUsersWithRole = (): Array<{ id: string }> => [];',
        'export const hashPassword = async (password: string): Promise<string> => password;',
        'export const hasPermission = (): boolean => false;',
        'export const isAdmin = (): boolean => false;',
        'export const listAccounts = (): { data: unknown[]; total: number } => ({ data: [], total: 0 });',
        'export const resetAccountPassword = (): undefined => undefined;',
        "export const SESSION_COOKIE_NAME = 'auth_id';",
        'export const updateAccountWithRoles = (): undefined => undefined;',
        '',
      ].join('\n'),
      'src/features/auth/web/index.ts': [
        'export const createAccessClient = (): unknown => ({});',
        'export const createAuthClient = (): unknown => ({});',
        'export const csrfHeaders = (): Record<string, string> => ({});',
        'export const ensureCsrfToken = async (): Promise<void> => {};',
        'export const useAuthSession = (): unknown => ({});',
        '',
      ].join('\n'),
    });

    const result = runCli(['add', 'users'], io, { cwd: fixture });
    const text = output.join('');

    expect(result.exitCode).toBe(0);
    expect(text).toContain('+ package.json dependency: sharp@^0.35.3');
    expect(text).toContain('+ package.json dependency: zod@^4.4.3');
    expect(text).toContain('Dependencies added to package.json. Run npm install.');
    const manifest = JSON.parse(readFileSync(path.join(fixture, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(manifest.dependencies).toMatchObject({ sharp: '^0.35.3', zod: '^4.4.3' });
  });
});
