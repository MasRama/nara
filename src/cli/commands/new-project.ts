import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { featureNameIsValid } from '../feature-name';

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

function projectFiles(name: string): Record<string, string> {
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
          check: 'npm run typecheck && npm run typecheck:frontend && npm test',
        },
        dependencies: {
          '@hono/node-server': '^2.1.1',
          hono: '^4.13.5',
          vue: '^3.5.42',
        },
        devDependencies: {
          '@types/node': '^22.20.1',
          '@vitejs/plugin-vue': '^6.0.8',
          jsdom: '^30.0.1',
          tsx: '^4.19.2',
          typescript: '^5.6.3',
          vite: '^8.2.1',
          vitest: '^4.1.10',
          'vue-tsc': '^3.3.11',
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
      port: vitePort,
      strictPort: true,
      proxy: {
        '/api': { target: serverOrigin },
        '/health': { target: serverOrigin },
        '/ready': { target: serverOrigin },
      },
    },
    build: {
      outDir: '../dist',
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

const isWindows = process.platform === 'win32';
const children: ChildProcess[] = [];
let shuttingDown = false;
let shutdownPromise: Promise<void> | undefined;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function start(command: string, args: string[], label: string): ChildProcess {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  children.push(child);

  child.once('error', (error) => {
    if (shuttingDown) return;
    process.stderr.write('[' + label + '] failed: ' + error.message + '\\n');
    void shutdown(1);
  });
  child.once('exit', (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? 'signal ' + signal : 'code ' + String(code ?? 'unknown');
    process.stderr.write('[' + label + '] exited unexpectedly (' + reason + ')\\n');
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
- Run npm run dev for the full-stack development session; it starts Vue/Vite and Hono together.
- During development, Vite proxies /api, /health, and /ready to Hono.
- Business capabilities belong under src/features/<feature>.
- Each Feature exposes behavior through its index.ts public boundary.
- Application-wide composition belongs under src/app/.
- Feature-specific browser code belongs under that Feature's web/ directory.
- Keep server code separate from browser code; do not add SSR, a second framework, or custom RPC.
- Run npm run check before handing off changes.

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

createApp(App).mount('#app');
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
    'src/app/App.vue': `<template>
  <main>
    <h1>Welcome to Nara v3</h1>
    <p>This Vue application is composed by feature.</p>
  </main>
</template>
`,
    'src/app/server.ts': `import { Hono } from 'hono';
import { healthRoutes } from '../features/health';

export const app = new Hono();
app.route('/health', healthRoutes);
`,
    'src/server.ts': `import { serve } from '@hono/node-server';
import { app } from './app/server';

const port = Number(process.env.PORT ?? 5555);

serve({ fetch: app.fetch, port }, (info) => {
  process.stdout.write(\`Nara server listening on http://localhost:\${info.port}\\n\`);
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
    const files = projectFiles(name);
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
