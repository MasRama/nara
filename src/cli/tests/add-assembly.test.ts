import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeArchitecture } from '../architecture/doctor';
import { discoverFeatureIntegrations } from '../architecture/discover-integrations';
import { readFeatureLineage } from '../evolution/lineage';
import { evolveFeature } from '../commands/evolve';
import { runCli, type CliIO } from '../router';
import { installOfficialFeature } from '../composition/install-feature';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-assembly-'));
  fixtures.push(fixture);
  return fixture;
}

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

const GALLERY_INDEX = `import { Hono } from 'hono';

export const galleryRoutes = new Hono().get('/', (context) => context.text('gallery'));
`;

const GALLERY_WEB_INDEX = `export const GalleryPage = { template: '<div>gallery</div>' };
`;

const GALLERY_SERVER_ASSEMBLY = `import type { Hono } from 'hono';
import { galleryRoutes } from '../../features/gallery';

export default function composeGalleryServer(app: Hono): void {
  app.route('/gallery', galleryRoutes);
}
`;

const GALLERY_WEB_ASSEMBLY = `import type { RouteRecordRaw } from 'vue-router';
import { GalleryPage } from '../../features/gallery/web';

export default [
  {
    path: '/gallery',
    name: 'gallery',
    component: GalleryPage,
  },
] satisfies RouteRecordRaw[];
`;

function writeFiles(directory: string, files: Record<string, string>): void {
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(directory, ...relative.split('/'));
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

function officialFixture(files: Record<string, string>): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nara-official-'));
  fixtures.push(directory);
  writeFiles(directory, files);
  return directory;
}

function galleryOfficial(extra: Record<string, string> = {}): string {
  return officialFixture({
    'index.ts': GALLERY_INDEX,
    'web/index.ts': GALLERY_WEB_INDEX,
    ...extra,
  });
}

function projectShell(fixture: string, options: { server?: string; router?: string } = {}): void {
  writeFiles(fixture, {
    'src/app/server.ts': options.server ?? MINIMAL_SERVER_ROOT,
    'src/app/router.ts': options.router ?? MINIMAL_ROUTER_ROOT,
  });
}

describe('assembly installation', () => {
  it('keeps source-only features on the current behavior', () => {
    const fixture = createFixture();
    const official = galleryOfficial();

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feature.bindings).toEqual([]);
    expect(result.feature.composedRoots).toEqual([]);
    expect(existsSync(path.join(fixture, 'src', 'app', 'bindings'))).toBe(false);
    expect(existsSync(path.join(fixture, 'src/features/gallery/index.ts'))).toBe(true);
  });

  it('installs a server assembly as one transaction', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const official = galleryOfficial({ '.nara/assembly/server.ts': GALLERY_SERVER_ASSEMBLY });

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const binding = path.join(fixture, 'src/app/bindings/gallery.server.ts');
    expect(result.feature.bindings).toEqual([binding]);
    expect(result.feature.composedRoots).toEqual([path.join(fixture, 'src/app/server.ts')]);
    expect(readFileSync(binding, 'utf8')).toBe(GALLERY_SERVER_ASSEMBLY);
    const serverRoot = readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8');
    expect(serverRoot).toContain(`import composeGalleryServer from './bindings/gallery.server';`);
    expect(serverRoot).toContain('composeGalleryServer(app);');
    const integrations = discoverFeatureIntegrations(fixture).gallery;
    expect(integrations.applicationImports).toEqual([
      { feature: 'gallery', appFile: 'src/app/bindings/gallery.server.ts', boundary: 'public', symbols: ['galleryRoutes'] },
    ]);
    expect(integrations.serverRoutes).toEqual([
      { feature: 'gallery', appFile: 'src/app/server.ts', exportName: 'galleryRoutes', mountPath: '/gallery' },
    ]);
    expect(analyzeArchitecture(fixture).healthy).toBe(true);
  });

  it('installs a web assembly through an isolated fixture', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const official = galleryOfficial({ '.nara/assembly/web.ts': GALLERY_WEB_ASSEMBLY });

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const binding = path.join(fixture, 'src/app/bindings/gallery.web.ts');
    expect(result.feature.bindings).toEqual([binding]);
    expect(result.feature.composedRoots).toEqual([path.join(fixture, 'src/app/router.ts')]);
    const routerRoot = readFileSync(path.join(fixture, 'src/app/router.ts'), 'utf8');
    expect(routerRoot).toContain(`import galleryWebRoutes from './bindings/gallery.web';`);
    const spreadIndex = routerRoot.indexOf('...galleryWebRoutes,');
    const catchAllIndex = routerRoot.indexOf('/:pathMatch(.*)*');
    expect(spreadIndex).toBeGreaterThan(-1);
    expect(spreadIndex).toBeLessThan(catchAllIndex);
    const integrations = discoverFeatureIntegrations(fixture).gallery;
    expect(integrations.webRoutes).toEqual([
      { feature: 'gallery', appFile: 'src/app/router.ts', exportName: 'GalleryPage', path: '/gallery', name: 'gallery' },
    ]);
    expect(analyzeArchitecture(fixture).healthy).toBe(true);
  });

  it('installs server and web assemblies together', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const official = galleryOfficial({
      '.nara/assembly/server.ts': GALLERY_SERVER_ASSEMBLY,
      '.nara/assembly/web.ts': GALLERY_WEB_ASSEMBLY,
    });

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.feature.bindings).toHaveLength(2);
    expect(result.feature.composedRoots).toHaveLength(2);
    const integrations = discoverFeatureIntegrations(fixture).gallery;
    expect(integrations.serverRoutes).toHaveLength(1);
    expect(integrations.webRoutes).toHaveLength(1);
    expect(analyzeArchitecture(fixture).healthy).toBe(true);
  });

  it('is deterministic across installations', () => {
    const first = createFixture();
    const second = createFixture();
    projectShell(first);
    projectShell(second);
    const official = galleryOfficial({
      '.nara/assembly/server.ts': GALLERY_SERVER_ASSEMBLY,
      '.nara/assembly/web.ts': GALLERY_WEB_ASSEMBLY,
    });

    const firstResult = installOfficialFeature('gallery', first, { officialDirectory: official });
    const secondResult = installOfficialFeature('gallery', second, { officialDirectory: official });

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    for (const relative of ['src/app/bindings/gallery.server.ts', 'src/app/bindings/gallery.web.ts', 'src/app/server.ts', 'src/app/router.ts']) {
      expect(readFileSync(path.join(second, ...relative.split('/'))).toString()).toBe(
        readFileSync(path.join(first, ...relative.split('/'))).toString(),
      );
    }
  });

  it('refuses a binding collision without mutation', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const binding = path.join(fixture, 'src/app/bindings/gallery.server.ts');
    mkdirSync(path.dirname(binding), { recursive: true });
    writeFileSync(binding, 'local binding\n');
    const serverBefore = readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8');
    const official = galleryOfficial({ '.nara/assembly/server.ts': GALLERY_SERVER_ASSEMBLY });

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('duplicate');
    expect(result.error.message).toContain('nothing was overwritten');
    expect(readFileSync(binding, 'utf8')).toBe('local binding\n');
    expect(existsSync(path.join(fixture, 'src/features/gallery'))).toBe(false);
    expect(existsSync(path.join(fixture, '.nara/lineage'))).toBe(false);
    expect(readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8')).toBe(serverBefore);
  });

  it('refuses a feature collision without installing bindings', () => {
    const fixture = createFixture();
    projectShell(fixture);
    writeFiles(fixture, { 'src/features/gallery/index.ts': 'local source\n' });
    const official = galleryOfficial({ '.nara/assembly/server.ts': GALLERY_SERVER_ASSEMBLY });

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('duplicate');
    expect(existsSync(path.join(fixture, 'src/app/bindings/gallery.server.ts'))).toBe(false);
    expect(readFileSync(path.join(fixture, 'src/features/gallery/index.ts'), 'utf8')).toBe('local source\n');
  });

  it('rejects a malformed assembly template without mutation', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const serverBefore = readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8');
    const official = galleryOfficial({
      '.nara/assembly/server.ts': `import { galleryRoutes } from '../../features/gallery';\n\nexport const nothing = galleryRoutes;\n`,
    });

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('invalid-assembly');
    expect(existsSync(path.join(fixture, 'src/features/gallery'))).toBe(false);
    expect(existsSync(path.join(fixture, '.nara/lineage'))).toBe(false);
    expect(existsSync(path.join(fixture, 'src/app/bindings/gallery.server.ts'))).toBe(false);
    expect(readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8')).toBe(serverBefore);
  });

  it('leaves the project untouched when the app root cannot be composed', () => {
    const fixture = createFixture();
    projectShell(fixture, { server: `export const app = {};\n` });
    const official = galleryOfficial({ '.nara/assembly/server.ts': GALLERY_SERVER_ASSEMBLY });

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('composition');
    expect(existsSync(path.join(fixture, 'src/features/gallery'))).toBe(false);
    expect(existsSync(path.join(fixture, '.nara/lineage'))).toBe(false);
    expect(existsSync(path.join(fixture, 'src/app/bindings'))).toBe(false);
    expect(readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8')).toBe(`export const app = {};\n`);
  });

  it('blocks an assembly that introduces a new diagnostic', () => {
    const fixture = createFixture();
    projectShell(fixture);
    writeFiles(fixture, {
      'src/features/alpha/index.ts': `export const alphaValue = 1;\n`,
      'src/features/alpha/server/secret.ts': `export const secret = 1;\n`,
    });
    const serverBefore = readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8');
    expect(analyzeArchitecture(fixture).healthy).toBe(true);
    const official = officialFixture({
      'index.ts': `import { secret } from '../alpha/server/secret';\n\nexport const galleryRoutes = secret;\n`,
      '.nara/assembly/server.ts': GALLERY_SERVER_ASSEMBLY,
    });

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('composition');
    expect(result.error.message).toContain('CROSS_FEATURE_INTERNAL_IMPORT');
    expect(existsSync(path.join(fixture, 'src/features/gallery'))).toBe(false);
    expect(existsSync(path.join(fixture, '.nara/lineage'))).toBe(false);
    expect(existsSync(path.join(fixture, 'src/app/bindings/gallery.server.ts'))).toBe(false);
    expect(readFileSync(path.join(fixture, 'src/app/server.ts'), 'utf8')).toBe(serverBefore);
  });

  it('tolerates an existing baseline diagnostic', () => {
    const fixture = createFixture();
    projectShell(fixture);
    writeFiles(fixture, {
      'src/features/beta/server/secret.ts': `export const secret = 1;\n`,
      'src/features/beta/index.ts': `export const betaValue = 1;\n`,
      'src/features/alpha/index.ts': `import { secret } from '../beta/server/secret';\n\nexport const alphaValue = secret;\n`,
    });
    expect(analyzeArchitecture(fixture).healthy).toBe(false);
    const official = galleryOfficial({ '.nara/assembly/server.ts': GALLERY_SERVER_ASSEMBLY });

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(true);
  });

  it('reports installed bindings and composed roots deterministically', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const io = createIO();

    const result = runCli(['add', 'health'], io, { cwd: fixture });

    expect(result.exitCode).toBe(0);
    const output = io.output.join('');
    expect(output).toContain('- src/app/bindings/health.server.ts');
    expect(output).toContain('~ src/app/server.ts');
    expect(output).toContain('- src/features/health/index.ts');
  });
});

describe('assembly ownership', () => {
  it('keeps application bindings out of feature lineage', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const official = galleryOfficial({
      '.nara/assembly/server.ts': GALLERY_SERVER_ASSEMBLY,
      '.nara/assembly/web.ts': GALLERY_WEB_ASSEMBLY,
    });

    const result = installOfficialFeature('gallery', fixture, { officialDirectory: official });

    expect(result.ok).toBe(true);
    const lineage = readFeatureLineage(fixture, 'gallery');
    expect(lineage).toBeDefined();
    if (!lineage) return;
    expect([...lineage.files.keys()].sort()).toEqual(['index.ts', 'web/index.ts']);
    for (const relative of [...lineage.files.keys()]) {
      expect(relative.startsWith('bindings/')).toBe(false);
      expect(relative).not.toBe('src/app/server.ts');
      expect(relative).not.toBe('src/app/router.ts');
    }
  });

  it('preserves customized bindings byte-for-byte across evolution', () => {
    const fixture = createFixture();
    projectShell(fixture);
    const official = galleryOfficial({ '.nara/assembly/server.ts': GALLERY_SERVER_ASSEMBLY });
    const installed = installOfficialFeature('gallery', fixture, { officialDirectory: official });
    expect(installed.ok).toBe(true);

    const binding = path.join(fixture, 'src/app/bindings/gallery.server.ts');
    writeFileSync(binding, `${readFileSync(binding, 'utf8')}// Local customization: mount stays under application control.\n`);
    const customized = readFileSync(binding);

    const incoming = officialFixture({
      'index.ts': `${GALLERY_INDEX}\nexport const galleryVersion = 'next';\n`,
      '.nara/assembly/server.ts': GALLERY_SERVER_ASSEMBLY,
    });
    const evolved = evolveFeature({ feature: 'gallery', cwd: fixture, officialDirectory: incoming });

    expect(evolved.ok).toBe(true);
    if (!evolved.ok) return;
    expect(evolved.plan.status).toBe('applied');
    expect(readFileSync(path.join(fixture, 'src/features/gallery/index.ts'), 'utf8')).toContain(`galleryVersion = 'next'`);
    expect(readFileSync(binding)).toEqual(customized);
    const lineage = readFeatureLineage(fixture, 'gallery');
    expect(lineage?.files.has('src/app/bindings/gallery.server.ts')).toBe(false);
  });
});
