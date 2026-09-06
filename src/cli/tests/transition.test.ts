import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli, type CliIO } from '../router';
import { installOfficialFeature } from '../composition/install-feature';
import type { TransitionReceipt } from '../evolution/transition';

const fixtures: string[] = [];
const previousSkip = process.env.NARA_TRANSITION_SKIP_EXEC;

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
  if (previousSkip === undefined) delete process.env.NARA_TRANSITION_SKIP_EXEC;
  else process.env.NARA_TRANSITION_SKIP_EXEC = previousSkip;
});

function createIO(): CliIO & { output: string[]; errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    output,
    errors,
    stdout: (message: string) => {
      output.push(message);
    },
    stderr: (message: string) => {
      errors.push(message);
    },
  };
}

function installHealth(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-transition-cli-'));
  fixtures.push(fixture);
  mkdirSync(path.join(fixture, 'src', 'app'), { recursive: true });
  writeFileSync(path.join(fixture, 'src', 'app', 'server.ts'), `import { Hono } from 'hono';\n\nexport const app = new Hono();\n`);
  const result = installOfficialFeature('health', fixture);
  expect(result.ok).toBe(true);
  return fixture;
}

function installHealthWithLocalChange(): string {
  const fixture = installHealth();
  writeFileSync(path.join(fixture, 'src', 'features', 'health', 'local-notes.md'), '# Local customization\n');
  return fixture;
}

function parseReceipt(io: { output: string[] }): TransitionReceipt {
  const receipt = JSON.parse(io.output.join('')) as TransitionReceipt;
  expect(receipt.schemaVersion).toBe(2);
  return receipt;
}

describe('evolve transition CLI', () => {
  it('emits a stable machine-readable receipt and distinguishes plan from accept', () => {
    process.env.NARA_TRANSITION_SKIP_EXEC = '1';
    const fixture = installHealthWithLocalChange();
    const io = createIO();
    const planned = runCli(['evolve', 'health', '--transition', '--json'], io, { cwd: fixture });
    expect(planned.exitCode).toBe(1);
    const receipt = parseReceipt(io);
    expect(receipt.feature).toBe('health');
    expect(typeof receipt.transitionId).toBe('string');
    expect(typeof receipt.candidateDigest).toBe('string');
    expect(typeof receipt.baseDigest).toBe('string');
    expect(typeof receipt.incomingDigest).toBe('string');
    expect(Array.isArray(receipt.obligations)).toBe(true);
    expect(Array.isArray(receipt.evidence)).toBe(true);
    expect(['VERIFIED', 'BLOCKED', 'UNVERIFIED']).toContain(receipt.outcome);
    expect(Array.isArray(receipt.limitations)).toBe(true);
    expect(typeof receipt.stale).toBe('boolean');
    expect(receipt.acceptance.state).toBe('unaccepted');
    const kinds = receipt.evidence.map((item) => item.kind).sort();
    for (const kind of ['source-reconciliation', 'architecture-diff', 'doctor', 'typecheck', 'app-tests', 'migration-fresh', 'migration-history']) {
      expect(kinds).toContain(kind);
    }
    expect(receipt.outcome).toBe('UNVERIFIED');

    const acceptIO = createIO();
    const accepted = runCli(['evolve', 'health', '--accept', '--json'], acceptIO, { cwd: fixture });
    expect(accepted.exitCode).toBe(1);
    expect(acceptIO.output.join('')).toContain('not-verified');
  });

  it('renders the scoped outcome vocabulary for humans', () => {
    process.env.NARA_TRANSITION_SKIP_EXEC = '1';
    const fixture = installHealthWithLocalChange();
    const io = createIO();
    const planned = runCli(['evolve', 'health', '--transition'], io, { cwd: fixture });
    expect(planned.exitCode).toBe(1);
    const human = io.output.join('');
    expect(human).toContain('UNVERIFIED');
    expect(human).toContain('VERIFIED means verified against the named evidence and scope');
    expect(human).not.toContain('Safe to apply');
  });

  it('reports an identical upstream as VERIFIED with nothing to adopt', () => {
    process.env.NARA_TRANSITION_SKIP_EXEC = '1';
    const fixture = installHealth();
    const io = createIO();
    const planned = runCli(['evolve', 'health', '--verify', '--json'], io, { cwd: fixture });
    expect(planned.exitCode).toBe(0);
    expect(parseReceipt(io).outcome).toBe('VERIFIED');
    expect(readFileSync(path.join(fixture, '.nara', 'transitions', 'health', 'current.json'), 'utf8')).toContain('"VERIFIED"');
  });
});
