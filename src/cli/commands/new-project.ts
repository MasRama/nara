import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { installOfficialFeature } from '../composition/install-feature';
import { featureNameIsValid } from '../feature-name';
import { readNaraCliVersion, resolveSubstrateDirectory } from '../package-root';

function creatingCliVersion(): string {
  return readNaraCliVersion();
}

/**
 * Guaranteed application substrate: source modules every generated app
 * carries verbatim, so installable Features can rely on them without
 * copying reference-app files. Deliberately small: the SQLite persistence
 * engine (Features own their SQL; the engine is platform) and the
 * environment/config it reads. Everything else stays feature-owned or
 * host-provided.
 */
const SUBSTRATE_FILES = [
  'src/shared/database/index.ts',
  'src/shared/database/sqlite.ts',
  'src/shared/database/migrator.ts',
  'src/shared/database/seeder.ts',
  'src/shared/config/index.ts',
  'src/shared/config/constants.ts',
  'src/shared/config/env.ts',
] as const;

function substrateFiles(): Record<string, string> {
  const base = resolveSubstrateDirectory();
  const files: Record<string, string> = {};
  for (const relative of SUBSTRATE_FILES) {
    const absolute = path.join(base, ...relative.split('/'));
    if (!existsSync(absolute)) {
      throw new Error(`Guaranteed substrate file is missing at ${absolute}; cannot scaffold a new project.`);
    }
    files[relative] = readFileSync(absolute, 'utf8');
  }
  return files;
}


export interface CreatedProject {
  name: string;
  directory: string;
  files: string[];
}

export interface ProjectGenerationError {
  message: string;
  kind: 'invalid-name' | 'duplicate' | 'filesystem';
}

export type NewProjectResult =
  | { ok: true; project: CreatedProject }
  | { ok: false; error: ProjectGenerationError };
function projectFiles(name: string, cliVersion: string): Record<string, string> {
  return {
    ...substrateFiles(),
    'package.json': `${JSON.stringify(
      {
        name,
        version: '0.1.0',
        private: true,
        engines: { node: '>=22.0.0' },
        scripts: {
          dev: 'vite',
          build: 'vite build && tsc',
          start: 'node build/server.js',
          typecheck: 'tsc --noEmit && tsc --noEmit -p tsconfig.tests.json',
          lint: 'npm run typecheck',
          'typecheck:frontend': 'vue-tsc --noEmit -p tsconfig.frontend.json',
          test: 'vitest run',
          'architecture:doctor': 'nara doctor',
          check: 'npm run typecheck && npm run typecheck:frontend && npm test && npm run architecture:doctor',
        },
        dependencies: {
          '@hono/node-server': '^2.1.1',
          'better-sqlite3': '^12.4.1',
          dotenv: '^16.4.5',
          hono: '^4.13.5',
          'vue': '^3.5.42',
          'vue-router': '^5.3.1',
          zod: '^4.4.3',
        },
        devDependencies: {
          '@nara-web/cli': cliVersion,
          '@hono/vite-dev-server': '^0.26.1',
          '@types/better-sqlite3': '^7.6.13',
          '@types/node': '^22.20.1',
          '@vitejs/plugin-vue': '^6.0.8',
          jsdom: '^30.0.1',
          tsx: '^4.19.2',
          typescript: '^5.6.3',
          vite: '8.2.1',
          vitest: '4.1.10',
          'vue-tsc': '^3.3.11',
        },
        overrides: {
          '@vitejs/devtools': '0.4.0',
        },
      },
      null,
      2,
    )}\n`,
    'tsconfig.json': `${JSON.stringify(
      {
        compilerOptions: {
          target: 'es2022',
          // The server program includes browser files: src/app/router.ts
          // composes Feature web bindings, so DOM globals used by browser
          // helpers (CSRF cookie access) must resolve here as well.
          lib: ['es2022', 'dom', 'dom.iterable'],
          outDir: './build',
          rootDir: './src',
          module: 'commonjs',
          moduleResolution: 'node',
          strict: true,
          noImplicitAny: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          esModuleInterop: true,
        },
        include: ['src/**/*.ts'],
        exclude: ['**/*.test.ts'],
      },
      null,
      2,
    )}\n`,
    'tsconfig.tests.json': `${JSON.stringify(
      {
        // Tests resolve modern export-only types (vitest, vite) that the
        // CommonJS server program cannot read, so they typecheck as a
        // separate no-emit program with bundler resolution.
        extends: './tsconfig.json',
        compilerOptions: {
          module: 'esnext',
          moduleResolution: 'bundler',
          noEmit: true,
          rootDir: '.',
          lib: ['es2022', 'dom', 'dom.iterable'],
          types: ['node'],
        },
        include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
        exclude: ['node_modules', 'build'],
      },
      null,
      2,
    )}\n`,
    'tsconfig.frontend.json': `${JSON.stringify(
      {
        compilerOptions: {
          target: 'es2022',
          useDefineForClassFields: true,
          module: 'esnext',
          lib: ['es2022', 'dom', 'dom.iterable'],
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          verbatimModuleSyntax: true,
          noEmit: true,
          strict: true,
          noImplicitAny: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          skipLibCheck: true,
          isolatedModules: true,
          types: ['vite/client'],
        },
        include: [
          'resources/**/*.ts',
          'resources/**/*.vue',
          'src/app/**/*.vue',
          'src/features/**/web/**/*.ts',
          'src/features/**/*.vue',
        ],
      },
      null,
      2,
    )}\n`,
    'vite.config.mjs': `import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import devServer, { defaultOptions } from '@hono/vite-dev-server';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(process.env.PORT || env.PORT || 5555);
  const nonBackendPath = /^(?!\\/(?:api(?:\\/|\\?|$)|health(?:\\/|\\?|$)|ready(?:\\/|\\?|$))).*/;

  return {
    root: 'resources',
    plugins: [
      {
        name: 'nara-application-runtime',
        async configureServer(server) {
          const database = await server.ssrLoadModule('../src/shared/database/index.ts');
          database.migrate();
        },
      },
      devServer({
        entry: '../src/app/server.ts',
        export: 'app',
        injectClientScript: false,
        exclude: [nonBackendPath, ...defaultOptions.exclude],
      }),
      vue(),
    ],
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
    },
    build: {
      outDir: '../build/client',
      emptyOutDir: true,
      target: 'es2022',
    },
  };
});
`,
    'vitest.config.mjs': `import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
`,
    '.gitignore': 'node_modules/\nbuild/\ndist/\n.env\ndatabase/\n',
    'AGENTS.md': `# ${name}

This is a minimal Nara v3 application.

- Runtime: TypeScript, Node.js, Hono, and @hono/node-server.
- Browser stack: Vue 3 + Vite + TypeScript.
- Architecture tooling: the local Nara CLI is a pinned devDependency (npm run architecture:doctor runs nara doctor from this project).
- Run npm run dev for the full-stack development session; one Vite server serves Vue/HMR and mounts Hono on the same port.
- During development, Hono handles /api, /health, and /ready on the Vite listener.
- Business capabilities belong under src/features/<feature>.
- Each Feature exposes behavior through its index.ts public boundary.
- Application-wide Vue composition belongs under src/app/; src/app/router.ts owns browser routes and src/app/pages holds app-owned pages.
- Feature-specific browser code belongs under that Feature's web/ directory, including Feature-owned pages.
- Keep server code separate from browser code; do not add SSR, a second framework, or custom RPC.
- Inspect architecture with the local CLI: npx nara context <feature> --json, npx nara impact <feature> --json, npx nara doctor --json.
- The default Health Feature comes from the bundled official open-code source and already has lineage established; npx nara add <feature> records lineage for later official Features, and npx nara evolve <feature> --dry-run previews bundled updates.
- Run npm run check before handing off changes (it includes the architecture check).

Development uses one port, PORT, which defaults to 5555.
The app entrypoint is resources/app.ts. The Hono composition is src/app/server.ts, and the production server is src/server.ts.
`,
    'resources/index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name} — Nara v3</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/app.ts"></script>
  </body>
</html>
`,
    'resources/app.ts': `import './index.css';
import { createApp } from 'vue';
import App from '../src/app/App.vue';
import router from '../src/app/router';

createApp(App).use(router).mount('#app');
`,
    'resources/index.css': `:root {
  font-family: system-ui, sans-serif;
  color: #1f2937;
  background: #f9fafb;
}

body {
  margin: 0;
}

main {
  max-width: 48rem;
  margin: 0 auto;
  padding: 4rem 1.5rem;
}
`,
    'src/app/App.vue': `<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <RouterView />
</template>
`,
    'src/app/pages/HomePage.vue': `<template>
  <main>
    <h1>Welcome to Nara v3</h1>
    <p>This Vue application is composed by feature.</p>
  </main>
</template>
`,
    'src/app/pages/NotFoundPage.vue': `<template>
  <main>
    <p>404</p>
    <h1>Page not found</h1>
    <p>The browser route you requested does not exist.</p>
    <RouterLink to="/">Return home</RouterLink>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>
`,
    'src/app/router.ts': `import { createRouter, createWebHistory } from 'vue-router';
import HomePage from './pages/HomePage.vue';
import NotFoundPage from './pages/NotFoundPage.vue';

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
      component: NotFoundPage,
    },
  ],
});
`,
    'src/vue.d.ts': `declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent;
  export default component;
}
`,
    'src/app/server.ts': `import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

const frontendRoot = resolve(process.cwd(), 'build', 'client');
const frontendIndex = join(frontendRoot, 'index.html');
const frontendAvailable = existsSync(frontendIndex);

function requestPath(context: { req: { url: string } }): { pathname: string; unsafe: boolean } {
  const rawPathname = new URL(context.req.url).pathname;
  try {
    const pathname = decodeURIComponent(rawPathname);
    const segments = pathname.split('/');
    return {
      pathname,
      unsafe:
        pathname.includes(String.fromCharCode(0)) ||
        pathname.includes(String.fromCharCode(92)) ||
        pathname.includes('//') ||
        segments.includes('.') ||
        segments.includes('..'),
    };
  } catch {
    return { pathname: rawPathname, unsafe: true };
  }
}

function isReservedPath(pathname: string): boolean {
  return ['/api', '/health', '/ready'].some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

function isStaticRequest(pathname: string): boolean {
  if (pathname === '/assets' || pathname.startsWith('/assets/')) return true;
  const filename = pathname.slice(pathname.lastIndexOf('/') + 1);
  return filename.includes('.');
}

function cacheControl(pathname: string): string {
  if (pathname === '/' || pathname === '/index.html') return 'no-cache';
  if (pathname === '/assets' || pathname.startsWith('/assets/')) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=3600';
}

const staticHandler = frontendAvailable ? serveStatic({ root: frontendRoot }) : undefined;
const spaHandler = frontendAvailable ? serveStatic({ root: frontendRoot, path: 'index.html' }) : undefined;

export const app = new Hono();

if (staticHandler) {
  app.use('*', async (context, next) => {
    const requested = requestPath(context);
    if (requested.unsafe) {
      context.header('Cache-Control', 'no-store');
      return context.notFound();
    }
    if (isReservedPath(requested.pathname)) return next();
    context.header('Cache-Control', cacheControl(requested.pathname));
    return staticHandler(context, next);
  });
}

app.get('*', async (context, next) => {
  const requested = requestPath(context);
  if (requested.unsafe || isReservedPath(requested.pathname) || isStaticRequest(requested.pathname)) {
    context.header('Cache-Control', 'no-store');
    return context.notFound();
  }
  if (!spaHandler) {
    return context.text('Production frontend build is unavailable. Run npm run build before npm start.', 503);
  }
  context.header('Cache-Control', 'no-cache');
  return spaHandler(context, next);
});
`,
    'src/server.ts': `import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { app } from './app/server';
import { migrate } from './shared/database';

const port = Number(process.env.PORT ?? 5555);
const isProduction = process.env.NODE_ENV === 'production';
const appUrl = process.env.APP_URL?.trim() || 'http://localhost:' + String(port);

if (isProduction && !process.env.APP_URL?.trim()) {
  throw new Error('APP_URL is required in production');
}
if (isProduction && !existsSync(join(process.cwd(), 'build', 'client', 'index.html'))) {
  throw new Error('Production frontend build is missing. Run npm run build before npm start.');
}
try {
  migrate();
} catch (error) {
  process.stderr.write('Database migration failed: ' + (error instanceof Error ? error.message : String(error)) + '\\n');
  process.exit(1);
}
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, () => {
  process.stdout.write('Browser/API: ' + appUrl + '\\n');
});
`,
    'tests/health.test.ts': `import { describe, expect, it } from 'vitest';
import { app } from '../src/app/server';

describe('application health composition', () => {
  it('mounts the Health Feature at /health', async () => {
    const response = await app.request('/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });
});
`,
  };
}

export function newProject(name: string, root = process.cwd()): NewProjectResult {
  if (!featureNameIsValid(name)) {
    return {
      ok: false,
      error: {
        kind: 'invalid-name',
        message: `Invalid project name "${name}". Use lowercase letters, numbers, and single hyphens; start with a letter.`,
      },
    };
  }

  const directory = path.resolve(root, name);
  if (directory === path.resolve(root)) {
    return {
      ok: false,
      error: {
        kind: 'invalid-name',
        message: `Invalid project name "${name}". A project name is required.`,
      },
    };
  }

  if (path.dirname(directory) !== path.resolve(root)) {
    return {
      ok: false,
      error: {
        kind: 'invalid-name',
        message: `Invalid project name "${name}". The target must stay under the current directory.`,
      },
    };
  }

  try {
    const files = projectFiles(name, creatingCliVersion());
    if (existsSync(directory)) {
      return {
        ok: false,
        error: {
          kind: 'duplicate',
          message: `Project "${name}" already exists at ${directory}; nothing was overwritten.`,
        },
      };
    }

    const temporaryDirectory = mkdtempSync(path.join(path.dirname(directory), '.nara-new-'));
    try {
      for (const [file, content] of Object.entries(files)) {
        const filePath = path.join(temporaryDirectory, file);
        const parentDirectory = path.dirname(filePath);
        if (parentDirectory !== temporaryDirectory) {
          mkdirSync(parentDirectory, { recursive: true });
        }
        writeFileSync(filePath, content, { encoding: 'utf8', flag: 'wx' });
      }

      const healthInstallation = installOfficialFeature('health', temporaryDirectory);
      if (!healthInstallation.ok) {
        throw new Error(healthInstallation.error.message);
      }
      renameSync(temporaryDirectory, directory);

      const generatedFiles = Object.keys(files).map((file) => path.join(directory, file));
      const rebase = (file: string): string => path.join(directory, path.relative(temporaryDirectory, file));
      const installedHealthFiles = healthInstallation.feature.files.map(rebase);
      const installedBindingFiles = healthInstallation.feature.bindings.map(rebase);
      return {
        ok: true,
        project: {
          name,
          directory,
          files: [...generatedFiles, ...installedHealthFiles, ...installedBindingFiles],
        },
      };
    } catch (error) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: 'filesystem',
        message: `Could not create project "${name}": ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}
