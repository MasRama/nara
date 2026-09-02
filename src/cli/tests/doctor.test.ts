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
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-doctor-'));
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

describe('doctor command', () => {
  it('confirms a valid feature project', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'billing', { 'index.ts': 'export {};\n' });
    const io = createIO();

    const result = runCli(['doctor'], io, { cwd: fixture });

    expect(result.exitCode).toBe(0);
    expect(io.output.join('')).toBe('Architecture looks healthy.\n');
    expect(io.errors).toHaveLength(0);
  });

  it('emits only the shared analysis as machine-readable JSON', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', {
      'index.ts': 'export {};\n',
      'server/repository.ts': 'export {};\n',
    });
    writeFeature(fixture, 'billing', {
      'index.ts': 'export {};\n',
      'server/service.ts': "import '../../users/server/repository';\n",
    });
    const io = createIO();

    const result = runCli(['doctor', '--json'], io, { cwd: fixture });
    const output = io.output.join('');
    const payload: unknown = JSON.parse(output);

    expect(result.exitCode).toBe(1);
    expect(payload).toMatchObject({
      healthy: false,
      issues: [{ code: 'CROSS_FEATURE_INTERNAL_IMPORT' }],
    });
    expect(output).not.toContain('Found ');
    expect(io.errors).toHaveLength(0);
  });

  it('reports every invalid relationship without a stack trace', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', {
      'index.ts': 'export {};\n',
      'server/repository.ts': 'export {};\n',
    });
    writeFeature(fixture, 'billing', {
      'index.ts': 'export {};\n',
      'server/service.ts': "import '../../users/server/repository';\n",
    });
    const io = createIO();

    const result = runCli(['doctor'], io, { cwd: fixture });
    const output = io.output.join('');

    expect(result.exitCode).toBe(1);
    expect(output).toContain('[CROSS_FEATURE_INTERNAL_IMPORT]');
    expect(output).toContain('src/features/billing/server/service.ts');
    expect(output).toContain('billing -> users');
    expect(output).toContain('@/features/users');
    expect(output).not.toContain('at ');
    expect(io.errors).toHaveLength(0);
  });
});
