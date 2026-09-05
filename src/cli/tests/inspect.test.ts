import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli, type CliIO } from '../router';

const fixtures: string[] = [];
afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-inspect-'));
  fixtures.push(fixture);
  return fixture;
}

function writeFeature(fixture: string, name: string, files: Record<string, string>): void {
  const directory = path.join(fixture, 'src/features', name);
  for (const [file, content] of Object.entries(files)) {
    const filePath = path.join(directory, file);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
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

describe('inspect command', () => {
  it('prints bounded facts for one feature', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'auth', {
      'index.ts': 'export const login = true;\n',
    });
    writeFeature(fixture, 'users', {
      'index.ts': "import { login } from '@/features/auth';\nexport { login };\n",
      'contract.ts': 'export type UserProfile = { id: string };\n',
      'server/routes.ts': 'export {};\n',
      'web/client.ts': 'export {};\n',
      'tests/routes.test.ts': 'export {};\n',
    });
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
    const io = createIO();

    const result = runCli(['inspect', 'users'], io, { cwd: fixture });
    const output = io.output.join('');

    expect(result.exitCode).toBe(0);
    expect(output).toContain('Feature: users');
    expect(output).toContain('Path: src/features/users');
    expect(output).toContain('Dependencies:\n- auth');
    expect(output).toContain('Dependents:\n- none');
    expect(output).toContain('Server:\n- server/routes.ts');
    expect(output).toContain('Web:\n- web/client.ts');
    expect(output).toContain('Contracts:\n- UserProfile');
    expect(output).toContain('Tests:\n- tests/routes.test.ts');
    expect(output).toContain('Application integration:');
    expect(output).toContain('Server routes:\n- /api/users via userRoutes');
    expect(output).toContain('Web routes:\n- /users via UsersPage');
    expect(output).toContain('Application consumers:\n- src/app/router.ts: web: UsersPage');
    expect(io.errors).toHaveLength(0);
  });

  it('emits the same facts as stable JSON', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', {
      'index.ts': 'export const profile = true;\n',
      'contract.ts': 'export type UserProfile = { id: string };\n',
    });
    const io = createIO();

    const result = runCli(['inspect', 'users', '--json'], io, { cwd: fixture });
    const output = io.output.join('');
    const payload: unknown = JSON.parse(output);

    expect(result.exitCode).toBe(0);
    expect(payload).toMatchObject({
      name: 'users',
      path: 'src/features/users',
      publicExports: ['profile'],
      contracts: ['UserProfile'],
      integrations: {
        applicationImports: [],
        serverRoutes: [],
        webRoutes: [],
      },
    });
    expect(output).not.toContain('Feature:');
    expect(io.errors).toHaveLength(0);
  });
  it('reports an unknown feature without a stack trace', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'auth', { 'index.ts': 'export {};\n' });
    const io = createIO();

    const result = runCli(['inspect', 'billing'], io, { cwd: fixture });

    expect(result.exitCode).toBe(1);
    expect(io.errors.join('')).toContain('Unknown feature "billing"');
    expect(io.errors.join('')).not.toContain('at ');
  });
});
