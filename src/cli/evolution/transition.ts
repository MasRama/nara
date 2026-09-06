import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { digestFeatureFiles } from './lineage';

export type TransitionOutcome = 'VERIFIED' | 'BLOCKED' | 'UNVERIFIED';

export type ObligationCategory =
  | 'source'
  | 'boundary'
  | 'host'
  | 'binding'
  | 'provider'
  | 'package'
  | 'integration'
  | 'migration'
  | 'behavioral';

export type ObligationStatus = 'open' | 'structural-ok' | 'verified';

export interface TransitionObligation {
  id: string;
  category: ObligationCategory;
  reason: string;
  surface: string[];
  action: string;
  status: ObligationStatus;
  blocking: boolean;
  limitations?: string[];
}

export type EvidenceStatus = 'pass' | 'fail' | 'missing' | 'stale' | 'unsupported';

export interface TransitionEvidence {
  id: string;
  kind: string;
  status: EvidenceStatus;
  detail: string;
  candidateDigest: string;
  limitations?: string[];
}

export interface TransitionAcceptance {
  state: 'unaccepted' | 'accepted';
  candidateDigest?: string;
  transitionId?: string;
}

export interface AppFingerprintInput {
  path: string;
  digest: string;
}

export interface TransitionReceipt {
  schemaVersion: 2;
  feature: string;
  transitionId: string;
  baseDigest: string;
  localStartDigest: string;
  incomingDigest: string;
  candidateDigest: string;
  appFingerprint: string;
  appInputs: AppFingerprintInput[];
  obligations: TransitionObligation[];
  evidence: TransitionEvidence[];
  outcome: TransitionOutcome;
  limitations: string[];
  stale: boolean;
  acceptance: TransitionAcceptance;
  acceptedTransition?: string;
}

function sha256Hex(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashBytes(bytes: Buffer): string {
  return sha256Hex(bytes);
}

/** Deterministic transition identity: feature + BASE + LOCAL-start + INCOMING. */
export function transitionIdentity(
  feature: string,
  baseDigest: string,
  localStartDigest: string,
  incomingDigest: string,
): string {
  return sha256Hex(`${feature}\n${baseDigest}\n${localStartDigest}\n${incomingDigest}`).slice(0, 16);
}

/** Candidate revision identity: candidate feature bytes + application fingerprint. */
export function candidateDigestFor(candidate: ReadonlyMap<string, Buffer>, appFingerprint: string): string {
  return sha256Hex(`${digestFeatureFiles(candidate)}\n${appFingerprint}`);
}

function digestFileBytes(filePath: string): string {
  return sha256Hex(readFileSync(filePath));
}

function posixRelative(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join('/');
}

function collectFiles(root: string, directory: string, out: string[]): void {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return;
  for (const entry of readdirSync(directory).sort()) {
    const absolute = path.join(directory, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'build' || entry === 'dist') continue;
      collectFiles(root, absolute, out);
    } else if (stat.isFile()) {
      out.push(absolute);
    }
  }
}

function shouldFingerprint(relative: string): boolean {
  if (relative.startsWith('src/app/')) return true;
  if (relative === 'package.json' || relative === 'package-lock.json') return true;
  if (relative === 'tsconfig.json' || relative === 'tsconfig.frontend.json' || relative === 'vite.config.mjs') return true;
  if (relative.startsWith('src/features/') && relative.includes('/server/migrations/') && relative.endsWith('.sql'))
    return true;
  if (relative === 'migrations' || relative.startsWith('migrations/')) return true;
  if (relative.startsWith('tests/') && (relative.endsWith('.test.ts') || relative.endsWith('.test.mjs'))) return true;
  if (relative.startsWith('src/app/') && relative.endsWith('.test.ts')) return true;
  return false;
}

/**
 * Fingerprint application-owned state relevant to a transition candidate.
 * The transitioning feature's own source is excluded here; it is covered by
 * the candidate feature digest. Everything else that can invalidate
 * executable evidence is included conservatively.
 */
export function fingerprintApplicationState(
  root: string,
  feature: string,
): { digest: string; inputs: AppFingerprintInput[] } {
  const absoluteFiles: string[] = [];
  collectFiles(root, path.join(root, 'src', 'app'), absoluteFiles);
  for (const extra of ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.frontend.json', 'vite.config.mjs']) {
    const absolute = path.join(root, extra);
    if (existsSync(absolute) && statSync(absolute).isFile()) absoluteFiles.push(absolute);
  }
  collectFiles(root, path.join(root, 'migrations'), absoluteFiles);
  const featureRoot = path.join(root, 'src', 'features');
  if (existsSync(featureRoot) && statSync(featureRoot).isDirectory()) {
    for (const entry of readdirSync(featureRoot).sort()) {
      if (entry === feature) continue;
      collectFiles(root, path.join(featureRoot, entry, 'server', 'migrations'), absoluteFiles);
    }
  }
  collectFiles(root, path.join(root, 'tests'), absoluteFiles);
  const transitionChecks = transitionChecksPath(root, feature);
  if (existsSync(transitionChecks)) absoluteFiles.push(transitionChecks);

  const inputs: AppFingerprintInput[] = [];
  const seen = new Set<string>();
  for (const absolute of absoluteFiles.sort()) {
    const relative = posixRelative(root, absolute);
    if (seen.has(relative)) continue;
    seen.add(relative);
    if (relative.startsWith('src/features/') && relative.includes(`/features/${feature}/`)) continue;
    if (!shouldFingerprint(relative)) continue;
    try {
      inputs.push({ path: relative, digest: digestFileBytes(absolute) });
    } catch {
      continue;
    }
  }
  inputs.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  const digest = sha256Hex(inputs.map((input) => `${input.path}\n${input.digest}`).join('\n'));
  return { digest, inputs };
}

export function transitionDirectory(root: string, feature: string): string {
  return path.resolve(root, '.nara', 'transitions', feature);
}

export function transitionCurrentPath(root: string, feature: string): string {
  return path.join(transitionDirectory(root, feature), 'current.json');
}

export function transitionHistoryPath(root: string, feature: string, candidateDigest: string): string {
  return path.join(transitionDirectory(root, feature), 'history', `${candidateDigest}.json`);
}

/** Application-owned evidence selection. Nara reads it; evolution never writes it. */
export function transitionChecksPath(root: string, feature: string): string {
  return path.resolve(root, '.nara', 'transitions', `${feature}.checks.json`);
}

export interface TransitionChecks {
  schemaVersion: 1;
  tests?: string[];
  historyFixture?: string;
}

export function readTransitionChecks(root: string, feature: string): TransitionChecks | undefined {
  const file = transitionChecksPath(root, feature);
  if (!existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<TransitionChecks>;
    if (typeof parsed !== 'object' || parsed === null || parsed.schemaVersion !== 1) return undefined;
    const tests = Array.isArray(parsed.tests) ? parsed.tests.filter((entry): entry is string => typeof entry === 'string') : undefined;
    const historyFixture = typeof parsed.historyFixture === 'string' ? parsed.historyFixture : undefined;
    return { schemaVersion: 1, ...(tests ? { tests } : {}), ...(historyFixture ? { historyFixture } : {}) };
  } catch {
    return undefined;
  }
}

function sortReceipt(receipt: TransitionReceipt): TransitionReceipt {
  const byId = <T extends { id: string }>(left: T, right: T): number =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  return {
    ...receipt,
    appInputs: [...receipt.appInputs].sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0)),
    obligations: [...receipt.obligations]
      .sort(byId)
      .map((obligation) => ({ ...obligation, surface: [...obligation.surface].sort() })),
    evidence: [...receipt.evidence].sort(byId),
    limitations: [...receipt.limitations].sort(),
  };
}

export function writeTransitionReceipt(root: string, receipt: TransitionReceipt): void {
  const ordered = sortReceipt(receipt);
  const directory = transitionDirectory(root, receipt.feature);
  mkdirSync(directory, { recursive: true });
  const currentPath = transitionCurrentPath(root, receipt.feature);
  const tmpPath = `${currentPath}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(ordered, null, 2)}\n`);
  const existing = existsSync(currentPath) ? readFileSync(currentPath) : undefined;
  if (existing && existing.toString() === readFileSync(tmpPath, 'utf8')) {
    rmSync(tmpPath, { force: true });
  } else {
    writeFileSync(currentPath, readFileSync(tmpPath, 'utf8'));
    rmSync(tmpPath, { force: true });
  }
  const historyPath = transitionHistoryPath(root, receipt.feature, receipt.candidateDigest);
  if (!existsSync(historyPath)) {
    mkdirSync(path.dirname(historyPath), { recursive: true });
    writeFileSync(historyPath, `${JSON.stringify(ordered, null, 2)}\n`);
  } else if (receipt.acceptance.state === 'accepted') {
    writeFileSync(historyPath, `${JSON.stringify(ordered, null, 2)}\n`);
  }
}

export function readCurrentTransition(root: string, feature: string): TransitionReceipt | undefined {
  const file = transitionCurrentPath(root, feature);
  if (!existsSync(file)) return undefined;
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as TransitionReceipt;
  if (typeof parsed !== 'object' || parsed === null || parsed.schemaVersion !== 2) {
    throw new Error(`Invalid transition receipt at ${file}.`);
  }
  return parsed;
}

/**
 * Aggregate a scoped transition outcome. Precedence is BLOCKED, then
 * UNVERIFIED, then VERIFIED. Only VERIFIED candidates are eligible for
 * Nara-managed acceptance.
 */
export function aggregateOutcome(
  obligations: TransitionObligation[],
  evidence: TransitionEvidence[],
): { outcome: TransitionOutcome; limitations: string[] } {
  const limitations = new Set<string>();
  for (const obligation of obligations) {
    for (const limitation of obligation.limitations ?? []) limitations.add(limitation);
  }
  for (const item of evidence) {
    for (const limitation of item.limitations ?? []) limitations.add(limitation);
  }
  const blockingOpen = obligations.some((obligation) => obligation.blocking && obligation.status === 'open');
  const evidenceFailed = evidence.some((item) => item.status === 'fail');
  if (blockingOpen || evidenceFailed) {
    return { outcome: 'BLOCKED', limitations: [...limitations].sort() };
  }
  const unverifiedObligation = obligations.some(
    (obligation) => obligation.status === 'open' || obligation.status === 'structural-ok',
  );
  const evidenceIncomplete = evidence.some(
    (item) => item.status === 'missing' || item.status === 'stale' || item.status === 'unsupported',
  );
  if (unverifiedObligation || evidenceIncomplete) {
    return { outcome: 'UNVERIFIED', limitations: [...limitations].sort() };
  }
  return { outcome: 'VERIFIED', limitations: [...limitations].sort() };
}

/**
 * Recompute staleness for a stored receipt against the current candidate.
 * A stale receipt stays valid history for its old candidate digest only.
 */
export function isReceiptStale(receipt: TransitionReceipt, currentCandidateDigest: string): boolean {
  if (receipt.candidateDigest !== currentCandidateDigest) return true;
  if (receipt.evidence.some((item) => item.candidateDigest !== currentCandidateDigest)) return true;
  return false;
}
