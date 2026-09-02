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
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-context-'));
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

describe('context command', () => {
  it('prints only bounded coding context for a feature', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'auth', { 'index.ts': 'export const login = true;\n' });
    writeFeature(fixture, 'users', {
      'index.ts': "import { login } from '@/features/auth';\nexport { login };\n",
      'contract.ts': 'export type UserProfile = { id: string };\n',
      'server/routes.ts': 'export {};\n',
      'web/client.ts': 'export {};\n',
      'tests/routes.test.ts': 'export {};\n',
    });
    const io = createIO();

    const result = runCli(['context', 'users'], io, { cwd: fixture });
    const output = io.output.join('');

    expect(result.exitCode).toBe(0);
    expect(output).toContain('Feature context: users');
    expect(output).toContain('Work in: src/features/users');
    expect(output).toContain('Public boundary: src/features/users/index.ts');
    expect(output).toContain('Public dependencies:\n- auth -> @/features/auth');
    expect(output).toContain('Contracts:\n- UserProfile');
    expect(output).toContain('Server surfaces:\n- server/routes.ts');
    expect(output).toContain('Web surfaces:\n- web/client.ts');
    expect(output).toContain('Test surfaces:\n- tests/routes.test.ts');
    expect(output).not.toContain('import { login }');
    expect(io.errors).toHaveLength(0);
  });

  it('emits the bounded context as machine-readable JSON', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', {
      'index.ts': 'export const profile = true;\n',
      'contract.ts': 'export type UserProfile = { id: string };\n',
    });
    const io = createIO();

    const result = runCli(['context', 'users', '--json'], io, { cwd: fixture });
    const output = io.output.join('');
    const payload: unknown = JSON.parse(output);

    expect(result.exitCode).toBe(0);
    expect(payload).toMatchObject({
      name: 'users',
      workDirectory: 'src/features/users',
      publicBoundary: 'src/features/users/index.ts',
      contracts: ['UserProfile'],
    });
    expect(output).not.toContain('Feature context:');
    expect(io.errors).toHaveLength(0);
  });
});
