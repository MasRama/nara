import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-add-'));
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

describe('add command', () => {
  it('installs open feature source and leaves a healthy architecture', () => {
    const fixture = createFixture();
    const io = createIO();

    const result = runCli(['add', 'health'], io, { cwd: fixture });
    const doctorIO = createIO();
    const doctorResult = runCli(['doctor'], doctorIO, { cwd: fixture });

    expect(result.exitCode).toBe(0);
    expect(io.output.join('')).toContain('src/features/health/index.ts');
    expect(io.output.join('')).toContain('src/features/health/tests/health.test.ts');
    expect(doctorResult.exitCode).toBe(0);
    expect(doctorIO.output.join('')).toBe('Architecture looks healthy.\n');
  });

  it('installs a materially different pure TypeScript feature through the same mechanism', () => {
    const fixture = createFixture();
    const io = createIO();

    const result = runCli(['add', 'audit'], io, { cwd: fixture });

    expect(result.exitCode).toBe(0);
    expect(io.output.join('')).toContain('src/features/audit/contract.ts');
    expect(io.output.join('')).toContain('src/features/audit/index.ts');
    expect(io.output.join('')).toContain('src/features/audit/tests/audit.test.ts');
  });

  it('refuses a collision without merging or overwriting local source', () => {
    const fixture = createFixture();
    const target = path.join(fixture, 'src/features/health');
    mkdirSync(target, { recursive: true });
    writeFileSync(path.join(target, 'index.ts'), 'local source\n');
    const io = createIO();

    const result = runCli(['add', 'health'], io, { cwd: fixture });

    expect(result.exitCode).toBe(73);
    expect(io.errors.join('')).toContain('nothing was overwritten');
    expect(readFileSync(path.join(target, 'index.ts'), 'utf8')).toBe('local source\n');
  });

  it('reports unknown official features as usage failures', () => {
    const fixture = createFixture();
    const io = createIO();

    const result = runCli(['add', 'billing'], io, { cwd: fixture });

    expect(result.exitCode).toBe(64);
    expect(io.errors.join('')).toContain('No official feature package named "billing"');
  });
});
