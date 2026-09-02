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
          build: 'tsc',
          start: 'node build/server.js',
          dev: 'tsx src/server.ts',
          lint: 'tsc --noEmit',
          test: 'vitest run',
          check: 'npm run lint && npm test',
        },
        dependencies: {
          '@hono/node-server': '^2.1.1',
          hono: '^4.13.5',
        },
        devDependencies: {
          '@types/node': '^22.20.1',
          tsx: '^4.19.2',
          typescript: '^5.6.3',
          vitest: '^4.1.10',
        },
      },
      null,
      2,
    )}\n`,
    'tsconfig.json': `${JSON.stringify(
      {
        compilerOptions: {
          target: 'es2022',
          module: 'commonjs',
          moduleResolution: 'node',
          lib: ['es2022'],
          outDir: './build',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
        include: ['src/**/*.ts'],
      },
      null,
      2,
    )}\n`,
    'vitest.config.ts': `import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({\n  test: {\n    environment: 'node',\n    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],\n  },\n});\n`,
    '.gitignore': 'node_modules/\nbuild/\n.env\n',
    'AGENTS.md': `# ${name}\n\nThis is a Nara v3 application.\n\n- Keep business capabilities under src/features/<feature>.\n- Import feature behavior through each feature's index.ts.\n- Keep server-only code under server/ and validate external input at runtime.\n- Run npm run check before handing off changes.\n`,
    'src/app.ts': `import { Hono } from 'hono';\nimport { healthRoutes } from './features/health';\n\nexport const app = new Hono();\napp.route('/health', healthRoutes);\n`,
    'src/server.ts': `import { serve } from '@hono/node-server';\nimport { app } from './app';\n\nconst port = Number(process.env.PORT ?? 5555);\nserve({ fetch: app.fetch, port });\n`,
    'src/features/health/index.ts': `import { Hono } from 'hono';\n\nexport const healthRoutes = new Hono().get('/', (context) =>\n  context.json({ status: 'ok' as const }),\n);\n`,
    'tests/health.test.ts': `import { describe, expect, it } from 'vitest';\nimport { app } from '../src/app';\n\ndescribe('health feature', () => {\n  it('reports a healthy application', async () => {\n    const response = await app.request('/health');\n\n    expect(response.status).toBe(200);\n    await expect(response.json()).resolves.toEqual({ status: 'ok' });\n  });\n});\n`,
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
