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

export interface HistoryFixtureIdentity {
  path: string;
  digest: string;
  historyIds: string[];
}

export interface TransitionEvidence {
  id: string;
  kind: string;
  status: EvidenceStatus;
  detail: string;
  candidateDigest: string;
  limitations?: string[];
  fixture?: HistoryFixtureIdentity;
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
  schemaVersion: 3;
  feature: string;
  transitionId: string;
  baseDigest: string;
  localStartDigest: string;
  incomingDigest: string;
  incomingTransitionDigest: string;
  candidateDigest: string;
  appFingerprint: string;
  appInputs: AppFingerprintInput[];
  historyFixtures: HistoryFixtureIdentity[];
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

/**
 * Deterministic transition identity: feature + BASE + LOCAL-start +
 * INCOMING transition inputs (source plus material distribution inputs).
 */
export function transitionIdentity(
  feature: string,
  baseDigest: string,
  localStartDigest: string,
  incomingTransitionDigest: string,
): string {
  return sha256Hex(`${feature}\n${baseDigest}\n${localStartDigest}\n${incomingTransitionDigest}`).slice(0, 16);
}

/** Candidate revision identity: candidate feature bytes + application fingerprint. */
export function candidateDigestFor(candidate: ReadonlyMap<string, Buffer>, appFingerprint: string): string {
  return sha256Hex(`${digestFeatureFiles(candidate)}\n${appFingerprint}`);
}

/**
 * Material incoming distribution inputs consumed during transition
 * evaluation. Lineage BASE stays pure official Feature source, but the
 * transition identity must also move when distribution inputs that drive
 * obligations change — currently the requirements manifest that feeds
 * package/provider obligations. Assembly templates are install-time only:
 * installation proves the resulting integration and evolution never
 * touches bindings, so templates do not participate in transition
 * reasoning and are deliberately excluded here instead of fingerprinting
 * unused data.
 */
export const INCOMING_TRANSITION_DISTRIBUTION_FILES = ['.nara/requirements.json'] as const;

export function readIncomingTransitionInputs(
  officialDirectory: string,
  incoming: ReadonlyMap<string, Buffer>,
): Map<string, Buffer> {
  const combined = new Map<string, Buffer>();
  for (const [relativePath, bytes] of [...incoming.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    combined.set(`source/${relativePath}`, bytes);
  }
  for (const distributionFile of INCOMING_TRANSITION_DISTRIBUTION_FILES) {
    const absolute = path.join(officialDirectory, ...distributionFile.split('/'));
    if (!existsSync(absolute) || !statSync(absolute).isFile()) continue;
    combined.set(`distribution/${distributionFile}`, readFileSync(absolute));
  }
  return combined;
}

export function digestIncomingTransition(officialDirectory: string, incoming: ReadonlyMap<string, Buffer>): string {
  return digestFeatureFiles(readIncomingTransitionInputs(officialDirectory, incoming));
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

function shouldFingerprint(relative: string, feature: string): boolean {
  if (relative.startsWith(`src/features/${feature}/`)) return false;
  if (relative.startsWith('src/')) return true;
  if (relative.startsWith('tests/')) return true;
  if (relative === 'migrations' || relative.startsWith('migrations/')) return true;
  if (relative.startsWith('resources/')) return true;
  if (
    relative === 'package.json' ||
    relative === 'package-lock.json' ||
    relative === 'tsconfig.json' ||
    relative === 'tsconfig.frontend.json' ||
    relative === 'vite.config.mjs' ||
    relative === 'vite.config.ts' ||
    relative === 'index.html'
  ) {
    return true;
  }
  return false;
}

/**
 * Fingerprint every material application-owned source input used by the
 * evaluated candidate: application bindings and composition, all provider
 * Feature source (bindings consume providers directly, so any provider
 * change can move behavior), shared application modules, selected test
 * source, the application migration set, manifests, and compiler/build
 * configuration. The transitioning feature's own source is excluded here;
 * it is covered by the candidate feature digest. Control state
 * (`.nara/` receipts and lineage, databases, build output, dependencies)
 * is excluded: lineage identity is tracked separately and history inputs
 * are bound through their own fixture identities.
 */
export function fingerprintApplicationState(
  root: string,
  feature: string,
): { digest: string; inputs: AppFingerprintInput[] } {
  const absoluteFiles: string[] = [];
  for (const tree of ['src', 'tests', 'migrations', 'resources']) {
    collectFiles(root, path.join(root, ...tree.split('/')), absoluteFiles);
  }
  for (const extra of [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'tsconfig.frontend.json',
    'vite.config.mjs',
    'vite.config.ts',
    'index.html',
  ]) {
    const absolute = path.join(root, extra);
    if (existsSync(absolute) && statSync(absolute).isFile()) absoluteFiles.push(absolute);
  }
  const transitionChecks = transitionChecksPath(root, feature);
  if (existsSync(transitionChecks)) absoluteFiles.push(transitionChecks);

  const inputs: AppFingerprintInput[] = [];
  const seen = new Set<string>();
  for (const absolute of absoluteFiles.sort()) {
    const relative = posixRelative(root, absolute);
    if (seen.has(relative)) continue;
    seen.add(relative);
    if (!shouldFingerprint(relative, feature)) continue;
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
    historyFixtures: [...(receipt.historyFixtures ?? [])].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    ),
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
  if (typeof parsed !== 'object' || parsed === null || parsed.schemaVersion !== 3) {
    throw new Error(
      `Invalid transition receipt at ${file}: expected schemaVersion 3 with incoming distribution and history-fixture identity. Re-run the transition evaluation to issue a current receipt.`,
    );
  }
  return parsed;
}

/**
 * Aggregate a scoped transition outcome. Precedence is BLOCKED, then
 * UNVERIFIED, then VERIFIED. Only VERIFIED candidates are eligible for
 * Nara-managed acceptance.
 *
 * BLOCKED requires concrete negative evidence (a failing check): a
 * reconciliation conflict, an unsatisfied host contract, a failing test,
 * an incompatible prerequisite, a checksum mismatch, a failing rehearsal,
 * or a new architecture regression. An open obligation with only missing
 * or incomplete evidence yields UNVERIFIED, never BLOCKED.
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
  const evidenceFailed = evidence.some((item) => item.status === 'fail');
  if (evidenceFailed) {
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
