import { existsSync, mkdtempSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { newProject } from '../commands/new-project';
import { digestFeatureFiles, featureFilesEqual, readFeatureFiles, readFeatureLineage } from '../evolution/lineage';
import { resolveOfficialFeatureDirectory } from '../package-root';
import { runCli, type CliIO } from '../router';
import { discoverFeatureIntegrations } from '../architecture/discover-integrations';
import { inspectFeature } from '../architecture/inspect';
import { buildFeatureContext } from '../architecture/context';
const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-new-'));
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

describe('new project', () => {
  it('creates a minimal canonical Vue and Hono v3 project', () => {
    const fixture = createFixture();

    const result = newProject('ledger', fixture);

    if (!result.ok) {
      throw new Error(result.error.message);
    }
    const projectDirectory = result.project.directory;
    const packageJson = JSON.parse(
      readFileSync(path.join(projectDirectory, 'package.json'), 'utf8'),
    ) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(packageJson.scripts).toMatchObject({
      dev: 'vite',
      build: 'vite build && tsc',
      start: 'node build/server.js',
      typecheck: 'tsc --noEmit && tsc --noEmit -p tsconfig.tests.json',
      lint: 'npm run typecheck',
      'typecheck:frontend': 'vue-tsc --noEmit -p tsconfig.frontend.json',
      test: 'vitest run',
      'architecture:doctor': 'nara doctor',
      check: 'npm run typecheck && npm run typecheck:frontend && npm test && npm run architecture:doctor',
    });
    expect(Object.keys(packageJson.dependencies).sort()).toEqual([
      '@hono/node-server',
      'better-sqlite3',
      'dotenv',
      'hono',
      'vue',
      'vue-router',
      'zod',
    ]);
    expect(Object.keys(packageJson.devDependencies).sort()).toEqual([
      '@hono/vite-dev-server',
      '@nara-web/cli',
      '@types/better-sqlite3',
      '@types/node',
      '@vitejs/plugin-vue',
      'jsdom',
      'tsx',
      'typescript',
      'vite',
      'vitest',
      'vue-tsc',
    ]);
    const rootManifest = JSON.parse(
      readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8'),
    ) as { version: string; dependencies: Record<string, string>; devDependencies: Record<string, string> };
    for (const name of ['better-sqlite3', 'dotenv', 'zod']) {
      expect(packageJson.dependencies[name]).toBe(rootManifest.dependencies[name]);
    }
    expect(packageJson.devDependencies['@types/better-sqlite3']).toBe(
      rootManifest.devDependencies['@types/better-sqlite3'],
    );
    expect(packageJson.devDependencies['@nara-web/cli']).toBe(rootManifest.version);
    expect(packageJson.devDependencies['@nara-web/cli']).not.toMatch(/^[ ^~]/);

    const expectedFiles = [
      'AGENTS.md',
      'resources/app.ts',
      'resources/index.css',
      'resources/index.html',
      'src/app/App.vue',
      'src/app/pages/HomePage.vue',
      'src/app/pages/NotFoundPage.vue',
      'src/app/router.ts',
      'src/app/server.ts',
      'src/features/health/contract.ts',
      'src/features/health/index.ts',
      'src/features/health/tests/health.test.ts',
      'tests/health.test.ts',
      'src/server.ts',
      'src/shared/config/constants.ts',
      'src/shared/config/env.ts',
      'src/shared/config/index.ts',
      'src/shared/database/index.ts',
      'src/shared/database/migrator.ts',
      'src/shared/database/seeder.ts',
      'src/shared/database/sqlite.ts',
      'src/vue.d.ts',
      'tsconfig.frontend.json',
      'tsconfig.json',
      'tsconfig.tests.json',
      'vite.config.mjs',
      'vitest.config.mjs',
    ];
    for (const file of expectedFiles) {
      expect(existsSync(path.join(projectDirectory, file))).toBe(true);
    }
    expect(readFileSync(path.join(projectDirectory, 'src/server.ts'), 'utf8')).toContain("hostname: '127.0.0.1'");
    expect(readFileSync(path.join(projectDirectory, 'src/server.ts'), 'utf8')).toContain("from './shared/database'");
    expect(readFileSync(path.join(projectDirectory, 'src/server.ts'), 'utf8')).toContain('migrate()');
    expect(readFileSync(path.join(projectDirectory, '.gitignore'), 'utf8')).toContain('database/');
    expect(readFileSync(path.join(projectDirectory, 'resources/app.ts'), 'utf8')).toContain(
      "createApp(App).use(router).mount('#app');",
    );
    expect(readFileSync(path.join(projectDirectory, 'src/app/App.vue'), 'utf8')).toContain('<RouterView />');
    expect(readFileSync(path.join(projectDirectory, 'src/app/router.ts'), 'utf8')).toContain('createWebHistory');
    expect(readFileSync(path.join(projectDirectory, 'src/app/router.ts'), 'utf8')).toContain('/:pathMatch(.*)*');
    expect(existsSync(path.join(projectDirectory, 'src/app.ts'))).toBe(false);

    const obsoleteStack = /Svelte|@inertiajs\/svelte|Inertia|Bits UI|Ultimate Express|uWebSockets\.js|Nuxt|React/i;
    for (const file of result.project.files) {
      expect(readFileSync(file, 'utf8')).not.toMatch(obsoleteStack);
    }
    expect(readFileSync(path.join(projectDirectory, 'vite.config.mjs'), 'utf8')).toContain("host: '127.0.0.1'");
    expect(readFileSync(path.join(projectDirectory, 'vite.config.mjs'), 'utf8')).toContain("entry: '../src/app/server.ts'");
    expect(readFileSync(path.join(projectDirectory, 'vite.config.mjs'), 'utf8')).not.toContain('proxy:');
    expect(readFileSync(path.join(projectDirectory, 'src/server.ts'), 'utf8')).toContain("hostname: '127.0.0.1'");
    expect(existsSync(path.join(projectDirectory, 'scripts/dev.ts'))).toBe(false);
    const testsTsconfig = JSON.parse(readFileSync(path.join(projectDirectory, 'tsconfig.tests.json'), 'utf8')) as {
      extends?: string;
      include?: string[];
    };
    expect(testsTsconfig.extends).toBe('./tsconfig.json');
    expect(testsTsconfig.include).toEqual(['src/**/*.test.ts', 'tests/**/*.test.ts']);
    expect(discoverFeatureIntegrations(projectDirectory)).toEqual({
      health: {
        applicationImports: [
          {
            feature: 'health',
            appFile: 'src/app/bindings/health.server.ts',
            boundary: 'public',
            symbols: ['healthRoutes'],
          },
        ],
        serverRoutes: [
          {
            feature: 'health',
            appFile: 'src/app/server.ts',
            exportName: 'healthRoutes',
            mountPath: '/health',
          },
        ],
        webRoutes: [],
      },
    });
    expect(existsSync(path.join(projectDirectory, 'src/app/bindings/health.server.ts'))).toBe(true);
    const generatedServer = readFileSync(path.join(projectDirectory, 'src/app/server.ts'), 'utf8');
    expect(generatedServer).toContain(`import composeHealthServer from './bindings/health.server';`);
    expect(generatedServer).toContain('composeHealthServer(app);');
    expect(generatedServer).not.toContain(`from '../features/health'`);
  });

  it('copies the official Health source and establishes lineage on creation', () => {
    const fixture = createFixture();
    const io = createIO();

    const result = runCli(['new', 'example'], io, { cwd: fixture });

    expect(result.exitCode).toBe(0);
    expect(io.errors).toEqual([]);
    const projectDirectory = path.join(fixture, 'example');
    const official = readFeatureFiles(resolveOfficialFeatureDirectory('health'), false);
    const generated = readFeatureFiles(path.join(projectDirectory, 'src', 'features', 'health'));
    expect(featureFilesEqual(generated, official)).toBe(true);

    const lineage = readFeatureLineage(projectDirectory, 'health');
    expect(lineage).toBeDefined();
    if (!lineage) return;
    expect(featureFilesEqual(lineage.files, official)).toBe(true);
    expect(lineage.record.baseDigest).toBe(digestFeatureFiles(official));

    const evolveIO = createIO();
    const evolveResult = runCli(['evolve', 'health', '--json'], evolveIO, { cwd: projectDirectory });
    expect(evolveResult.exitCode).toBe(0);
    expect(JSON.parse(evolveIO.output.join('')).status).toBe('up-to-date');
  });

  it('explains the health assembly chain through inspect and context', () => {
    const fixture = createFixture();

    const result = runCli(['new', 'example'], createIO(), { cwd: fixture });

    expect(result.exitCode).toBe(0);
    const projectDirectory = path.join(fixture, 'example');
    const inspected = inspectFeature('health', projectDirectory);
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) return;
    expect(inspected.feature.integrations.serverRoutes).toEqual([
      { feature: 'health', appFile: 'src/app/server.ts', exportName: 'healthRoutes', mountPath: '/health' },
    ]);
    expect(inspected.feature.integrations.applicationImports).toEqual([
      {
        feature: 'health',
        appFile: 'src/app/bindings/health.server.ts',
        boundary: 'public',
        symbols: ['healthRoutes'],
      },
    ]);
    const context = buildFeatureContext('health', projectDirectory);
    expect(context.ok).toBe(true);
    if (!context.ok) return;
    const readingOrder = context.context.readingOrder.map((entry) => entry.path);
    expect(readingOrder).toContain('src/features/health/index.ts');
    expect(readingOrder).toContain('src/app/bindings/health.server.ts');
    expect(readingOrder).toContain('src/app/server.ts');
    expect(readingOrder.indexOf('src/app/bindings/health.server.ts')).toBeGreaterThan(
      readingOrder.indexOf('src/features/health/index.ts'),
    );
  });

  it('rejects unsafe project names', () => {
    const fixture = createFixture();

    const result = newProject('../ledger', fixture);

    if (result.ok) {
      throw new Error('Expected unsafe project name to be rejected');
    }
    expect(result.error.message).toContain('Invalid project name');
  });

  it('refuses an existing project directory without overwriting it', () => {
    const fixture = createFixture();
    const projectDirectory = path.join(fixture, 'ledger');
    mkdirSync(projectDirectory, { recursive: true });
    writeFileSync(path.join(projectDirectory, 'sentinel'), 'existing\n');
    const io = createIO();

    const result = runCli(['new', 'ledger'], io, { cwd: fixture });

    expect(result.exitCode).toBe(73);
    expect(io.errors.join('')).toContain('nothing was overwritten');
    expect(readFileSync(path.join(projectDirectory, 'sentinel'), 'utf8')).toBe('existing\n');
  });
});
