import { computeAffected, diagnosticKey, diffSnapshots, type AffectedSet } from '../architecture/diff';
import type { DoctorIssue } from '../architecture/doctor';
import {
  gitRepoRoot,
  materializeRef,
  removeTempDir,
  verifyGitRef,
} from '../architecture/git-materialize';
import {
  captureArchitectureSnapshotWithIssues,
  toPosix,
} from '../architecture/snapshot';

export interface GuardBaseIdentity {
  kind: 'git-ref';
  ref: string;
  commit: string;
}

export interface GuardTargetRefIdentity {
  kind: 'git-ref';
  ref: string;
  commit: string;
}

export interface GuardTargetWorktreeIdentity {
  kind: 'working-tree';
}

export type GuardTargetIdentity = GuardTargetRefIdentity | GuardTargetWorktreeIdentity;

export interface GuardRegression {
  baselineIssueCount: number;
  introducedIssues: DoctorIssue[];
  resolvedIssues: DoctorIssue[];
  remainingBaselineIssueCount: number;
}

export interface ArchitectureGuardResult {
  schemaVersion: 1;
  passed: boolean;
  base: GuardBaseIdentity;
  target: GuardTargetIdentity;
  regression: GuardRegression;
  affected: AffectedSet;
}

export interface GuardOptions {
  base: string;
  head?: string;
  cwd?: string;
}

function issueKey(issue: DoctorIssue): string {
  return diagnosticKey({ code: issue.code, file: toPosix(issue.file), relationship: issue.relationship });
}

export function runArchitectureGuard(options: GuardOptions): ArchitectureGuardResult {
  const cwd = options.cwd ?? process.cwd();
  const repoRoot = gitRepoRoot(cwd);
  const baseCommit = verifyGitRef(options.base, repoRoot);

  const tempDirs: string[] = [];
  try {
    const baseDir = materializeRef(options.base, repoRoot);
    tempDirs.push(baseDir);
    const base = captureArchitectureSnapshotWithIssues(baseDir);

    let targetSnapshot;
    let targetIssues: DoctorIssue[];
    let target: GuardTargetIdentity;
    if (options.head !== undefined) {
      const headCommit = verifyGitRef(options.head, repoRoot);
      const headDir = materializeRef(options.head, repoRoot);
      tempDirs.push(headDir);
      const head = captureArchitectureSnapshotWithIssues(headDir);
      targetSnapshot = head.snapshot;
      targetIssues = head.issues;
      target = { kind: 'git-ref', ref: options.head, commit: headCommit };
    } else {
      // Working tree, including uncommitted source changes.
      const worktree = captureArchitectureSnapshotWithIssues(repoRoot);
      targetSnapshot = worktree.snapshot;
      targetIssues = worktree.issues;
      target = { kind: 'working-tree' };
    }

    // Same stable diagnostic identity as `nara diff`: introduced/resolved
    // classification is shared, never reimplemented per command.
    const changes = diffSnapshots(base.snapshot, targetSnapshot);
    const affected = computeAffected(changes, targetSnapshot);

    const baseByKey = new Map(base.issues.map((issue) => [issueKey(issue), issue]));
    const targetByKey = new Map(targetIssues.map((issue) => [issueKey(issue), issue]));
    const resolveTargetIssue = (key: string): DoctorIssue => {
      const issue = targetByKey.get(key);
      if (!issue) throw new Error(`Architecture guard invariant violated: missing target diagnostic for ${JSON.stringify(key)}.`);
      return issue;
    };
    const resolveBaseIssue = (key: string): DoctorIssue => {
      const issue = baseByKey.get(key);
      if (!issue) throw new Error(`Architecture guard invariant violated: missing baseline diagnostic for ${JSON.stringify(key)}.`);
      return issue;
    };
    const introducedIssues = changes.diagnostics.added.map((diagnostic) =>
      resolveTargetIssue(diagnosticKey(diagnostic)),
    );
    const resolvedIssues = changes.diagnostics.resolved.map((diagnostic) =>
      resolveBaseIssue(diagnosticKey(diagnostic)),
    );

    const baselineIssueCount = base.issues.length;
    const remainingBaselineIssueCount = baselineIssueCount - resolvedIssues.length;
    return {
      schemaVersion: 1,
      passed: introducedIssues.length === 0,
      base: { kind: 'git-ref', ref: options.base, commit: baseCommit },
      target,
      regression: {
        baselineIssueCount,
        introducedIssues,
        resolvedIssues,
        remainingBaselineIssueCount,
      },
      affected,
    };
  } finally {
    for (const directory of tempDirs) removeTempDir(directory);
  }
}

export function formatGuardHuman(result: ArchitectureGuardResult): string {
  const { regression, affected } = result;
  const lines: string[] = [];
  if (result.passed) {
    lines.push('Architecture guard passed.');
    lines.push('No new architecture violations.');
  } else {
    const count = regression.introducedIssues.length;
    lines.push('Architecture guard failed.');
    lines.push(`${count} new architecture violation${count === 1 ? '' : 's'} introduced.`);
  }
  lines.push('');

  if (!result.passed) {
    lines.push('New architecture violations:');
    for (const issue of regression.introducedIssues) {
      lines.push(`- [${issue.code}] ${issue.message}`);
      lines.push(`  file: ${issue.file}`);
      lines.push(`  relationship: ${issue.relationship}`);
      lines.push(`  reason: ${issue.reason}`);
      lines.push(`  fix: ${issue.suggestion}`);
    }
    lines.push('');
  }

  lines.push(`Baseline issues: ${regression.baselineIssueCount}`);
  lines.push(`Resolved: ${regression.resolvedIssues.length}`);
  lines.push(`Remaining baseline issues: ${regression.remainingBaselineIssueCount}`);

  const hasImpact = affected.directlyChanged.length > 0 || affected.downstream.length > 0;
  if (!hasImpact) {
    lines.push('Structural dependency impact: none.');
  } else {
    lines.push('Structural dependency impact:');
    lines.push(
      `  Directly changed: ${affected.directlyChanged.length > 0 ? affected.directlyChanged.join(', ') : 'none'}`,
    );
    lines.push(`  Downstream: ${affected.downstream.length > 0 ? affected.downstream.join(', ') : 'none'}`);
  }
  return `${lines.join('\n')}\n`;
}
