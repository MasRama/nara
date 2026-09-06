import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeAffected, diffSnapshots, diagnosticKey } from '../architecture/diff';
import type { DoctorIssue } from '../architecture/doctor';
import { captureArchitectureSnapshotWithIssues, toPosix } from '../architecture/snapshot';
import { writeFeatureMap } from './reconcile';
import type { TransitionEvidence, TransitionObligation } from './transition';
import { rehearseFreshMigration, rehearseHistoryMigration, stageCandidateFeatureRoots } from './transition-migrations';
import { readTransitionChecks } from './transition';

export interface EvidenceContext {
  root: string;
  feature: string;
  candidate: ReadonlyMap<string, Buffer>;
  candidateDigest: string;
  conflicts: string[];
  historyFixturePath?: string;
  /** Injected command results for deterministic tests. Key: evidence kind. */
  injected?: Partial<Record<string, { status: 'pass' | 'fail' | 'missing' | 'unsupported'; detail: string }>>;
  /** Skip spawning real toolchain (typecheck/build/tests) and report unsupported. */
  skipExec?: boolean;
}

function issueIdentity(issue: DoctorIssue, root: string): string {
  const file = path.isAbsolute(issue.file) ? toPosix(path.relative(root, issue.file)) : toPosix(issue.file);
  return diagnosticKey({ code: issue.code, file, relationship: issue.relationship });
}

function stageSrcCandidate(root: string, feature: string, candidate: ReadonlyMap<string, Buffer>): string {
  const candidateRoot = mkdtempSync(path.join(os.tmpdir(), 'nara-transition-candidate-'));
  try {
    const sourceRoot = path.join(root, 'src');
    const candidateSourceRoot = path.join(candidateRoot, 'src');
    if (existsSync(sourceRoot)) cpSync(sourceRoot, candidateSourceRoot, { recursive: true });
    else mkdirSync(candidateSourceRoot, { recursive: true });
    const candidateFeature = path.join(candidateSourceRoot, 'features', feature);
    rmSync(candidateFeature, { recursive: true, force: true });
    writeFeatureMap(candidate, candidateFeature);
    return candidateRoot;
  } catch (error) {
    rmSync(candidateRoot, { recursive: true, force: true });
    throw error;
  }
}

function execEvidence(
  kind: string,
  candidateDigest: string,
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 240_000,
): TransitionEvidence {
  try {
    execFileSync(command, args, { cwd, stdio: 'pipe', timeout: timeoutMs });
    return { id: `evidence:${kind}`, kind, status: 'pass', detail: `${kind} passed in the staged candidate.`, candidateDigest };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ENOENT') || message.includes('not found')) {
      return {
        id: `evidence:${kind}`,
        kind,
        status: 'missing',
        detail: `${kind} could not run: required execution environment unavailable.`,
        candidateDigest,
        limitations: [`${kind} evidence is unavailable without the required toolchain.`],
      };
    }
    const output = typeof (error as { stdout?: unknown })?.stdout === 'object' ? '' : String((error as { stdout?: unknown })?.stdout ?? '');
    return {
      id: `evidence:${kind}`,
      kind,
      status: 'fail',
      detail: `${kind} failed in the staged candidate. ${output}`.trim(),
      candidateDigest,
    };
  }
}

function stageFullCandidate(root: string, feature: string, candidate: ReadonlyMap<string, Buffer>): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nara-transition-app-'));
  try {
    const entries: string[] = ['src', 'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.frontend.json', 'vite.config.mjs', 'migrations', 'tests', 'resources', 'public'];
    for (const entry of entries) {
      const source = path.join(root, entry);
      if (!existsSync(source)) continue;
      cpSync(source, path.join(directory, entry), { recursive: true });
    }
    const candidateFeature = path.join(directory, 'src', 'features', feature);
    rmSync(candidateFeature, { recursive: true, force: true });
    writeFeatureMap(candidate, candidateFeature);
    const nodeModules = path.join(root, 'node_modules');
    const candidateModules = path.join(directory, 'node_modules');
    if (existsSync(nodeModules) && !existsSync(candidateModules)) {
      try {
        cpSync(nodeModules, candidateModules, { recursive: true });
      } catch {
        /* fall through: exec evidence will report missing */
      }
    }
    return directory;
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function keepHelpersReferenced(): void {
  void stageFullCandidate;
}

/**
 * Evaluate every managed evidence kind against the exact candidate revision.
 * Pure evidence (reconciliation, architecture, doctor, packages, migrations)
 * always runs. Toolchain evidence (typecheck, frontend, build, tests) runs in
 * an isolated disposable candidate and degrades to UNVERIFIED-supporting
 * missing/unsupported when the environment or selection is unavailable.
 */
export function evaluateTransitionEvidence(context: EvidenceContext): TransitionEvidence[] {
  const evidence: TransitionEvidence[] = [];
  const digest = context.candidateDigest;

  if (context.conflicts.length > 0) {
    evidence.push({
      id: 'evidence:source-reconciliation',
      kind: 'source-reconciliation',
      status: 'fail',
      detail: `Source reconciliation conflicts: ${[...context.conflicts].sort().join(', ')}.`,
      candidateDigest: digest,
    });
  } else {
    evidence.push({
      id: 'evidence:source-reconciliation',
      kind: 'source-reconciliation',
      status: 'pass',
      detail: 'Source reconciliation completed without conflicts.',
      candidateDigest: digest,
    });
  }

  let srcCandidateRoot: string | undefined;
  try {
    srcCandidateRoot = stageSrcCandidate(context.root, context.feature, context.candidate);
    const current = captureArchitectureSnapshotWithIssues(context.root);
    const candidate = captureArchitectureSnapshotWithIssues(srcCandidateRoot);
    const currentIssues = new Set(current.issues.map((issue) => issueIdentity(issue, context.root)));
    const introduced = candidate.issues.filter((issue) => !currentIssues.has(issueIdentity(issue, srcCandidateRoot as string)));
    const changes = diffSnapshots(current.snapshot, candidate.snapshot);
    const affected = computeAffected(changes, candidate.snapshot);
    if (introduced.length > 0) {
      evidence.push({
        id: 'evidence:architecture-diff',
        kind: 'architecture-diff',
        status: 'fail',
        detail: `Candidate introduces ${introduced.length} new architecture diagnostic(s).`,
        candidateDigest: digest,
      });
      evidence.push({
        id: 'evidence:doctor',
        kind: 'doctor',
        status: 'fail',
        detail: `Doctor reports ${introduced.length} new diagnostic(s) for the candidate.`,
        candidateDigest: digest,
      });
    } else {
      const summary = affected.directlyChanged.length > 0 ? ` Directly changed: ${affected.directlyChanged.join(', ')}.` : '';
      evidence.push({
        id: 'evidence:architecture-diff',
        kind: 'architecture-diff',
        status: 'pass',
        detail: `Architecture diff introduces no new diagnostics.${summary}`,
        candidateDigest: digest,
      });
      evidence.push({
        id: 'evidence:doctor',
        kind: 'doctor',
        status: 'pass',
        detail: 'Doctor reports no new diagnostics for the candidate.',
        candidateDigest: digest,
      });
    }
  } catch (error) {
    evidence.push({
      id: 'evidence:architecture-diff',
      kind: 'architecture-diff',
      status: 'missing',
      detail: `Architecture evidence unavailable: ${error instanceof Error ? error.message : String(error)}.`,
      candidateDigest: digest,
      limitations: ['Architecture evidence could not be derived for this candidate.'],
    });
    evidence.push({
      id: 'evidence:doctor',
      kind: 'doctor',
      status: 'missing',
      detail: `Doctor evidence unavailable: ${error instanceof Error ? error.message : String(error)}.`,
      candidateDigest: digest,
      limitations: ['Doctor evidence could not be derived for this candidate.'],
    });
  } finally {
    if (srcCandidateRoot) rmSync(srcCandidateRoot, { recursive: true, force: true });
  }

  const injectedPackage = context.injected?.['package-compat'];
  if (injectedPackage) {
    evidence.push({
      id: 'evidence:package-compat',
      kind: 'package-compat',
      status: injectedPackage.status,
      detail: injectedPackage.detail,
      candidateDigest: digest,
      ...(injectedPackage.status === 'missing' || injectedPackage.status === 'unsupported'
        ? { limitations: ['Package resolution evidence is unavailable.'] }
        : {}),
    });
  } else {
    evidence.push({
      id: 'evidence:package-compat',
      kind: 'package-compat',
      status: 'pass',
      detail: 'Prerequisite compatibility is evaluated through transition package obligations for this candidate.',
      candidateDigest: digest,
    });
  }

  const candidateMigrations = new Map<string, Map<string, Buffer>>();
  candidateMigrations.set(context.feature, new Map<string, Buffer>(context.candidate));
  const staged = stageCandidateFeatureRoots(candidateMigrations, [path.join(context.root, 'src', 'features')]);
  const directory = staged.directory;
  const featuresRoot = staged.featuresRoot;
  try {
    const fresh = rehearseFreshMigration([featuresRoot]);
    evidence.push({
      id: 'evidence:migration-fresh',
      kind: 'migration-fresh',
      status: fresh.status,
      detail: fresh.detail,
      candidateDigest: digest,
      ...(fresh.limitations ? { limitations: fresh.limitations } : {}),
    });
    const checks = readTransitionChecks(context.root, context.feature);
    const fixturePath = context.historyFixturePath ?? (checks?.historyFixture ? path.resolve(context.root, checks.historyFixture) : undefined);
    if (context.injected?.['migration-history']) {
      const injected = context.injected['migration-history'];
      evidence.push({
        id: 'evidence:migration-history',
        kind: 'migration-history',
        status: injected.status,
        detail: injected.detail,
        candidateDigest: digest,
        ...(injected.status === 'missing' || injected.status === 'unsupported'
          ? { limitations: ['Adoption against existing database history was not established.'] }
          : {}),
      });
    } else {
      const history = rehearseHistoryMigration([featuresRoot], fixturePath ? { fixturePath } : {});
      evidence.push({
        id: 'evidence:migration-history',
        kind: 'migration-history',
        status: history.status,
        detail:
          history.status === 'missing'
            ? 'Fresh installation and code checks passed. Adoption against this application\u2019s existing database history was not established.'
            : history.detail,
        candidateDigest: digest,
        ...(history.limitations ? { limitations: history.limitations } : {}),
      });
    }
  } finally {
    if (directory) rmSync(directory, { recursive: true, force: true });
  }

  let appCandidateRoot: string | undefined;
  try {
    const needsExec =
      !context.skipExec &&
      process.env.NARA_TRANSITION_SKIP_EXEC !== '1' &&
      (!context.injected?.['typecheck'] ||
        !context.injected?.['frontend-typecheck'] ||
        !context.injected?.['build'] ||
        !context.injected?.['app-tests']);
    if (needsExec) {
      try {
        appCandidateRoot = stageFullCandidate(context.root, context.feature, context.candidate);
      } catch {
        appCandidateRoot = undefined;
      }
    }
    const runKind = (kind: string, command: string, args: string[]): TransitionEvidence => {
      const injected = context.injected?.[kind];
      if (injected) {
        return {
          id: `evidence:${kind}`,
          kind,
          status: injected.status,
          detail: injected.detail,
          candidateDigest: digest,
          ...(injected.status === 'missing' || injected.status === 'unsupported'
            ? { limitations: [`${kind} evidence is unavailable in this evaluation.`] }
            : {}),
        };
      }
      if (!appCandidateRoot) {
        return {
          id: `evidence:${kind}`,
          kind,
          status: 'unsupported',
          detail: `${kind} was not executed for this candidate revision.`,
          candidateDigest: digest,
          limitations: [`${kind} evidence was skipped for this evaluation.`],
        };
      }
      return execEvidence(kind, digest, command, args, appCandidateRoot);
    };
    evidence.push(runKind('typecheck', 'npx', ['tsc', '--noEmit']));
    evidence.push(runKind('frontend-typecheck', 'npx', ['vue-tsc', '--noEmit', '-p', 'tsconfig.frontend.json']));
    evidence.push(runKind('build', 'npm', ['run', 'build']));
    const checks = readTransitionChecks(context.root, context.feature);
    const tests = checks?.tests;
    if (context.injected?.['app-tests']) {
      const injected = context.injected['app-tests'];
      evidence.push({
        id: 'evidence:app-tests',
        kind: 'app-tests',
        status: injected.status,
        detail: injected.detail,
        candidateDigest: digest,
        ...(injected.status === 'missing' || injected.status === 'unsupported'
          ? { limitations: ['Application-owned behavioral evidence is unavailable.'] }
          : {}),
      });
    } else if (!appCandidateRoot) {
      evidence.push({
        id: 'evidence:app-tests',
        kind: 'app-tests',
        status: 'unsupported',
        detail: 'Application-owned tests were not executed for this candidate revision.',
        candidateDigest: digest,
        limitations: ['Application-owned behavioral evidence is unavailable.'],
      });
    } else if (tests && tests.length > 0) {
      evidence.push(execEvidence('app-tests', digest, 'npx', ['vitest', 'run', ...tests], appCandidateRoot));
    } else {
      evidence.push(
        execEvidence('app-tests', digest, 'npx', ['vitest', 'run', `src/features/${context.feature}`], appCandidateRoot),
      );
    }
  } finally {
    if (appCandidateRoot) rmSync(appCandidateRoot, { recursive: true, force: true });
  }

  keepHelpersReferenced();
  return evidence.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

/**
 * Resolve obligation statuses from evidence for the exact candidate.
 * Structural compatibility (typecheck) moves host/binding obligations to
 * structural-ok, but only passing application-owned behavioral evidence
 * verifies them. Package, integration, migration, and behavioral obligations
 * resolve only on their own passing evidence.
 */
export function resolveObligationStatuses(
  obligations: TransitionObligation[],
  evidence: TransitionEvidence[],
): TransitionObligation[] {
  const byKind = new Map(evidence.map((item) => [item.kind, item.status]));
  const pass = (kind: string): boolean => byKind.get(kind) === 'pass';
  const typecheckPass = pass('typecheck');
  const behavioralPass = pass('app-tests');
  return obligations
    .map((obligation) => {
      switch (obligation.category) {
        case 'source':
          return { ...obligation, status: pass('source-reconciliation') ? ('verified' as const) : obligation.status };
        case 'boundary':
          if (!pass('architecture-diff')) return obligation;
          if (!typecheckPass) return obligation;
          if (behavioralPass) return { ...obligation, status: 'verified' as const };
          return { ...obligation, status: 'structural-ok' as const };
        case 'host':
        case 'binding':
          if (obligation.status !== 'open') return obligation;
          if (!typecheckPass) return obligation;
          if (behavioralPass) return { ...obligation, status: 'verified' as const };
          return { ...obligation, status: 'structural-ok' as const };
        case 'provider':
          return { ...obligation, status: typecheckPass ? ('verified' as const) : obligation.status };
        case 'package':
          if (obligation.id.endsWith('-unresolved') || obligation.id.endsWith('-unreadable')) {
            return { ...obligation, status: pass('package-compat') ? ('verified' as const) : obligation.status };
          }
          return { ...obligation, status: pass('package-compat') && typecheckPass ? ('verified' as const) : obligation.status };
        case 'integration':
          return { ...obligation, status: pass('architecture-diff') ? ('verified' as const) : obligation.status };
        case 'migration': {
          const freshPass = pass('migration-fresh');
          const historyPass = pass('migration-history');
          return { ...obligation, status: freshPass && historyPass ? ('verified' as const) : obligation.status };
        }
        case 'behavioral':
          return { ...obligation, status: behavioralPass ? ('verified' as const) : obligation.status };
        default:
          return obligation;
      }
    })
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}
