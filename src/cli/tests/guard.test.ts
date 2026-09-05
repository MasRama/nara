import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
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

function createIO(): CliIO & { output: string[]; errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    output,
    errors,
    stdout: (message: string): void => {
      output.push(message);
    },
    stderr: (message: string): void => {
      errors.push(message);
    },
  };
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function initRepo(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nara-guard-cli-'));
  fixtures.push(directory);
  git(directory, 'init');
  git(directory, 'config', 'user.email', 'nara-guard@example.com');
  git(directory, 'config', 'user.name', 'nara guard');
  return directory;
}

function commitAll(cwd: string, message: string): string {
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-m', message);
  return git(cwd, 'rev-parse', 'HEAD');
}

function writeFeature(cwd: string, name: string, files: Record<string, string>): void {
  const directory = path.join(cwd, 'src/features', name);
  for (const [file, content] of Object.entries(files)) {
    const filePath = path.join(directory, file);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
}

function writeFile(cwd: string, relativePath: string, content: string): void {
  const filePath = path.join(cwd, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function writeCrossFeatureViolation(cwd: string): void {
  writeFeature(cwd, 'users', {
    'index.ts': 'export const users = 1;\n',
    'server/repository.ts': 'export const findUserById = 1;\n',
  });
  writeFeature(cwd, 'billing', {
    'index.ts': 'export const billing = 1;\n',
    'server/checkout.ts':
      "import { findUserById } from '@/features/users/server/repository';\nexport const checkout = 1;\n",
  });
}

function runGuard(cwd: string, args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const io = createIO();
  const result = runCli(['guard', ...args], io, { cwd });
  return { exitCode: result.exitCode, stdout: io.output.join(''), stderr: io.errors.join('') };
}

function runGuardJson(cwd: string, args: string[]): { exitCode: number; json: Record<string, unknown> } {
  const outcome = runGuard(cwd, [...args, '--json']);
  return { exitCode: outcome.exitCode, json: JSON.parse(outcome.stdout) as Record<string, unknown> };
}

describe('nara guard', () => {
  it('passes for a clean base and clean target', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'base');

    const outcome = runGuard(repo, ['--base', 'HEAD']);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('Architecture guard passed.');
    expect(outcome.stdout).toContain('No new architecture violations.');
    expect(outcome.stdout).toContain('Baseline issues: 0');
    expect(outcome.stdout).toContain('Resolved: 0');
    expect(outcome.stdout).toContain('Remaining baseline issues: 0');

    const machine = runGuardJson(repo, ['--base', 'HEAD']);
    expect(machine.exitCode).toBe(0);
    expect(machine.json).toMatchObject({
      schemaVersion: 1,
      passed: true,
      base: { kind: 'git-ref', ref: 'HEAD' },
      target: { kind: 'working-tree' },
      regression: {
        baselineIssueCount: 0,
        introducedIssues: [],
        resolvedIssues: [],
        remainingBaselineIssueCount: 0,
      },
    });
  });

  it('passes integration-only changes without treating them as violations', () => {
    const repo = initRepo();
    writeFeature(repo, 'users', { 'index.ts': 'export const userRoutes = 1;\n' });
    writeFile(
      repo,
      'src/app/server.ts',
      `import { Hono } from 'hono';
import { userRoutes } from '../features/users';
const app = new Hono();
app.route('/api/users', userRoutes);
`,
    );
    commitAll(repo, 'clean base');
    writeFile(
      repo,
      'src/app/server.ts',
      `import { Hono } from 'hono';
import { userRoutes } from '../features/users';
const app = new Hono();
app.route('/api/members', userRoutes);
`,
    );

    const machine = runGuardJson(repo, ['--base', 'HEAD']);
    expect(machine.exitCode).toBe(0);
    expect(machine.json).toMatchObject({
      passed: true,
      regression: {
        introducedIssues: [],
      },
      affected: {
        directlyChanged: ['users'],
        downstream: [],
      },
    });
  });

  it('passes when the target inherits the same baseline violations', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    writeFeature(repo, 'billing', { 'contract.ts': 'export type BillingInput = 1;\n' });
    commitAll(repo, 'base with violation');

    const outcome = runGuard(repo, ['--base', 'HEAD']);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('Architecture guard passed.');
    expect(outcome.stdout).toContain('Baseline issues: 1');
    expect(outcome.stdout).toContain('Remaining baseline issues: 1');

    const machine = runGuardJson(repo, ['--base', 'HEAD']);
    expect(machine.exitCode).toBe(0);
    const regression = machine.json.regression as {
      baselineIssueCount: number;
      introducedIssues: unknown[];
      resolvedIssues: unknown[];
      remainingBaselineIssueCount: number;
    };
    expect(regression.baselineIssueCount).toBe(1);
    expect(regression.introducedIssues).toEqual([]);
    expect(regression.resolvedIssues).toEqual([]);
    expect(regression.remainingBaselineIssueCount).toBe(1);
  });

  it('passes and reports a resolved baseline violation', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    writeFeature(repo, 'billing', { 'contract.ts': 'export type BillingInput = 1;\n' });
    commitAll(repo, 'base with violation');
    rmSync(path.join(repo, 'src/features/billing'), { recursive: true, force: true });

    const outcome = runGuard(repo, ['--base', 'HEAD']);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('Architecture guard passed.');
    expect(outcome.stdout).toContain('Baseline issues: 1');
    expect(outcome.stdout).toContain('Resolved: 1');
    expect(outcome.stdout).toContain('Remaining baseline issues: 0');

    const machine = runGuardJson(repo, ['--base', 'HEAD']);
    expect(machine.exitCode).toBe(0);
    const regression = machine.json.regression as {
      resolvedIssues: Array<{ code: string }>;
      introducedIssues: unknown[];
    };
    expect(regression.introducedIssues).toEqual([]);
    expect(regression.resolvedIssues.map((issue) => issue.code)).toContain('INVALID_FEATURE_SHAPE');
  });

  it('fails when uncommitted changes introduce a cross-feature internal import', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'clean base');
    writeCrossFeatureViolation(repo);

    const outcome = runGuard(repo, ['--base', 'HEAD']);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.stdout).toContain('Architecture guard failed.');
    expect(outcome.stdout).toContain('1 new architecture violation introduced.');
    expect(outcome.stdout).toContain('[CROSS_FEATURE_INTERNAL_IMPORT]');
    expect(outcome.stdout).toContain('src/features/billing/server/checkout.ts');
    expect(outcome.stdout).toContain('billing -> users');

    const machine = runGuardJson(repo, ['--base', 'HEAD']);
    expect(machine.exitCode).toBe(1);
    expect(machine.json).toMatchObject({ schemaVersion: 1, passed: false });
    const regression = machine.json.regression as {
      baselineIssueCount: number;
      introducedIssues: Array<{
        code: string;
        file: string;
        relationship: string;
        reason: string;
        suggestion: string;
      }>;
      resolvedIssues: unknown[];
      remainingBaselineIssueCount: number;
    };
    expect(regression.baselineIssueCount).toBe(0);
    expect(regression.introducedIssues).toHaveLength(1);
    expect(regression.introducedIssues[0]).toMatchObject({
      code: 'CROSS_FEATURE_INTERNAL_IMPORT',
      file: 'src/features/billing/server/checkout.ts',
      relationship: 'billing -> users',
    });
    expect(regression.introducedIssues[0].reason).toContain('public index');
    expect(regression.introducedIssues[0].suggestion).toContain('@/features/users');
    expect(regression.resolvedIssues).toEqual([]);
    expect(regression.remainingBaselineIssueCount).toBe(0);
  });

  it('fails when a new malformed feature appears on a clean base', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'clean base');
    mkdirSync(path.join(repo, 'src/features/billing'), { recursive: true });

    const machine = runGuardJson(repo, ['--base', 'HEAD']);
    expect(machine.exitCode).toBe(1);
    const regression = machine.json.regression as {
      introducedIssues: Array<{ code: string }>;
    };
    expect(regression.introducedIssues.map((issue) => issue.code)).toContain('INVALID_FEATURE_SHAPE');
  });

  it('fails only because of the new issue when baseline debt also exists', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    writeFeature(repo, 'legacy', { 'contract.ts': 'export type LegacyInput = 1;\n' });
    commitAll(repo, 'base with debt');
    writeCrossFeatureViolation(repo);

    const machine = runGuardJson(repo, ['--base', 'HEAD']);
    expect(machine.exitCode).toBe(1);
    const regression = machine.json.regression as {
      baselineIssueCount: number;
      introducedIssues: Array<{ code: string }>;
      resolvedIssues: unknown[];
      remainingBaselineIssueCount: number;
    };
    expect(regression.baselineIssueCount).toBe(1);
    expect(regression.introducedIssues).toHaveLength(1);
    expect(regression.introducedIssues[0].code).toBe('CROSS_FEATURE_INTERNAL_IMPORT');
    expect(regression.resolvedIssues).toEqual([]);
    expect(regression.remainingBaselineIssueCount).toBe(1);
  });

  it('fails and reports both the resolved and the introduced issue', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    writeFeature(repo, 'legacy', { 'contract.ts': 'export type LegacyInput = 1;\n' });
    commitAll(repo, 'base with debt');
    rmSync(path.join(repo, 'src/features/legacy'), { recursive: true, force: true });
    writeCrossFeatureViolation(repo);

    const outcome = runGuard(repo, ['--base', 'HEAD']);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.stdout).toContain('Architecture guard failed.');
    expect(outcome.stdout).toContain('Resolved: 1');

    const machine = runGuardJson(repo, ['--base', 'HEAD']);
    expect(machine.exitCode).toBe(1);
    const regression = machine.json.regression as {
      introducedIssues: Array<{ code: string }>;
      resolvedIssues: Array<{ code: string }>;
      remainingBaselineIssueCount: number;
    };
    expect(regression.introducedIssues.map((issue) => issue.code)).toEqual([
      'CROSS_FEATURE_INTERNAL_IMPORT',
    ]);
    expect(regression.resolvedIssues.map((issue) => issue.code)).toEqual(['INVALID_FEATURE_SHAPE']);
    expect(regression.remainingBaselineIssueCount).toBe(0);
  });

  it('ignores unrelated dirty working-tree state in --head mode', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    const first = commitAll(repo, 'first');
    writeFeature(repo, 'billing', { 'index.ts': 'export const billing = 1;\n' });
    const second = commitAll(repo, 'second');
    writeCrossFeatureViolation(repo);

    const before = readFileSync(path.join(repo, 'src/features/billing/server/checkout.ts'), 'utf8');
    const outcome = runGuard(repo, ['--base', first, '--head', second]);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('Architecture guard passed.');
    // Ref-to-ref comparison leaves the dirty working tree alone.
    expect(readFileSync(path.join(repo, 'src/features/billing/server/checkout.ts'), 'utf8')).toBe(before);
    expect(git(repo, 'status', '--porcelain')).not.toBe('');

    const machine = runGuardJson(repo, ['--base', first, '--head', second]);
    expect(machine.exitCode).toBe(0);
    expect(machine.json.target).toMatchObject({ kind: 'git-ref', ref: second });
  });

  it('fails in --head mode when the head ref introduces a violation', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    const first = commitAll(repo, 'clean base');
    writeCrossFeatureViolation(repo);
    const second = commitAll(repo, 'head with violation');

    const machine = runGuardJson(repo, ['--base', first, '--head', second]);
    expect(machine.exitCode).toBe(1);
    expect(machine.json).toMatchObject({ passed: false });
    const regression = machine.json.regression as {
      introducedIssues: Array<{ code: string }>;
    };
    expect(regression.introducedIssues.map((issue) => issue.code)).toContain(
      'CROSS_FEATURE_INTERNAL_IMPORT',
    );
  });

  it('fails clearly for unknown refs and outside a Git repository', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'base');

    const unknownBase = runGuard(repo, ['--base', 'does-not-exist-12345']);
    expect(unknownBase.exitCode).toBe(1);
    expect(unknownBase.stderr).toContain('Unknown Git ref');

    const unknownHead = runGuard(repo, ['--base', 'HEAD', '--head', 'does-not-exist-12345']);
    expect(unknownHead.exitCode).toBe(1);
    expect(unknownHead.stderr).toContain('Unknown Git ref');

    const outside = mkdtempSync(path.join(os.tmpdir(), 'nara-guard-nogit-'));
    fixtures.push(outside);
    writeFeature(outside, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    const nogit = runGuard(outside, ['--base', 'main']);
    expect(nogit.exitCode).toBe(1);
    expect(nogit.stderr).toContain('Not inside a Git repository');
  });

  it('rejects invalid CLI usage with the usage convention', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'base');

    for (const args of [[], ['--head', 'HEAD'], ['--base'], ['--base', 'HEAD', '--bogus']]) {
      const outcome = runGuard(repo, args);
      expect(outcome.exitCode).toBe(64);
      expect(outcome.stderr).toContain('nara guard --base');
    }
  });

  it('emits stable deterministic JSON ordering', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'clean base');
    writeCrossFeatureViolation(repo);
    mkdirSync(path.join(repo, 'src/features/broken'), { recursive: true });

    const first = runGuard(repo, ['--base', 'HEAD', '--json']);
    const second = runGuard(repo, ['--base', 'HEAD', '--json']);
    expect(first.exitCode).toBe(1);
    expect(second.stdout).toBe(first.stdout);
    const json = JSON.parse(first.stdout) as {
      regression: { introducedIssues: Array<{ code: string; file: string; relationship: string }> };
    };
    const keys = json.regression.introducedIssues.map(
      (issue) => `${issue.code}${issue.file}${issue.relationship}`,
    );
    expect([...keys].sort()).toEqual(keys);
  });

  it('does not dump unchanged baseline debt in human output', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    writeFeature(repo, 'billing', { 'contract.ts': 'export type BillingInput = 1;\n' });
    commitAll(repo, 'base with violation');

    const outcome = runGuard(repo, ['--base', 'HEAD']);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('Architecture guard passed.');
    expect(outcome.stdout).not.toContain('INVALID_FEATURE_SHAPE');
    expect(outcome.stdout).not.toContain('file:');
  });

  it('shows the affected feature set on failure without dumping baseline debt', () => {
    const repo = initRepo();
    writeFeature(repo, 'users', { 'index.ts': 'export const users = 1;\n' });
    writeFeature(repo, 'billing', {
      'index.ts': "import '@/features/users';\nexport const billing = 1;\n",
    });
    writeFeature(repo, 'reports', {
      'index.ts': "import '@/features/billing';\nexport const reports = 1;\n",
    });
    commitAll(repo, 'clean layered base');
    writeFeature(repo, 'billing', {
      'index.ts': "import '@/features/users';\nexport const billing = 1;\n",
      'server/checkout.ts':
        "import { findUserById } from '@/features/users/server/repository';\nexport const checkout = 1;\n",
    });
    writeFeature(repo, 'users', {
      'index.ts': 'export const users = 1;\n',
      'server/repository.ts': 'export const findUserById = 1;\n',
    });

    const outcome = runGuard(repo, ['--base', 'HEAD']);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.stdout).toContain('Architecture guard failed.');
    expect(outcome.stdout).toContain('Structural dependency impact:');
    expect(outcome.stdout).toContain('billing');
  });

  it('leaves uncommitted working-tree changes in place', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'clean base');
    writeCrossFeatureViolation(repo);
    const before = readFileSync(path.join(repo, 'src/features/billing/server/checkout.ts'), 'utf8');

    const outcome = runGuard(repo, ['--base', 'HEAD']);
    expect(outcome.exitCode).toBe(1);
    expect(readFileSync(path.join(repo, 'src/features/billing/server/checkout.ts'), 'utf8')).toBe(before);
    expect(git(repo, 'status', '--porcelain')).not.toBe('');
  });

  it('leaves no temporary directories behind on ref failures', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'base');
    expect(git(repo, 'status', '--porcelain')).toBe('');

    // Attribute temp directories to this invocation only: point TMPDIR at a
    // dedicated empty parent so concurrent diff/guard tests in other workers
    // cannot change what this test observes. No production API change.
    const runGuardIsolated = (args: string[]): { exitCode: number; stdout: string; stderr: string } => {
      const isolatedRoot = mkdtempSync(path.join(os.tmpdir(), 'nara-guard-cleanup-'));
      fixtures.push(isolatedRoot);
      const previousTmpdir = process.env.TMPDIR;
      process.env.TMPDIR = isolatedRoot;
      try {
        return runGuard(repo, args);
      } finally {
        if (previousTmpdir === undefined) {
          delete process.env.TMPDIR;
        } else {
          process.env.TMPDIR = previousTmpdir;
        }
      }
    };
    const isolatedLeftovers = (): string[] => {
      const roots = fixtures.filter((entry) => path.basename(entry).startsWith('nara-guard-cleanup-'));
      return roots.flatMap((root) => readdirSync(root));
    };

    const unknownBase = runGuardIsolated(['--base', 'does-not-exist-12345']);
    expect(unknownBase.exitCode).toBe(1);
    expect(unknownBase.stderr).toContain('Unknown Git ref');
    expect(isolatedLeftovers()).toEqual([]);

    // Base materialization already occurred here and must be cleaned when
    // head verification fails.
    const unknownHead = runGuardIsolated(['--base', 'HEAD', '--head', 'does-not-exist-12345']);
    expect(unknownHead.exitCode).toBe(1);
    expect(unknownHead.stderr).toContain('Unknown Git ref');
    expect(isolatedLeftovers()).toEqual([]);

    // Successful materializations clean themselves too.
    const success = runGuardIsolated(['--base', 'HEAD']);
    expect(success.exitCode).toBe(0);
    expect(isolatedLeftovers()).toEqual([]);

    // Worktree and index untouched: no checkout, reset, stash, or clean.
    expect(git(repo, 'status', '--porcelain')).toBe('');
  });

  it('tolerates spaces, unicode, binary, and deleted paths', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    writeFileSync(path.join(repo, 'notes with spaces.txt'), 'plain notes\n');
    writeFileSync(path.join(repo, 'notizen-äöü.txt'), 'unicode notes\n');
    writeFileSync(path.join(repo, 'blob.bin'), Buffer.from([0x00, 0xff, 0x89, 0x50]));
    writeFileSync(path.join(repo, 'doomed.txt'), 'about to be deleted\n');
    commitAll(repo, 'base with awkward paths');
    rmSync(path.join(repo, 'doomed.txt'), { force: true });

    const outcome = runGuard(repo, ['--base', 'HEAD']);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('Architecture guard passed.');

    const machine = runGuardJson(repo, ['--base', 'HEAD']);
    expect(machine.exitCode).toBe(0);
    expect(machine.json).toMatchObject({ passed: true });
  });

  it('orders multiple same-code diagnostics deterministically by file', () => {
    const repo = initRepo();
    writeFeature(repo, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });
    commitAll(repo, 'clean base');
    writeFeature(repo, 'users', {
      'index.ts': 'export const users = 1;\n',
      'server/repository.ts': 'export const findUserById = 1;\n',
    });
    writeFeature(repo, 'billing', {
      'index.ts': 'export const billing = 1;\n',
      'server/zebra.ts':
        "import { findUserById } from '@/features/users/server/repository';\nexport const zebra = 1;\n",
      'server/alpha.ts':
        "import { findUserById } from '@/features/users/server/repository';\nexport const alpha = 1;\n",
    });

    const first = runGuard(repo, ['--base', 'HEAD', '--json']);
    const second = runGuard(repo, ['--base', 'HEAD', '--json']);
    expect(first.exitCode).toBe(1);
    expect(second.stdout).toBe(first.stdout);
    const json = JSON.parse(first.stdout) as {
      regression: { introducedIssues: Array<{ code: string; file: string; relationship: string }> };
    };
    expect(json.regression.introducedIssues).toHaveLength(2);
    expect(json.regression.introducedIssues.map((issue) => issue.file)).toEqual([
      'src/features/billing/server/alpha.ts',
      'src/features/billing/server/zebra.ts',
    ]);
  });
});
