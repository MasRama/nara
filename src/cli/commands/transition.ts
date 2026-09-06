import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { featureNameIsValid } from '../feature-name';
import { resolveOfficialFeatureDirectory } from '../package-root';
import {
  aggregateOutcome,
  candidateDigestFor,
  fingerprintApplicationState,
  isReceiptStale,
  readCurrentTransition,
  digestIncomingTransition,
  transitionIdentity,
  writeTransitionReceipt,
  type TransitionReceipt,
} from '../evolution/transition';
import { deriveTransitionObligations, satisfiesRange } from '../evolution/transition-obligations';
import { evaluateTransitionEvidence, resolveObligationStatuses } from '../evolution/transition-evidence';
import {
  digestFeatureFiles,
  featureFilesEqual,
  lineageDirectory,
  readFeatureFiles,
  readFeatureLineage,
  stageFeatureLineage,
  type StagedLineage,
} from '../evolution/lineage';
import { cleanupStagedLineage } from '../evolution/lineage';
import { reconcileFeatureFiles, writeFeatureMap } from '../evolution/reconcile';
import { readFeatureRequirements } from '../composition/requirements';

export type TransitionCommandErrorCode =
  | 'invalid-name'
  | 'unknown-feature'
  | 'missing-local'
  | 'missing-lineage'
  | 'lineage-error'
  | 'not-verified'
  | 'stale-candidate'
  | 'no-transition'
  | 'filesystem';

export interface TransitionCommandError {
  schemaVersion: 2;
  feature: string;
  status: 'error';
  errorCode: TransitionCommandErrorCode;
  message: string;
  canApply: false;
}

export interface PlanTransitionOptions {
  feature: string;
  cwd?: string;
  officialDirectory?: string;
  historyFixturePath?: string;
  skipExec?: boolean;
  injected?: Record<string, { status: 'pass' | 'fail' | 'missing' | 'unsupported'; detail: string }>;
}

export type PlanTransitionOutcome =
  | { ok: true; receipt: TransitionReceipt }
  | { ok: false; error: TransitionCommandError };

export type AcceptTransitionOutcome =
  | { ok: true; receipt: TransitionReceipt }
  | { ok: false; error: TransitionCommandError };

function commandError(
  feature: string,
  errorCode: TransitionCommandErrorCode,
  message: string,
): { ok: false; error: TransitionCommandError } {
  return { ok: false, error: { schemaVersion: 2, feature, status: 'error', errorCode, message, canApply: false } };
}

function installedVersion(root: string, name: string): string | undefined {
  try {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
  } catch {
    return undefined;
  }
}

function resolvedVersion(root: string, name: string): string | undefined {
  const file = path.join(root, 'node_modules', name, 'package.json');
  if (!existsSync(file)) return undefined;
  try {
    const pkg = JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : undefined;
  } catch {
    return undefined;
  }
}

function defaultPackageEvidence(
  root: string,
  officialDirectory: string,
  injected?: PlanTransitionOptions['injected'],
): { status: 'pass' | 'fail' | 'missing' | 'unsupported'; detail: string } | undefined {
  if (injected?.['package-compat']) return undefined;
  try {
    const requirements = readFeatureRequirements(officialDirectory);
    if (!requirements.ok || !requirements.requirements?.packages) {
      return { status: 'pass', detail: 'No package prerequisites declared for this candidate.' };
    }
    const entries = Object.entries(requirements.requirements.packages);
    if (entries.length === 0) return { status: 'pass', detail: 'No package prerequisites declared for this candidate.' };
    for (const [name, range] of entries) {
      const declared = installedVersion(root, name);
      if (declared === undefined) {
        return { status: 'fail', detail: `Prerequisite ${name}@${range} is not declared in package.json.` };
      }
      const resolved = resolvedVersion(root, name) ?? declared.replace(/^[~^>=<\s]+/, '');
      const satisfied = satisfiesRange(resolved, range);
      if (satisfied === false) {
        return { status: 'fail', detail: `Prerequisite ${name}@${declared} does not satisfy ${range}.` };
      }
      if (satisfied === undefined || resolvedVersion(root, name) === undefined) {
        return { status: 'missing', detail: `Prerequisite resolution evidence for ${name}@${range} is unavailable.` };
      }
    }
    return { status: 'pass', detail: 'Declared prerequisites satisfy the candidate requirements.' };
  } catch (error) {
    return { status: 'missing', detail: `Prerequisite evidence unavailable: ${error instanceof Error ? error.message : String(error)}.` };
  }
}

function stageFeatureTree(
  root: string,
  feature: string,
  files: ReadonlyMap<string, Buffer>,
): { directory: string; targetDirectory: string } {
  const targetDirectory = path.resolve(root, 'src', 'features', feature);
  mkdirSync(path.dirname(targetDirectory), { recursive: true });
  const directory = mkdtempSync(path.join(path.dirname(targetDirectory), '.nara-transition-feature-'));
  try {
    writeFeatureMap(files, directory);
    return { directory, targetDirectory };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function applyVerifiedCandidate(
  root: string,
  feature: string,
  candidate: ReadonlyMap<string, Buffer>,
  incoming: ReadonlyMap<string, Buffer>,
  incomingDigest: string,
  transitionId: string,
): void {
  const featureStage = stageFeatureTree(root, feature, candidate);
  let stagedLineage: StagedLineage | undefined;
  let featureBackedUp = false;
  let lineageBackedUp = false;
  let featureReplaced = false;
  let lineageReplaced = false;
  const targetLineage = lineageDirectory(root, feature);
  const token = path.basename(featureStage.directory).replace('.nara-transition-feature-', '');
  const featureBackup = path.join(path.dirname(featureStage.targetDirectory), `.nara-transition-backup-${token}`);
  const lineageBackup = path.join(path.dirname(targetLineage), `.nara-transition-lineage-backup-${token}`);
  try {
    stagedLineage = stageFeatureLineage(root, feature, incoming, incomingDigest);
    const recordPath = path.join(stagedLineage.directory, 'lineage.json');
    const record = JSON.parse(readFileSync(recordPath, 'utf8')) as Record<string, unknown>;
    writeFileSync(recordPath, `${JSON.stringify({ ...record, acceptedTransition: transitionId }, null, 2)}\n`);
    if (existsSync(featureBackup) || existsSync(lineageBackup)) {
      throw new Error(`Transition backup already exists for "${feature}".`);
    }
    renameSync(featureStage.targetDirectory, featureBackup);
    featureBackedUp = true;
    renameSync(targetLineage, lineageBackup);
    lineageBackedUp = true;
    renameSync(featureStage.directory, featureStage.targetDirectory);
    featureReplaced = true;
    renameSync(stagedLineage.directory, targetLineage);
    lineageReplaced = true;
    stagedLineage = undefined;
  } catch (error) {
    if (featureReplaced) rmSync(featureStage.targetDirectory, { recursive: true, force: true });
    if (lineageReplaced) rmSync(targetLineage, { recursive: true, force: true });
    if (featureBackedUp && existsSync(featureBackup) && !existsSync(featureStage.targetDirectory)) {
      renameSync(featureBackup, featureStage.targetDirectory);
    }
    if (lineageBackedUp && existsSync(lineageBackup) && !existsSync(targetLineage)) {
      renameSync(lineageBackup, targetLineage);
    }
    rmSync(featureStage.directory, { recursive: true, force: true });
    cleanupStagedLineage(stagedLineage);
    throw error;
  }
  rmSync(featureBackup, { recursive: true, force: true });
  rmSync(lineageBackup, { recursive: true, force: true });
}

export function planTransition(options: PlanTransitionOptions): PlanTransitionOutcome {
  const root = path.resolve(options.cwd ?? process.cwd());
  const feature = options.feature;
  if (!featureNameIsValid(feature)) {
    return commandError(feature, 'invalid-name', `Invalid feature name "${feature}". Use lowercase letters, numbers, and single hyphens; start with a letter.`);
  }
  try {
    const officialDirectory = options.officialDirectory ?? resolveOfficialFeatureDirectory(feature);
    if (!existsSync(officialDirectory) || !statSync(officialDirectory).isDirectory()) {
      return commandError(feature, 'unknown-feature', `${feature} is application-owned and has no official upstream lineage.`);
    }
    const localDirectory = path.join(root, 'src', 'features', feature);
    if (!existsSync(localDirectory) || !statSync(localDirectory).isDirectory()) {
      return commandError(feature, 'missing-local', `Feature "${feature}" is not installed at ${localDirectory}.`);
    }
    const local = readFeatureFiles(localDirectory);
    const incoming = readFeatureFiles(officialDirectory, false);
    const incomingDigest = digestFeatureFiles(incoming);
    const localStartDigest = digestFeatureFiles(local);
    const incomingTransitionDigest = digestIncomingTransition(officialDirectory, incoming);
    let lineage: ReturnType<typeof readFeatureLineage>;
    try {
      lineage = readFeatureLineage(root, feature);
    } catch (error) {
      return commandError(feature, 'lineage-error', `Cannot plan a transition for "${feature}": stored official lineage is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (lineage === undefined) {
      if (!featureFilesEqual(local, incoming)) {
        return commandError(feature, 'missing-lineage', `Cannot plan a transition for "${feature}": Nara cannot prove the historical official base because lineage is missing.`);
      }
      return commandError(feature, 'missing-lineage', `Cannot plan a transition for "${feature}": lineage is missing but local source is identical; run evolve to bootstrap lineage first.`);
    }
    if (lineage.record.baseDigest === incomingDigest && featureFilesEqual(local, incoming)) {
      const fingerprint = fingerprintApplicationState(root, feature);
      const candidateDigest = candidateDigestFor(incoming, fingerprint.digest);
      const transitionId = transitionIdentity(feature, lineage.record.baseDigest, localStartDigest, incomingTransitionDigest);
      const receipt: TransitionReceipt = {
        schemaVersion: 3,
        feature,
        transitionId,
        baseDigest: lineage.record.baseDigest,
        localStartDigest,
        incomingDigest,
        incomingTransitionDigest,
        candidateDigest,
        appFingerprint: fingerprint.digest,
        appInputs: fingerprint.inputs,
        historyFixtures: [],
        obligations: [],
        evidence: [],
        outcome: 'VERIFIED',
        limitations: ['No upstream changes: candidate is identical to the installed source.'],
        stale: false,
        acceptance: { state: 'unaccepted' },
      };
      writeTransitionReceipt(root, receipt);
      return { ok: true, receipt };
    }

    const reconciliation = reconcileFeatureFiles(lineage.files, local, incoming);
    const fingerprint = fingerprintApplicationState(root, feature);
    const candidateDigest = candidateDigestFor(reconciliation.candidate, fingerprint.digest);
    const transitionId = transitionIdentity(feature, lineage.record.baseDigest, localStartDigest, incomingTransitionDigest);

    const rawObligations = deriveTransitionObligations({
      root,
      feature,
      base: lineage.files,
      local,
      incoming,
      candidate: reconciliation.candidate,
      conflicts: reconciliation.conflicts,
      officialDirectory,
    });

    const injected = { ...(options.injected ?? {}) };
    const packageDefault = defaultPackageEvidence(root, officialDirectory, options.injected);
    if (packageDefault && !injected['package-compat']) {
      injected['package-compat'] = packageDefault;
    }

    const evidence = evaluateTransitionEvidence({
      root,
      feature,
      candidate: reconciliation.candidate,
      candidateDigest,
      conflicts: reconciliation.conflicts,
      historyFixturePath: options.historyFixturePath,
      injected,
      skipExec: options.skipExec,
    });
    const obligations = resolveObligationStatuses(rawObligations, evidence);
    const { outcome, limitations } = aggregateOutcome(obligations, evidence);
    const historyFixtures = evidence
      .filter((item) => item.kind === 'migration-history' && item.fixture !== undefined)
      .map((item) => (item.fixture as { path: string; digest: string; historyIds: string[] }));
    const receipt: TransitionReceipt = {
      schemaVersion: 3,
      feature,
      transitionId,
      baseDigest: lineage.record.baseDigest,
      localStartDigest,
      incomingDigest,
      incomingTransitionDigest,
      candidateDigest,
      appFingerprint: fingerprint.digest,
      appInputs: fingerprint.inputs,
      historyFixtures,
      obligations,
      evidence,
      outcome,
      limitations,
      stale: false,
      acceptance: { state: 'unaccepted' },
    };
    writeTransitionReceipt(root, receipt);
    return { ok: true, receipt };
  } catch (error) {
    return commandError(feature, 'filesystem', `Could not plan a transition for "${feature}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function acceptTransition(options: { feature: string; cwd?: string; officialDirectory?: string }): AcceptTransitionOutcome {
  const root = path.resolve(options.cwd ?? process.cwd());
  const feature = options.feature;
  if (!featureNameIsValid(feature)) {
    return commandError(feature, 'invalid-name', `Invalid feature name "${feature}".`);
  }
  try {
    let receipt: TransitionReceipt | undefined;
    try {
      receipt = readCurrentTransition(root, feature);
    } catch (error) {
      return commandError(feature, 'no-transition', `No readable transition receipt for "${feature}": ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!receipt) {
      return commandError(feature, 'no-transition', `No transition has been planned for "${feature}". Plan a transition before accepting.`);
    }
    const officialDirectory = options.officialDirectory ?? resolveOfficialFeatureDirectory(feature);
    if (!existsSync(officialDirectory) || !statSync(officialDirectory).isDirectory()) {
      return commandError(feature, 'unknown-feature', `${feature} is application-owned and has no official upstream lineage.`);
    }
    const localDirectory = path.join(root, 'src', 'features', feature);
    if (!existsSync(localDirectory) || !statSync(localDirectory).isDirectory()) {
      return commandError(feature, 'missing-local', `Feature "${feature}" is not installed at ${localDirectory}.`);
    }
    const lineage = readFeatureLineage(root, feature);
    if (!lineage) {
      return commandError(feature, 'missing-lineage', `Cannot accept a transition for "${feature}": lineage is missing.`);
    }
    const local = readFeatureFiles(localDirectory);
    const incoming = readFeatureFiles(officialDirectory, false);
    const incomingDigest = digestFeatureFiles(incoming);
    const incomingTransitionDigest = digestIncomingTransition(officialDirectory, incoming);
    const localStartDigest = digestFeatureFiles(local);
    if (lineage.record.baseDigest !== receipt.baseDigest) {
      return commandError(feature, 'stale-candidate', `Stored transition ${receipt.transitionId} no longer matches BASE ${receipt.baseDigest.slice(0, 12)}. Re-evaluate before accepting.`);
    }
    if (incomingDigest !== receipt.incomingDigest) {
      return commandError(feature, 'stale-candidate', `Incoming Feature source changed after verification. Re-evaluate before accepting.`);
    }
    if (incomingTransitionDigest !== receipt.incomingTransitionDigest) {
      return commandError(feature, 'stale-candidate', `Incoming distribution inputs changed after verification. Re-evaluate before accepting.`);
    }
    if (localStartDigest !== receipt.localStartDigest) {
      return commandError(feature, 'stale-candidate', `Local Feature state changed after verification. Re-evaluate before accepting.`);
    }
    const reconciliation = reconcileFeatureFiles(lineage.files, local, incoming);
    const fingerprint = fingerprintApplicationState(root, feature);
    const currentCandidateDigest = candidateDigestFor(reconciliation.candidate, fingerprint.digest);
    if (currentCandidateDigest !== receipt.candidateDigest || isReceiptStale(receipt, currentCandidateDigest)) {
      return commandError(feature, 'stale-candidate', `Application state changed after verification (expected candidate ${receipt.candidateDigest.slice(0, 12)}, current ${currentCandidateDigest.slice(0, 12)}). Re-evaluate before accepting.`);
    }
    for (const recorded of receipt.historyFixtures) {
      if (!existsSync(recorded.path)) {
        return commandError(feature, 'stale-candidate', `Required history fixture ${recorded.path} is unavailable. Re-evaluate with a representative existing-history input before accepting.`);
      }
      const current = createHash('sha256').update(readFileSync(recorded.path)).digest('hex');
      if (current !== recorded.digest) {
        return commandError(feature, 'stale-candidate', `Required history fixture ${recorded.path} changed after verification. Re-evaluate before accepting.`);
      }
    }
    if (receipt.outcome !== 'VERIFIED') {
      return commandError(feature, 'not-verified', `Transition ${receipt.transitionId} is ${receipt.outcome}, not VERIFIED. Nara-managed acceptance requires a VERIFIED exact candidate.`);
    }
    const staleEvidence = receipt.evidence.filter((item) => item.candidateDigest !== receipt.candidateDigest);
    if (staleEvidence.length > 0) {
      return commandError(feature, 'stale-candidate', `Transition evidence is stale for candidate ${receipt.candidateDigest.slice(0, 12)}. Re-evaluate before accepting.`);
    }
    const unresolved = receipt.obligations.filter((obligation) => obligation.status !== 'verified');
    if (unresolved.length > 0) {
      return commandError(feature, 'not-verified', `Transition ${receipt.transitionId} has ${unresolved.length} unresolved obligation(s). Only VERIFIED transitions are eligible for acceptance; there is no force-verified path.`);
    }

    applyVerifiedCandidate(root, feature, reconciliation.candidate, incoming, incomingDigest, receipt.transitionId);
    const accepted: TransitionReceipt = {
      ...receipt,
      stale: false,
      acceptance: { state: 'accepted', candidateDigest: receipt.candidateDigest, transitionId: receipt.transitionId },
      acceptedTransition: receipt.transitionId,
    };
    writeTransitionReceipt(root, accepted);
    return { ok: true, receipt: accepted };
  } catch (error) {
    return commandError(feature, 'filesystem', `Could not accept the transition for "${feature}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function formatTransitionHuman(receipt: TransitionReceipt): string {
  const lines: string[] = [`Feature transition: ${receipt.feature}`, ''];
  lines.push(`Transition: ${receipt.transitionId}`);
  lines.push(`Candidate: ${receipt.candidateDigest.slice(0, 12)}`);
  lines.push(`Incoming transition inputs: ${receipt.incomingTransitionDigest.slice(0, 12)}`);
  lines.push(`Outcome: ${receipt.outcome}`);
  lines.push('');
  const open = receipt.obligations.filter((obligation) => obligation.status === 'open');
  const structural = receipt.obligations.filter((obligation) => obligation.status === 'structural-ok');
  const verified = receipt.obligations.filter((obligation) => obligation.status === 'verified');
  lines.push('Obligations:');
  if (receipt.obligations.length === 0) {
    lines.push('  none');
  } else {
    for (const obligation of receipt.obligations) {
      lines.push(`  [${obligation.status}] ${obligation.id} (${obligation.category})`);
      lines.push(`    ${obligation.reason}`);
      lines.push(`    Action: ${obligation.action}`);
    }
  }
  lines.push('');
  lines.push(`Open: ${open.length}, structurally resolved: ${structural.length}, verified: ${verified.length}`);
  lines.push('');
  lines.push('Evidence:');
  for (const item of receipt.evidence) {
    lines.push(`  [${item.status}] ${item.kind}: ${item.detail}`);
  }
  lines.push('');
  if (receipt.limitations.length > 0) {
    lines.push('Limitations:');
    for (const limitation of receipt.limitations) lines.push(`  - ${limitation}`);
    lines.push('');
  }
  lines.push('VERIFIED means verified against the named evidence and scope, not universally safe.');
  lines.push('It does not imply behavioral, operational, security, performance, or production-data safety.');
  lines.push('');
  if (receipt.outcome === 'VERIFIED' && receipt.acceptance.state !== 'accepted') {
    lines.push(`Candidate ${receipt.candidateDigest.slice(0, 12)} is VERIFIED and eligible for explicit acceptance.`);
    lines.push('');
  } else if (receipt.acceptance.state === 'accepted') {
    lines.push(`Candidate ${receipt.candidateDigest.slice(0, 12)} was explicitly accepted.`);
    lines.push('');
  } else if (receipt.outcome === 'BLOCKED') {
    lines.push('Candidate is BLOCKED: managed acceptance is refused until the blocking evidence is resolved.');
    lines.push('');
  } else {
    lines.push('Candidate is UNVERIFIED: managed acceptance is refused until required evidence is available.');
    lines.push('');
  }
  void os;
  return `${lines.join('\n')}\n`;
}
