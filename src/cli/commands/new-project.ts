import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { featureNameIsValid } from '../feature-name';
import { readNaraCliVersion } from '../package-root';

function creatingCliVersion(): string {
  return readNaraCliVersion();
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
    'package.json': `${JSON.stringify(
      {
        name,
        version: '0.1.0',
        private: true,
        engines: { node: '>=22.0.0' },
        scripts: {
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
        },
        dependencies: {
          '@hono/node-server': '^2.1.1',
          hono: '^4.13.5',
          'vue': '^3.5.42',
          'vue-router': '^5.3.1',
        },
        devDependencies: {
          '@nara-web/cli': cliVersion,
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
          lib: ['es2022'],
          skipLibCheck: true,
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const serverPort = Number(process.env.PORT || env.PORT || 5555);
  const vitePort = Number(process.env.VITE_PORT || env.VITE_PORT || 5173);
  const serverOrigin = \`http://127.0.0.1:\${serverPort}\`;

  return {
    root: 'resources',
    plugins: [vue()],
    server: {
      // Explicit loopback binding: the dev test dials 127.0.0.1 and the
      // Hono proxy target below uses 127.0.0.1, so never rely on implicit
      // localhost resolution (IPv4 vs IPv6 varies across machines/CI).
      host: '127.0.0.1',
      port: vitePort,
      strictPort: true,
      proxy: {
        '/api': { target: serverOrigin },
        '/health': { target: serverOrigin },
        '/ready': { target: serverOrigin },
      },
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
    '.gitignore': 'node_modules/\nbuild/\ndist/\n.env\n',
    'scripts/dev.ts': `import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const isWindows = process.platform === 'win32';
const children: ChildProcess[] = [];
let shuttingDown = false;
let shutdownPromise: Promise<void> | undefined;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function resolveBin(name: string): string {
  // Prefer the project's own install so dev never depends on ambient PATH.
  // Falls back to the bare name (global install) with an actionable error
  // below when neither resolves.
  const binary = isWindows ? name + '.cmd' : name;
  const local = path.join(process.cwd(), 'node_modules', '.bin', binary);
  if (existsSync(local)) return local;
  return name;
}

function start(command: string, args: string[], label: string): ChildProcess {
  const resolved = resolveBin(command);
  const child = spawn(resolved, args, {
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  children.push(child);

  child.once('error', (error) => {
    if (shuttingDown) return;
    process.stderr.write('[' + label + '] failed to start ' + resolved + ' ' + args.join(' ') + ': ' + error.message + '\\n');
    process.stderr.write('[' + label + '] run npm install in this project, then retry npm run dev.\\n');
    void shutdown(1);
  });
  child.once('exit', (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? 'signal ' + signal : 'code ' + String(code ?? 'unknown');
    process.stderr.write('[' + label + '] exited unexpectedly (' + reason + '). Both Vite and Hono must stay up for npm run dev.\\n');
    process.stderr.write('[' + label + '] see the [' + label + '] output above for the underlying failure.\\n');
    void shutdown(signal === 'SIGINT' || signal === 'SIGTERM' ? 0 : 1);
  });

  return child;
}

function shutdown(exitCode: number): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  shuttingDown = true;
  shutdownPromise = (async () => {
    for (const child of children) {
      if (child.exitCode === null) child.kill('SIGTERM');
    }
    await delay(1_000);
    for (const child of children) {
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    process.exitCode = exitCode;
  })();
  return shutdownPromise;
}

process.once('SIGINT', () => {
  void shutdown(0);
});
process.once('SIGTERM', () => {
  void shutdown(0);
});

start('vite', [], 'vite');
start('tsx', ['watch', 'src/server.ts'], 'hono');
`,
    'AGENTS.md': `# ${name}

This is a minimal Nara v3 application.

- Runtime: TypeScript, Node.js, Hono, and @hono/node-server.
- Browser stack: Vue 3 + Vite + TypeScript.
- Architecture tooling: the local Nara CLI is a pinned devDependency (npm run architecture:doctor runs nara doctor from this project).
- Run npm run dev for the full-stack development session; it starts Vue/Vite and Hono together.
- During development, Vite proxies /api, /health, and /ready to Hono.
- Business capabilities belong under src/features/<feature>.
- Each Feature exposes behavior through its index.ts public boundary.
- Application-wide Vue composition belongs under src/app/; src/app/router.ts owns browser routes and src/app/pages holds app-owned pages.
- Feature-specific browser code belongs under that Feature's web/ directory, including Feature-owned pages.
- Keep server code separate from browser code; do not add SSR, a second framework, or custom RPC.
- Inspect architecture with the local CLI: npx nara context <feature> --json, npx nara impact <feature> --json, npx nara doctor --json.
- Run npm run check before handing off changes (it includes the architecture check).

The development ports default to Vite 5173 and Hono 5555; set VITE_PORT and PORT to override them.
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
import { healthRoutes } from '../features/health';

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
app.route('/health', healthRoutes);

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

const port = Number(process.env.PORT ?? 5555);
const vitePort = Number(process.env.VITE_PORT ?? 5173);
const isProduction = process.env.NODE_ENV === 'production';
const appUrl = process.env.APP_URL?.trim() || 'http://localhost:' + (isProduction ? String(port) : String(vitePort));

if (isProduction && !process.env.APP_URL?.trim()) {
  throw new Error('APP_URL is required in production');
}
if (isProduction && !existsSync(join(process.cwd(), 'build', 'client', 'index.html'))) {
  throw new Error('Production frontend build is missing. Run npm run build before npm start.');
}
serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  const startupMessage = isProduction
    ? 'Browser/API: ' + appUrl
    : 'Browser: ' + appUrl + ' (Vite); Backend implementation: http://127.0.0.1:' + info.port;
  process.stdout.write(startupMessage + '\\n');
});
`,
    'src/features/health/index.ts': `import { Hono } from 'hono';

export const healthRoutes = new Hono().get('/', (context) =>
  context.json({ status: 'ok' as const }),
);
`,
    'src/features/health/tests/health.test.ts': `import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';

describe('health feature', () => {
  it('reports a healthy application', async () => {
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
      renameSync(temporaryDirectory, directory);
    } catch (error) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
      throw error;
    }

    return {
      ok: true,
      project: {
        name,
        directory,
        files: Object.keys(files).map((file) => path.join(directory, file)),
      },
    };
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
