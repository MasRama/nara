import { computeAffected, diffSnapshots, type ArchitectureChanges, type AffectedSet } from '../architecture/diff';
import {
  gitRepoRoot,
  materializeRef,
  removeTempDir,
  verifyGitRef,
} from '../architecture/git-materialize';
import { captureArchitectureSnapshot, type ArchitectureSnapshot } from '../architecture/snapshot';
import type { BoundaryExportEvidence } from '../architecture/discover-boundary-exports';
import type { FeatureImportEvidence } from '../architecture/discover-import-evidence';

export interface DiffBaseIdentity {
  kind: 'git-ref';
  ref: string;
  commit: string;
}

export interface DiffTargetRefIdentity {
  kind: 'git-ref';
  ref: string;
  commit: string;
}

export interface DiffTargetWorktreeIdentity {
  kind: 'working-tree';
}

export type DiffTargetIdentity = DiffTargetRefIdentity | DiffTargetWorktreeIdentity;

export interface ArchitectureDiffResult {
  schemaVersion: 1;
  base: DiffBaseIdentity;
  target: DiffTargetIdentity;
  changes: ArchitectureChanges;
  affected: AffectedSet;
}

export interface DiffOptions {
  base: string;
  head?: string;
  cwd?: string;
}

function targetDescription(target: DiffTargetIdentity): string {
  return target.kind === 'git-ref' ? target.ref : 'working tree';
}
function formatConsumerEvidence(evidence: FeatureImportEvidence): string {
  const boundary = evidence.boundary === undefined ? '' : ` [${evidence.boundary}]`;
  const usage =
    evidence.precision === 'symbol'
      ? `${evidence.importedSymbol} [${evidence.typeOnly ? 'type' : 'value'}]`
      : '(module import)';
  return `${evidence.from} -> ${evidence.to}${boundary}: ${usage} ${evidence.sourceFile}`;
}
function formatBoundaryExportProvenance(evidence: BoundaryExportEvidence): string {
  const syntax = evidence.typeOnly
    ? ' [type-only]'
    : evidence.kind === 'named-reexport'
      ? ' [value-capable syntax]'
      : '';
  if (evidence.kind === 'local') {
    return `${evidence.exportedName ?? '(unnamed)'} [local${evidence.typeOnly ? ', type-only' : ''}]`;
  }
  if (evidence.kind === 'default') {
    return `default [default export${evidence.typeOnly ? ', type-only' : ''}]`;
  }
  if (evidence.kind === 'export-all') {
    return `export * from ${evidence.sourceSpecifier ?? '(unknown module)'} [module${evidence.typeOnly ? ', type-only' : ''}]`;
  }
  return `${evidence.sourceSpecifier ?? '(unknown module)'}::${evidence.sourceSymbol ?? '(unknown symbol)'}${syntax}`;
}


export function runArchitectureDiff(options: DiffOptions): ArchitectureDiffResult {
  const cwd = options.cwd ?? process.cwd();
  const repoRoot = gitRepoRoot(cwd);
  const baseCommit = verifyGitRef(options.base, repoRoot);

  const tempDirs: string[] = [];
  try {
    const baseDir = materializeRef(options.base, repoRoot);
    tempDirs.push(baseDir);
    const baseSnapshot = captureArchitectureSnapshot(baseDir);

    let targetSnapshot: ArchitectureSnapshot;
    let target: DiffTargetIdentity;
    if (options.head !== undefined) {
      const headCommit = verifyGitRef(options.head, repoRoot);
      const headDir = materializeRef(options.head, repoRoot);
      tempDirs.push(headDir);
      targetSnapshot = captureArchitectureSnapshot(headDir);
      target = { kind: 'git-ref', ref: options.head, commit: headCommit };
    } else {
      // Working tree, including uncommitted source changes.
      targetSnapshot = captureArchitectureSnapshot(repoRoot);
      target = { kind: 'working-tree' };
    }

    const changes = diffSnapshots(baseSnapshot, targetSnapshot);
    const affected = computeAffected(changes, targetSnapshot);
    return {
      schemaVersion: 1,
      base: { kind: 'git-ref', ref: options.base, commit: baseCommit },
      target,
      changes,
      affected,
    };
  } finally {
    for (const directory of tempDirs) removeTempDir(directory);
  }
}

function section(lines: string[], title: string, body: string[]): void {
  if (body.length === 0) return;
  lines.push(`${title}:`);
  lines.push(...body);
}

export function formatDiffHuman(result: ArchitectureDiffResult): string {
  const targetDesc = targetDescription(result.target);
  const header = `Architecture changes (base ${result.base.ref} -> ${targetDesc}):`;
  const { changes, affected } = result;
  const empty =
    changes.features.added.length === 0 &&
    changes.features.removed.length === 0 &&
    changes.publicExports.length === 0 &&
    changes.webPublicExports.length === 0 &&
    changes.boundaryExportProvenance.length === 0 &&
    changes.contracts.length === 0 &&
    changes.dependencies.added.length === 0 &&
    changes.dependencies.removed.length === 0 &&
    changes.surfaces.length === 0 &&
    changes.integrations.applicationImports.added.length === 0 &&
    changes.integrations.applicationImports.removed.length === 0 &&
    changes.integrations.serverRoutes.added.length === 0 &&
    changes.integrations.serverRoutes.removed.length === 0 &&
    changes.integrations.webRoutes.added.length === 0 &&
    changes.integrations.webRoutes.removed.length === 0 &&
    changes.consumerEvidence.added.length === 0 &&
    changes.consumerEvidence.removed.length === 0 &&
    changes.removedPublicApiConsumers.length === 0 &&
    changes.diagnostics.added.length === 0 &&
    changes.diagnostics.resolved.length === 0;
  if (empty) {
    return (
      `No architecture changes detected (base ${result.base.ref} -> ${targetDesc}).\n` +
      `Structural dependency impact: none.\n`
    );
  }

  const lines: string[] = [header];
  const featureBody: string[] = [];
  for (const name of changes.features.added) featureBody.push(`  + ${name}`);
  for (const name of changes.features.removed) featureBody.push(`  - ${name}`);
  section(lines, 'Features', featureBody);

  const exportBody: string[] = [];
  for (const delta of changes.publicExports) {
    exportBody.push(`  ${delta.feature}:`);
    for (const name of delta.added) exportBody.push(`    + ${name}`);
    for (const name of delta.removed) exportBody.push(`    - ${name}`);
  }
  section(lines, 'Public exports', exportBody);
  const webExportBody: string[] = [];
  for (const delta of changes.webPublicExports) {
    webExportBody.push(`  ${delta.feature}:`);
    for (const name of delta.added) webExportBody.push(`    + ${name}`);
    for (const name of delta.removed) webExportBody.push(`    - ${name}`);
  }
  section(lines, 'Web public exports', webExportBody);

  const provenanceBody: string[] = [];
  for (const delta of changes.boundaryExportProvenance) {
    provenanceBody.push(`  ${delta.feature} [${delta.boundary}] ${delta.exportedName}:`);
    for (const evidence of delta.removed) {
      provenanceBody.push(`    - ${formatBoundaryExportProvenance(evidence)}`);
    }
    for (const evidence of delta.added) {
      provenanceBody.push(`    + ${formatBoundaryExportProvenance(evidence)}`);
    }
  }
  section(lines, 'Boundary export provenance changes', provenanceBody);
  const contractBody: string[] = [];
  for (const delta of changes.contracts) {
    contractBody.push(`  ${delta.feature}:`);
    for (const name of delta.added) contractBody.push(`    + ${name}`);
    for (const name of delta.removed) contractBody.push(`    - ${name}`);
  }
  section(lines, 'Contract exports', contractBody);

  const dependencyBody: string[] = [];
  for (const edge of changes.dependencies.added) dependencyBody.push(`  + ${edge.from} -> ${edge.to}`);
  for (const edge of changes.dependencies.removed) dependencyBody.push(`  - ${edge.from} -> ${edge.to}`);
  section(lines, 'Dependencies', dependencyBody);

  const surfaceBody: string[] = [];
  for (const delta of changes.surfaces) {
    surfaceBody.push(`  ${delta.feature} [${delta.kind}]:`);
    for (const file of delta.added) surfaceBody.push(`    + ${file}`);
    for (const file of delta.removed) surfaceBody.push(`    - ${file}`);
  }
  section(lines, 'Surfaces', surfaceBody);

  const integrationBodyByFeature = new Map<string, string[]>();
  function integrationLine(feature: string, line: string): void {
    const linesForFeature = integrationBodyByFeature.get(feature) ?? [];
    linesForFeature.push(line);
    integrationBodyByFeature.set(feature, linesForFeature);
  }
  for (const fact of changes.integrations.applicationImports.added) {
    const symbols = fact.symbols.length > 0 ? fact.symbols.join(', ') : '(module import)';
    integrationLine(fact.feature, `    + application import ${fact.appFile} [${fact.boundary}]: ${symbols}`);
  }
  for (const fact of changes.integrations.applicationImports.removed) {
    const symbols = fact.symbols.length > 0 ? fact.symbols.join(', ') : '(module import)';
    integrationLine(fact.feature, `    - application import ${fact.appFile} [${fact.boundary}]: ${symbols}`);
  }
  for (const route of changes.integrations.serverRoutes.added) {
    integrationLine(route.feature, `    + server route ${route.mountPath} via ${route.exportName}`);
  }
  for (const route of changes.integrations.serverRoutes.removed) {
    integrationLine(route.feature, `    - server route ${route.mountPath} via ${route.exportName}`);
  }
  for (const route of changes.integrations.webRoutes.added) {
    const name = route.name === undefined ? '' : ` (name: ${route.name})`;
    integrationLine(route.feature, `    + web route ${route.path} via ${route.exportName}${name}`);
  }
  for (const route of changes.integrations.webRoutes.removed) {
    const name = route.name === undefined ? '' : ` (name: ${route.name})`;
    integrationLine(route.feature, `    - web route ${route.path} via ${route.exportName}${name}`);
  }
  const integrationBody: string[] = [];
  for (const [feature, featureLines] of [...integrationBodyByFeature.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    integrationBody.push(`  ${feature}:`, ...featureLines);
  }
  section(lines, 'Application integration changes', integrationBody);
  const consumerBody: string[] = [];
  for (const evidence of changes.consumerEvidence.added) {
    consumerBody.push(`  + ${formatConsumerEvidence(evidence)}`);
  }
  for (const evidence of changes.consumerEvidence.removed) {
    consumerBody.push(`  - ${formatConsumerEvidence(evidence)}`);
  }
  section(lines, 'Consumer changes', consumerBody);

  const removedConsumerBody: string[] = [];
  for (const impact of changes.removedPublicApiConsumers) {
    removedConsumerBody.push(
      `  ${impact.feature} [${impact.boundary}] ${impact.symbol} (${impact.exportKind} export):`,
    );
    for (const consumer of impact.consumers) {
      removedConsumerBody.push(
        `    ${consumer.targetState}: ${consumer.from} — ${consumer.sourceFile} [${consumer.typeOnly ? 'type' : 'value'}]`,
      );
    }
  }
  section(lines, 'Removed public API consumer impact', removedConsumerBody);

  const newIssues = changes.diagnostics.added.map(
    (diagnostic) => `  + [${diagnostic.code}] ${diagnostic.file} (${diagnostic.relationship})`,
  );
  section(lines, 'New architecture issues', newIssues);
  const resolvedIssues = changes.diagnostics.resolved.map(
    (diagnostic) => `  - [${diagnostic.code}] ${diagnostic.file} (${diagnostic.relationship})`,
  );
  section(lines, 'Resolved architecture issues', resolvedIssues);

  lines.push('Structural dependency impact:');
  lines.push(
    `  Directly changed: ${affected.directlyChanged.length > 0 ? affected.directlyChanged.join(', ') : 'none'}`,
  );
  lines.push(`  Downstream: ${affected.downstream.length > 0 ? affected.downstream.join(', ') : 'none'}`);
  return `${lines.join('\n')}\n`;
}
