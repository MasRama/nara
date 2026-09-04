import { existsSync, mkdtempSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { newProject } from '../commands/new-project';
import { runCli, type CliIO } from '../router';

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
      dev: 'tsx scripts/dev.ts',
      'dev:server': 'tsx watch src/server.ts',
      build: 'vite build && tsc',
      start: 'node build/server.js',
      typecheck: 'tsc --noEmit',
      lint: 'npm run typecheck',
      'typecheck:frontend': 'vue-tsc --noEmit -p tsconfig.frontend.json',
      test: 'vitest run',
      'architecture:doctor': 'nara doctor',
      check: 'npm run typecheck && npm run typecheck:frontend && npm test && npm run architecture:doctor',
    });
    expect(Object.keys(packageJson.dependencies).sort()).toEqual([
      '@hono/node-server',
      'hono',
      'vue',
      'vue-router',
    ]);
    expect(Object.keys(packageJson.devDependencies).sort()).toEqual([
      '@types/node',
      '@vitejs/plugin-vue',
      'jsdom',
      'nara',
      'tsx',
      'typescript',
      'vite',
      'vitest',
      'vue-tsc',
    ]);
    const rootManifest = JSON.parse(
      readFileSync(path.join(__dirname, '..', '..', '..', 'package.json'), 'utf8'),
    ) as { version: string };
    expect(packageJson.devDependencies.nara).toBe(rootManifest.version);
    expect(packageJson.devDependencies.nara).not.toMatch(/^[ ^~]/);

    const expectedFiles = [
      'scripts/dev.ts',
      'AGENTS.md',
      'resources/app.ts',
      'resources/index.css',
      'resources/index.html',
      'src/app/App.vue',
      'src/app/pages/HomePage.vue',
      'src/app/pages/NotFoundPage.vue',
      'src/app/router.ts',
      'src/app/server.ts',
      'src/features/health/index.ts',
      'src/features/health/tests/health.test.ts',
      'src/server.ts',
      'src/vue.d.ts',
      'tsconfig.frontend.json',
      'tsconfig.json',
      'vite.config.mjs',
      'vitest.config.mjs',
    ];
    for (const file of expectedFiles) {
      expect(existsSync(path.join(projectDirectory, file))).toBe(true);
    }
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
