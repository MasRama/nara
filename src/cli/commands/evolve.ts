import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeAffected, diagnosticKey, diffSnapshots, type AffectedSet, type ArchitectureChanges } from '../architecture/diff';
import type { DoctorIssue } from '../architecture/doctor';
import { captureArchitectureSnapshotWithIssues, toPosix } from '../architecture/snapshot';
import { featureNameIsValid } from '../feature-name';
import { resolveOfficialFeatureDirectory } from '../package-root';
import { checkInstalledRequirements } from '../composition/requirements';
import {
  cleanupStagedLineage,
  digestFeatureFiles,
  featureFilesEqual,
  lineageDirectory,
  readFeatureFiles,
  readFeatureLineage,
  stageFeatureLineage,
  type FeatureLineageSnapshot,
  type StagedLineage,
} from '../evolution/lineage';
import {
  reconcileFeatureFiles,
  writeFeatureMap,
  type EvolutionFileAction,
  type ReconciledFile,
} from '../evolution/reconcile';

export type FeatureEvolutionStatus =
  | 'dry-run'
  | 'ready'
  | 'applied'
  | 'up-to-date'
  | 'bootstrapped'
  | 'conflict'
  | 'architecture-regression';

export interface FeatureEvolutionFile {
  path: string;
  action: EvolutionFileAction;
  reason: string;
}

export interface FeatureEvolutionArchitecture {
  changes: ArchitectureChanges;
  affected: AffectedSet;
  introducedDiagnostics: DoctorIssue[];
}

export interface FeatureEvolutionPlan {
  schemaVersion: 1;
  feature: string;
  status: FeatureEvolutionStatus;
  lineage: {
    baseDigest: string;
    incomingDigest: string;
  };
  files: FeatureEvolutionFile[];
  conflicts: string[];
  canApply: boolean;
  applied: boolean;
  architecture?: FeatureEvolutionArchitecture;
  requirementsNotice?: string[];
}

export type FeatureEvolutionErrorCode =
  | 'invalid-name'
  | 'unknown-feature'
  | 'missing-local'
  | 'missing-lineage'
  | 'lineage-error'
  | 'filesystem';

export interface FeatureEvolutionErrorReport {
  schemaVersion: 1;
  feature: string;
  status: 'error';
  errorCode: FeatureEvolutionErrorCode;
  message: string;
  canApply: false;
}

export interface EvolveFeatureOptions {
  feature: string;
  cwd?: string;
  dryRun?: boolean;
  officialDirectory?: string;
}

export type EvolveFeatureOutcome =
  | { ok: true; plan: FeatureEvolutionPlan }
  | { ok: false; error: FeatureEvolutionErrorReport };

function evolutionError(
  feature: string,
  errorCode: FeatureEvolutionErrorCode,
  message: string,
): { ok: false; error: FeatureEvolutionErrorReport } {
  return {
    ok: false,
    error: { schemaVersion: 1, feature, status: 'error', errorCode, message, canApply: false },
  };
}

function planFiles(files: ReconciledFile[]): FeatureEvolutionFile[] {
  return files.map(({ path: relativePath, action, reason }) => ({ path: relativePath, action, reason }));
}

function issueIdentity(issue: DoctorIssue, root: string): string {
  const file = path.isAbsolute(issue.file) ? toPosix(path.relative(root, issue.file)) : toPosix(issue.file);
  return diagnosticKey({ code: issue.code, file, relationship: issue.relationship });
}

function candidateProject(root: string, feature: string, files: ReadonlyMap<string, Buffer>): string {
  const candidateRoot = mkdtempSync(path.join(os.tmpdir(), 'nara-evolve-candidate-'));
  try {
    const sourceRoot = path.join(root, 'src');
    const candidateSourceRoot = path.join(candidateRoot, 'src');
    if (existsSync(sourceRoot)) cpSync(sourceRoot, candidateSourceRoot, { recursive: true });
    else mkdirSync(candidateSourceRoot, { recursive: true });
    const candidateFeature = path.join(candidateSourceRoot, 'features', feature);
    rmSync(candidateFeature, { recursive: true, force: true });
    writeFeatureMap(files, candidateFeature);
    return candidateRoot;
  } catch (error) {
    rmSync(candidateRoot, { recursive: true, force: true });
    throw error;
  }
}

function architectureValidation(
  root: string,
  feature: string,
  files: ReadonlyMap<string, Buffer>,
): { architecture: FeatureEvolutionArchitecture; candidateRoot: string } {
  const candidateRoot = candidateProject(root, feature, files);
  try {
    const current = captureArchitectureSnapshotWithIssues(root);
    const candidate = captureArchitectureSnapshotWithIssues(candidateRoot);
    const currentIssues = new Set(current.issues.map((issue) => issueIdentity(issue, root)));
    const introducedDiagnostics = candidate.issues.filter(
      (issue) => !currentIssues.has(issueIdentity(issue, candidateRoot)),
    );
    const changes = diffSnapshots(current.snapshot, candidate.snapshot);
    return {
      candidateRoot,
      architecture: {
        changes,
        affected: computeAffected(changes, candidate.snapshot),
        introducedDiagnostics,
      },
    };
  } catch (error) {
    rmSync(candidateRoot, { recursive: true, force: true });
    throw error;
  }
}

function stageFeatureTree(
  root: string,
  feature: string,
  files: ReadonlyMap<string, Buffer>,
): { directory: string; targetDirectory: string } {
  const targetDirectory = path.resolve(root, 'src', 'features', feature);
  const parent = path.dirname(targetDirectory);
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(path.join(parent, '.nara-evolve-feature-'));
  try {
    writeFeatureMap(files, directory);
    return { directory, targetDirectory };
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function applyStagedLineage(staged: StagedLineage): void {
  if (existsSync(staged.targetDirectory)) throw new Error(`Lineage already exists at ${staged.targetDirectory}.`);
  renameSync(staged.directory, staged.targetDirectory);
}

function applyEvolutionTransaction(
  root: string,
  feature: string,
  candidate: ReadonlyMap<string, Buffer>,
  incoming: ReadonlyMap<string, Buffer>,
  incomingDigest: string,
): void {
  const featureStage = stageFeatureTree(root, feature, candidate);
  let stagedLineage: StagedLineage | undefined;
  let featureBackedUp = false;
  let lineageBackedUp = false;
  let featureReplaced = false;
  let lineageReplaced = false;
  const targetLineage = lineageDirectory(root, feature);
  const featureToken = path.basename(featureStage.directory).replace('.nara-evolve-feature-', '');
  const featureBackup = path.join(path.dirname(featureStage.targetDirectory), `.nara-evolve-backup-${featureToken}`);
  const lineageBackup = path.join(path.dirname(targetLineage), `.nara-lineage-backup-${featureToken}`);
  try {
    stagedLineage = stageFeatureLineage(root, feature, incoming, incomingDigest);
    if (existsSync(featureBackup) || existsSync(lineageBackup)) {
      throw new Error(`Evolution transaction backup already exists for "${feature}".`);
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

function bootstrapLineage(
  root: string,
  feature: string,
  incoming: ReadonlyMap<string, Buffer>,
  incomingDigest: string,
  dryRun: boolean,
): boolean {
  if (dryRun) return false;
  const staged = stageFeatureLineage(root, feature, incoming, incomingDigest);
  try {
    applyStagedLineage(staged);
    return true;
  } catch (error) {
    cleanupStagedLineage(staged);
    throw error;
  }
}
function buildPlan(
  feature: string,
  status: FeatureEvolutionStatus,
  baseDigest: string,
  incomingDigest: string,
  files: ReconciledFile[],
  conflicts: string[],
  canApply: boolean,
  applied: boolean,
  architecture?: FeatureEvolutionArchitecture,
  requirementsNotice?: string[],
): FeatureEvolutionPlan {
  return {
    schemaVersion: 1,
    feature,
    status,
    lineage: { baseDigest, incomingDigest },
    files: planFiles(files),
    conflicts: [...conflicts].sort(),
    canApply,
    applied,
    architecture,
    ...(requirementsNotice !== undefined && requirementsNotice.length > 0 ? { requirementsNotice } : {}),
  };
}

export function evolveFeature(options: EvolveFeatureOptions): EvolveFeatureOutcome {
  const root = path.resolve(options.cwd ?? process.cwd());
  const feature = options.feature;
  if (!featureNameIsValid(feature)) {
    return evolutionError(
      feature,
      'invalid-name',
      `Invalid feature name "${feature}". Use lowercase letters, numbers, and single hyphens; start with a letter.`,
    );
  }

  try {
    const officialDirectory = options.officialDirectory ?? resolveOfficialFeatureDirectory(feature);
    if (!existsSync(officialDirectory) || !statSync(officialDirectory).isDirectory()) {
      return evolutionError(
        feature,
        'unknown-feature',
        `${feature} is application-owned and has no official upstream lineage.`,
      );
    }
    const localDirectory = path.join(root, 'src', 'features', feature);
    if (!existsSync(localDirectory) || !statSync(localDirectory).isDirectory()) {
      return evolutionError(feature, 'missing-local', `Feature "${feature}" is not installed at ${localDirectory}.`);
    }
    const local = readFeatureFiles(localDirectory);
    const incoming = readFeatureFiles(officialDirectory, false);
    const incomingDigest = digestFeatureFiles(incoming);
    const requirementsNotice = checkInstalledRequirements(root, feature, officialDirectory);
    let lineage: FeatureLineageSnapshot | undefined;
    try {
      lineage = readFeatureLineage(root, feature);
    } catch (error) {
      return evolutionError(
        feature,
        'lineage-error',
        `Cannot evolve "${feature}": stored official lineage is invalid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (lineage === undefined) {
      if (!featureFilesEqual(local, incoming)) {
        return evolutionError(
          feature,
          'missing-lineage',
          `Cannot evolve "${feature}": Nara cannot prove the historical official base because lineage is missing. The local Feature differs from the current official source; no files were changed.`,
        );
      }
      const files: ReconciledFile[] = [...incoming.keys()]
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
        .map((relativePath) => ({
          path: relativePath,
          action: 'unchanged',
          reason: 'local Feature is identical to the current official source',
          content: incoming.get(relativePath),
        }));
      const applied = bootstrapLineage(root, feature, incoming, incomingDigest, options.dryRun === true);
      return {
        ok: true,
        plan: buildPlan(
          feature,
          applied ? 'bootstrapped' : 'dry-run',
          incomingDigest,
          incomingDigest,
          files,
          [],
          true,
          applied,
          undefined,
          requirementsNotice,
        ),
      };
    }

    const baseDigest = lineage.record.baseDigest;
    const reconciliation = reconcileFeatureFiles(lineage.files, local, incoming);
    if (baseDigest === incomingDigest) {
      return {
        ok: true,
        plan: buildPlan(feature, 'up-to-date', baseDigest, incomingDigest, reconciliation.files, [], false, false, undefined, requirementsNotice),
      };
    }
    if (reconciliation.conflicts.length > 0) {
      return {
        ok: true,
        plan: buildPlan(
          feature,
          'conflict',
          baseDigest,
          incomingDigest,
          reconciliation.files,
          reconciliation.conflicts,
          false,
          false,
          undefined,
          requirementsNotice,
        ),
      };
    }

    const validation = architectureValidation(root, feature, reconciliation.candidate);
    const architecture = validation.architecture;
    const canApply = architecture.introducedDiagnostics.length === 0;
    if (!canApply) {
      rmSync(validation.candidateRoot, { recursive: true, force: true });
      return {
        ok: true,
        plan: buildPlan(
          feature,
          'architecture-regression',
          baseDigest,
          incomingDigest,
          reconciliation.files,
          [],
          false,
          false,
          architecture,
          requirementsNotice,
        ),
      };
    }

    const plan = buildPlan(
      feature,
      options.dryRun === true ? 'dry-run' : 'ready',
      baseDigest,
      incomingDigest,
      reconciliation.files,
      [],
      true,
      false,
      architecture,
      requirementsNotice,
    );
    if (options.dryRun === true) {
      rmSync(validation.candidateRoot, { recursive: true, force: true });
      return { ok: true, plan };
    }

    try {
      applyEvolutionTransaction(root, feature, reconciliation.candidate, incoming, incomingDigest);
    } finally {
      rmSync(validation.candidateRoot, { recursive: true, force: true });
    }
    plan.status = 'applied';
    plan.applied = true;
    return { ok: true, plan };
  } catch (error) {
    return evolutionError(
      feature,
      'filesystem',
      `Could not evolve feature "${feature}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function section(lines: string[], title: string, entries: string[]): void {
  lines.push(`${title}:`);
  lines.push(...(entries.length === 0 ? ['  none'] : entries));
  lines.push('');
}

function architectureSummary(architecture: FeatureEvolutionArchitecture): string[] {
  const lines: string[] = [];
  const changes = architecture.changes;
  const featureChanges = [...changes.features.added.map((name) => `+ ${name}`), ...changes.features.removed.map((name) => `- ${name}`)];
  if (featureChanges.length > 0) lines.push(`  Features: ${featureChanges.join(', ')}`);
  if (changes.publicExports.length > 0) lines.push(`  Public exports changed: ${changes.publicExports.map((delta) => delta.feature).join(', ')}`);
  if (changes.webPublicExports.length > 0) lines.push(`  Web exports changed: ${changes.webPublicExports.map((delta) => delta.feature).join(', ')}`);
  if (changes.contracts.length > 0) lines.push(`  Contracts changed: ${changes.contracts.map((delta) => delta.feature).join(', ')}`);
  if (changes.dependencies.added.length > 0 || changes.dependencies.removed.length > 0) {
    lines.push(`  Dependencies changed: +${changes.dependencies.added.length} / -${changes.dependencies.removed.length}`);
  }
  if (changes.surfaces.length > 0) lines.push(`  Surfaces changed: ${changes.surfaces.length}`);
  if (changes.consumerEvidence.added.length > 0 || changes.consumerEvidence.removed.length > 0) {
    lines.push(`  Consumer evidence changed: +${changes.consumerEvidence.added.length} / -${changes.consumerEvidence.removed.length}`);
  }
  if (changes.integrations.applicationImports.added.length > 0 || changes.integrations.applicationImports.removed.length > 0) {
    lines.push('  Application imports changed.');
  }
  if (changes.integrations.serverRoutes.added.length > 0 || changes.integrations.serverRoutes.removed.length > 0) {
    lines.push('  Server routes changed.');
  }
  if (changes.integrations.webRoutes.added.length > 0 || changes.integrations.webRoutes.removed.length > 0) {
    lines.push('  Web routes changed.');
  }
  if (architecture.affected.directlyChanged.length > 0) {
    lines.push(`  Directly changed: ${architecture.affected.directlyChanged.join(', ')}`);
  }
  if (architecture.affected.downstream.length > 0) {
    lines.push(`  Downstream: ${architecture.affected.downstream.join(', ')}`);
  }
  if (lines.length === 0) lines.push('  none');
  return lines;
}

function fileSectionEntries(files: FeatureEvolutionFile[], actions: EvolutionFileAction[], marker: string): string[] {
  return files
    .filter((file) => actions.includes(file.action))
    .map((file) => `  ${marker} ${file.path}`);
}

export function formatEvolutionHuman(outcome: EvolveFeatureOutcome): string {
  if (!outcome.ok) return `${outcome.error.message}\n`;
  const { plan } = outcome;
  const lines = [`Feature evolution: ${plan.feature}`, ''];
  if (plan.status === 'up-to-date') {
    lines.push('Official upstream has not changed.', '');
  } else if (plan.status === 'bootstrapped') {
    lines.push('Lineage adopted from the identical official source.', '');
  }

  section(lines, 'Upstream changes', [
    ...fileSectionEntries(plan.files, ['update'], '~'),
    ...fileSectionEntries(plan.files, ['add'], '+'),
    ...fileSectionEntries(plan.files, ['remove'], '-'),
  ]);
  section(lines, 'Local changes preserved', fileSectionEntries(plan.files, ['keep-local'], '='));
  section(lines, 'Merged', fileSectionEntries(plan.files, ['merge'], '~'));
  section(lines, 'Conflicts', plan.conflicts.map((relativePath) => `  ! ${relativePath}`));

  if (plan.architecture) {
    section(lines, 'Architecture changes', architectureSummary(plan.architecture));
    if (plan.architecture.introducedDiagnostics.length > 0) {
      lines.push('Architecture regression:');
      for (const issue of plan.architecture.introducedDiagnostics) {
        lines.push(`  - [${issue.code}] ${issue.file} (${issue.relationship})`);
      }
      lines.push('');
    }
  }

  if (plan.requirementsNotice && plan.requirementsNotice.length > 0) {
    lines.push('Requirements notice:');
    for (const notice of plan.requirementsNotice) {
      lines.push(`  ! ${notice}`);
    }
    lines.push('');
  }

  if (plan.status === 'conflict') {
    lines.push('Cannot apply: unresolved merge conflicts.', '');
  } else if (plan.status === 'architecture-regression') {
    lines.push('Cannot apply: evolution introduces new architecture diagnostics.', '');
  } else if (plan.status === 'dry-run') {
    lines.push('Safe to apply.', '');
  } else if (plan.status === 'bootstrapped') {
    lines.push('Lineage bootstrapped.', '');
  } else if (plan.status === 'ready') {
    lines.push('Safe to apply.', '');
  } else if (plan.status === 'applied') {
    lines.push('Evolution applied safely.', '');
  }
  return `${lines.join('\n')}\n`;
}
