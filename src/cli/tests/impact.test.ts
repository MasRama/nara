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
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-impact-'));
  fixtures.push(fixture);
  return fixture;
}

function writeFeature(fixture: string, name: string, source: string): void {
  const filePath = path.join(fixture, 'src/features', name, 'index.ts');
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, source);
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

describe('impact command', () => {
  it('shows direct and transitive dependents with bounded scope', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', 'export {};\n');
    writeFeature(fixture, 'billing', "import '@/features/users';\n");
    writeFeature(fixture, 'reports', "import '@/features/billing';\n");
    const io = createIO();

    const result = runCli(['impact', 'users'], io, { cwd: fixture });
    const output = io.output.join('');

    expect(result.exitCode).toBe(0);
    expect(output).toContain('Direct dependents:\n- billing');
    expect(output).toContain('Transitive dependents:\n- reports');
    expect(output).toContain('Scope: feature dependency graph');
    expect(output).toContain('not semantic impact');
  });

  it('emits the same feature graph facts as JSON', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', 'export {};\n');
    writeFeature(fixture, 'billing', "import '@/features/users';\n");
    const io = createIO();

    const result = runCli(['impact', 'users', '--json'], io, { cwd: fixture });
    const payload: unknown = JSON.parse(io.output.join(''));

    expect(result.exitCode).toBe(0);
    expect(payload).toMatchObject({
      name: 'users',
      directDependents: ['billing'],
      transitiveDependents: [],
      scope: 'feature dependency graph',
    });
    expect(io.errors).toHaveLength(0);
  });

  it('reports unknown features without a stack trace', () => {
    const fixture = createFixture();
    const io = createIO();

    const result = runCli(['impact', 'users'], io, { cwd: fixture });

    expect(result.exitCode).toBe(1);
    expect(io.errors.join('')).toContain('Unknown feature "users"');
    expect(io.errors.join('')).not.toContain('at ');
  });
});
