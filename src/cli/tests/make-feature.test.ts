import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { makeFeature } from '../commands/make-feature';
import { runCli, type CliIO } from '../router';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-feature-'));
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

describe('make feature', () => {
  it('creates the minimal canonical feature files in a fixture project', () => {
    const fixture = createFixture();

    const result = makeFeature('billing', fixture);

    expect(result.ok).toBe(true);
    expect(readFileSync(path.join(fixture, 'src/features/billing/index.ts'), 'utf8')).toContain(
      "export { featureName } from './contract';",
    );
    expect(readFileSync(path.join(fixture, 'src/features/billing/contract.ts'), 'utf8')).toContain(
      "export const featureName = 'billing' as const;",
    );
  });

  it('rejects unsafe names with a useful diagnostic', () => {
    const fixture = createFixture();

    const result = makeFeature('../billing', fixture);

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'invalid-name' },
    });
    if (result.ok) {
      throw new Error('Expected unsafe feature name to be rejected');
    }
    expect(result.error.message).toContain('Invalid feature name');
  });

  it('refuses duplicate features without changing existing files', () => {
    const fixture = createFixture();
    const featureDirectory = path.join(fixture, 'src/features/billing');
    mkdirSync(featureDirectory, { recursive: true });
    writeFileSync(path.join(featureDirectory, 'index.ts'), 'existing\n');
    const io = createIO();

    const result = runCli(['make', 'feature', 'billing'], io, { cwd: fixture });

    expect(result.exitCode).toBe(73);
    expect(io.errors.join('')).toContain('nothing was overwritten');
    expect(readFileSync(path.join(featureDirectory, 'index.ts'), 'utf8')).toBe('existing\n');
  });
});
