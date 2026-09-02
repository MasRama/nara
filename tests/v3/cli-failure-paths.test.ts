import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../../src/cli/router';
import { parseEnv } from '../../src/shared/config';

const fixtures: string[] = [];

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-cli-failure-'));
  fixtures.push(fixture);
  return fixture;
}

function createIO() {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    output,
    errors,
    stdout: (message: string) => output.push(message),
    stderr: (message: string) => errors.push(message),
  };
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

describe('CLI failure paths', () => {
  it('reports a missing project without a stack trace', () => {
    const io = createIO();
    const result = runCli(['inspect', 'billing'], io, { cwd: createFixture() });

    expect(result.exitCode).toBe(1);
    expect(io.errors.join('')).toContain('Unknown feature "billing"');
    expect(io.errors.join('')).not.toContain('at ');
  });

  it('reports malformed configuration with the invalid field', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow('APP_URL: required in production');
    expect(() => parseEnv({ PORT: 'not-a-port' })).toThrow(/PORT/);
  });

  it('rejects invalid feature names with usage guidance', () => {
    const io = createIO();
    const result = runCli(['make', 'feature', 'Billing'], io, { cwd: createFixture() });

    expect(result.exitCode).toBe(64);
    expect(io.errors.join('')).toContain('Invalid feature name');
  });

  it('refuses duplicate features without changing source', () => {
    const root = createFixture();
    const first = runCli(['make', 'feature', 'billing'], createIO(), { cwd: root });
    const io = createIO();
    const result = runCli(['make', 'feature', 'billing'], io, { cwd: root });

    expect(first.exitCode).toBe(0);
    expect(result.exitCode).toBe(73);
    expect(io.errors.join('')).toContain('nothing was overwritten');
  });

  it('reports unknown commands with a usage error', () => {
    const io = createIO();
    const result = runCli(['unknown-command'], io);

    expect(result.exitCode).toBe(64);
    expect(io.errors.join('')).toContain('Unknown command: unknown-command');
  });

  it('reports filesystem failures for an unwritable target', () => {
    const parent = createFixture();
    const root = path.join(parent, 'not-a-directory');
    writeFileSync(root, 'target is a file\n');
    const io = createIO();
    const result = runCli(['make', 'feature', 'billing'], io, { cwd: root });

    expect(result.exitCode).toBe(73);
    expect(io.errors.join('')).toContain('Could not create feature "billing"');
  });

  it('renders complete diagnostics for architecture violations', () => {
    const io = createIO();
    const result = runCli(['doctor'], io, {
      cwd: path.resolve(__dirname, '../fixtures/architecture/invalid-internal-import'),
    });
    const output = io.output.join('');

    expect(result.exitCode).toBe(1);
    expect(output).toContain('[CROSS_FEATURE_INTERNAL_IMPORT]');
    expect(output).toContain('file: src/features/billing/server/routes.ts');
    expect(output).toContain('relationship: billing -> users');
    expect(output).toContain('reason: Features may communicate only through the target feature public index.');
    expect(output).toContain('fix: Import the public interface from "@/features/users" instead of "../../users/server/repository".');
    expect(output).not.toContain('at ');
  });
});
