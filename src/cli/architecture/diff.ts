import type { ArchitectureSnapshot, SnapshotDiagnostic, SnapshotEdge } from './snapshot';
import type {
  ApplicationFeatureImport,
  FeatureIntegrationFacts,
  ServerRouteIntegration,
  WebRouteIntegration,
} from './discover-integrations';
import {
  compareBoundaryExportEvidence,
  directlyReexportedContractSymbol,
  type BoundaryExportEvidence,
} from './discover-boundary-exports';
import type { FeatureBoundary, FeatureImportEvidence } from './discover-import-evidence';

export interface ExportDelta {
  feature: string;
  added: string[];
  removed: string[];
}

export interface BoundaryExportProvenanceDelta {
  feature: string;
  boundary: FeatureBoundary;
  exportedName: string;
  added: BoundaryExportEvidence[];
  removed: BoundaryExportEvidence[];
}

export type RemovedConsumerTargetState = 'still-imported' | 'removed-in-change';

export type RemovedConsumerEvidence = FeatureImportEvidence & {
  targetState: RemovedConsumerTargetState;
};

export interface RemovedPublicApiConsumerImpact {
  feature: string;
  boundary: FeatureBoundary;
  symbol: string;
  exportKind: 'public' | 'web' | 'contract';
  change: 'removed';
  consumers: RemovedConsumerEvidence[];
}

export interface SurfaceDelta {
  feature: string;
  kind: 'server' | 'web' | 'test';
  added: string[];
  removed: string[];
}

export interface DependencyDelta {
  from: string;
  to: string;
  imports: string[];
  sourceFiles: string[];
}

export type DiagnosticDelta = SnapshotDiagnostic;

export interface IntegrationDelta<T> {
  added: T[];
  removed: T[];
}

export interface IntegrationChanges {
  applicationImports: IntegrationDelta<ApplicationFeatureImport>;
  serverRoutes: IntegrationDelta<ServerRouteIntegration>;
  webRoutes: IntegrationDelta<WebRouteIntegration>;
}

export interface ArchitectureChanges {
  features: { added: string[]; removed: string[] };
  publicExports: ExportDelta[];
  webPublicExports: ExportDelta[];
  boundaryExportProvenance: BoundaryExportProvenanceDelta[];
  contracts: ExportDelta[];
  dependencies: { added: DependencyDelta[]; removed: DependencyDelta[] };
  surfaces: SurfaceDelta[];
  integrations: IntegrationChanges;
  consumerEvidence: IntegrationDelta<FeatureImportEvidence>;
  removedPublicApiConsumers: RemovedPublicApiConsumerImpact[];
  diagnostics: { added: DiagnosticDelta[]; resolved: DiagnosticDelta[] };
}

export interface AffectedSet {
  scope: 'structural dependency impact';
  directlyChanged: string[];
  downstream: string[];
  all: string[];
}

function addedRemoved(base: string[], target: string[]): { added: string[]; removed: string[] } {
  const baseSet = new Set(base);
  const targetSet = new Set(target);
  return {
    added: target.filter((value) => !baseSet.has(value)).sort(),
    removed: base.filter((value) => !targetSet.has(value)).sort(),
  };
}

function edgeKey(edge: { from: string; to: string }): string {
  return `${edge.from}\0${edge.to}`;
}

export function diagnosticKey(diagnostic: { code: string; file: string; relationship: string }): string {
  return `${diagnostic.code}\0${diagnostic.file}\0${diagnostic.relationship}`;
}

function featureNameFromFile(file: string): string | undefined {
  const match = /^src\/features\/([^/]+)\//.exec(file);
  return match?.[1];
}

function emptyIntegrationFacts(): FeatureIntegrationFacts {
  return { applicationImports: [], serverRoutes: [], webRoutes: [] };
}

function compareApplicationImports(left: ApplicationFeatureImport, right: ApplicationFeatureImport): number {
  return (
    left.feature.localeCompare(right.feature) ||
    left.appFile.localeCompare(right.appFile) ||
    left.boundary.localeCompare(right.boundary) ||
    left.symbols.join('\0').localeCompare(right.symbols.join('\0'))
  );
}

function compareServerRoutes(left: ServerRouteIntegration, right: ServerRouteIntegration): number {
  return (
    left.feature.localeCompare(right.feature) ||
    left.appFile.localeCompare(right.appFile) ||
    left.mountPath.localeCompare(right.mountPath) ||
    left.exportName.localeCompare(right.exportName)
  );
}

function compareWebRoutes(left: WebRouteIntegration, right: WebRouteIntegration): number {
  return (
    left.feature.localeCompare(right.feature) ||
    left.appFile.localeCompare(right.appFile) ||
    left.path.localeCompare(right.path) ||
    (left.name ?? '').localeCompare(right.name ?? '') ||
    left.exportName.localeCompare(right.exportName)
  );
}
function compareFeatureImportEvidence(left: FeatureImportEvidence, right: FeatureImportEvidence): number {
  return (
    left.from.localeCompare(right.from) ||
    left.to.localeCompare(right.to) ||
    (left.boundary ?? '').localeCompare(right.boundary ?? '') ||
    left.sourceFile.localeCompare(right.sourceFile) ||
    left.specifier.localeCompare(right.specifier) ||
    left.kind.localeCompare(right.kind) ||
    left.precision.localeCompare(right.precision) ||
    (left.importedSymbol ?? '').localeCompare(right.importedSymbol ?? '') ||
    (left.localName ?? '').localeCompare(right.localName ?? '') ||
    (left.exportedName ?? '').localeCompare(right.exportedName ?? '') ||
    Number(left.typeOnly) - Number(right.typeOnly)
  );
}

function featureImportEvidenceKey(evidence: FeatureImportEvidence): string {
  return JSON.stringify([
    evidence.from,
    evidence.to,
    evidence.sourceFile,
    evidence.specifier,
    evidence.boundary ?? null,
    evidence.usesInternalPath,
    evidence.kind,
    evidence.precision,
    evidence.importedSymbol ?? null,
    evidence.localName ?? null,
    evidence.exportedName ?? null,
    evidence.typeOnly,
  ]);
}

function consumerIdentityKey(evidence: FeatureImportEvidence): string {
  return JSON.stringify([
    evidence.from,
    evidence.to,
    evidence.sourceFile,
    evidence.boundary ?? null,
    evidence.precision,
    evidence.importedSymbol ?? null,
    evidence.typeOnly,
  ]);
}
function boundaryEvidenceFor(
  feature: ArchitectureSnapshot['features'][number],
  boundary: FeatureBoundary,
): BoundaryExportEvidence[] {
  return feature.boundaryExports?.[boundary] ?? [];
}

function boundaryExportProvenanceKey(evidence: BoundaryExportEvidence): string {
  return JSON.stringify([
    evidence.kind,
    evidence.precision,
    evidence.sourceSpecifier ?? null,
    evidence.sourceSymbol ?? null,
    evidence.typeOnly,
  ]);
}

function boundaryExportProvenanceDeltas(
  baseFeature: ArchitectureSnapshot['features'][number],
  targetFeature: ArchitectureSnapshot['features'][number],
  boundary: FeatureBoundary,
): BoundaryExportProvenanceDelta[] {
  const baseByName = new Map<string, BoundaryExportEvidence[]>();
  const targetByName = new Map<string, BoundaryExportEvidence[]>();
  for (const evidence of boundaryEvidenceFor(baseFeature, boundary)) {
    if (evidence.exportedName === undefined) continue;
    const entries = baseByName.get(evidence.exportedName) ?? [];
    entries.push(evidence);
    baseByName.set(evidence.exportedName, entries);
  }
  for (const evidence of boundaryEvidenceFor(targetFeature, boundary)) {
    if (evidence.exportedName === undefined) continue;
    const entries = targetByName.get(evidence.exportedName) ?? [];
    entries.push(evidence);
    targetByName.set(evidence.exportedName, entries);
  }

  const deltas: BoundaryExportProvenanceDelta[] = [];
  for (const exportedName of [...baseByName.keys()].filter((name) => targetByName.has(name)).sort()) {
    const baseEntries = baseByName.get(exportedName) ?? [];
    const targetEntries = targetByName.get(exportedName) ?? [];
    const baseKeys = new Set(baseEntries.map(boundaryExportProvenanceKey));
    const targetKeys = new Set(targetEntries.map(boundaryExportProvenanceKey));
    const removed = baseEntries
      .filter((evidence) => !targetKeys.has(boundaryExportProvenanceKey(evidence)))
      .sort(compareBoundaryExportEvidence);
    const added = targetEntries
      .filter((evidence) => !baseKeys.has(boundaryExportProvenanceKey(evidence)))
      .sort(compareBoundaryExportEvidence);
    if (added.length > 0 || removed.length > 0) {
      deltas.push({ feature: baseFeature.name, boundary, exportedName, added, removed });
    }
  }
  return deltas;
}

function contractBoundarySymbols(
  boundaryExports: BoundaryExportEvidence[],
  contractSymbol: string,
): string[] {
  return [
    ...new Set(
      boundaryExports
        .filter(
          (evidence) =>
            evidence.exportedName !== undefined &&
            directlyReexportedContractSymbol(evidence) === contractSymbol,
        )
        .map((evidence) => evidence.exportedName as string),
    ),
  ].sort();
}


function removedConsumerImpact(
  baseEvidence: FeatureImportEvidence[],
  targetEvidence: FeatureImportEvidence[],
  feature: string,
  boundary: FeatureBoundary,
  consumerSymbols: string[],
  impactSymbol: string,
  exportKind: RemovedPublicApiConsumerImpact['exportKind'],
): RemovedPublicApiConsumerImpact | undefined {
  const symbols = new Set(consumerSymbols);
  const baseline = baseEvidence.filter(
    (evidence) =>
      evidence.to === feature &&
      evidence.boundary === boundary &&
      evidence.precision === 'symbol' &&
      evidence.importedSymbol !== undefined &&
      symbols.has(evidence.importedSymbol),
  );
  if (baseline.length === 0) {
    return undefined;
  }

  const targetIdentities = new Set(
    targetEvidence
      .filter(
        (evidence) =>
          evidence.to === feature &&
          evidence.boundary === boundary &&
          evidence.precision === 'symbol' &&
          evidence.importedSymbol !== undefined &&
          symbols.has(evidence.importedSymbol),
      )
      .map(consumerIdentityKey),
  );
  const seen = new Set<string>();
  const consumers: RemovedConsumerEvidence[] = [];
  for (const evidence of baseline.sort(compareFeatureImportEvidence)) {
    const identity = consumerIdentityKey(evidence);
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    consumers.push({
      ...evidence,
      targetState: targetIdentities.has(identity) ? 'still-imported' : 'removed-in-change',
    });
  }

  return {
    feature,
    boundary,
    symbol: impactSymbol,
    exportKind,
    change: 'removed',
    consumers,
  };
}

function removedContractConsumerImpact(
  baseEvidence: FeatureImportEvidence[],
  targetEvidence: FeatureImportEvidence[],
  boundaryExports: BoundaryExportEvidence[],
  feature: string,
  boundary: FeatureBoundary,
  contractSymbol: string,
): RemovedPublicApiConsumerImpact | undefined {
  const publicSymbols = contractBoundarySymbols(
    boundaryExports.filter((evidence) => evidence.boundary === boundary),
    contractSymbol,
  );
  if (publicSymbols.length === 0) {
    return undefined;
  }
  return removedConsumerImpact(
    baseEvidence,
    targetEvidence,
    feature,
    boundary,
    publicSymbols,
    contractSymbol,
    'contract',
  );
}

function sortRemovedConsumerImpacts(impacts: RemovedPublicApiConsumerImpact[]): void {
  impacts.sort(
    (left, right) =>
      left.feature.localeCompare(right.feature) ||
      left.boundary.localeCompare(right.boundary) ||
      left.symbol.localeCompare(right.symbol) ||
      left.exportKind.localeCompare(right.exportKind),
  );
  for (const impact of impacts) {
    impact.consumers.sort(compareFeatureImportEvidence);
  }
}


function integrationDelta<T>(
  base: T[],
  target: T[],
  key: (value: T) => string,
  compare: (left: T, right: T) => number,
): IntegrationDelta<T> {
  const baseByKey = new Map(base.map((value) => [key(value), value]));
  const targetByKey = new Map(target.map((value) => [key(value), value]));
  const added = [...targetByKey.values()].filter((value) => !baseByKey.has(key(value))).sort(compare);
  const removed = [...baseByKey.values()].filter((value) => !targetByKey.has(key(value))).sort(compare);
  return { added, removed };
}

export function diffSnapshots(base: ArchitectureSnapshot, target: ArchitectureSnapshot): ArchitectureChanges {
  const baseNames = new Set(base.features.map((feature) => feature.name));
  const targetNames = new Set(target.features.map((feature) => feature.name));
  const added = [...targetNames].filter((name) => !baseNames.has(name)).sort();
  const removed = [...baseNames].filter((name) => !targetNames.has(name)).sort();

  const baseByName = new Map(base.features.map((feature) => [feature.name, feature]));
  const targetByName = new Map(target.features.map((feature) => [feature.name, feature]));
  // Export, contract, and surface deltas cover features present on both
  // sides. Added/removed Features already imply their full boundary; the
  // snapshot retains the details.
  const common = [...baseNames].filter((name) => targetNames.has(name)).sort();

  const publicExports: ExportDelta[] = [];
  const webPublicExports: ExportDelta[] = [];
  const boundaryExportProvenance: BoundaryExportProvenanceDelta[] = [];
  const contracts: ExportDelta[] = [];
  const surfaces: SurfaceDelta[] = [];
  for (const name of common) {
    const left = baseByName.get(name);
    const right = targetByName.get(name);
    if (!left || !right) continue;
    const exports = addedRemoved(left.publicExports, right.publicExports);
    if (exports.added.length > 0 || exports.removed.length > 0) {
      publicExports.push({ feature: name, ...exports });
    }
    const webExports = addedRemoved(left.webPublicExports, right.webPublicExports);
    if (webExports.added.length > 0 || webExports.removed.length > 0) {
      webPublicExports.push({ feature: name, ...webExports });
    }
    boundaryExportProvenance.push(...boundaryExportProvenanceDeltas(left, right, 'public'));
    boundaryExportProvenance.push(...boundaryExportProvenanceDeltas(left, right, 'web'));
    const contract = addedRemoved(left.contractExports, right.contractExports);
    if (contract.added.length > 0 || contract.removed.length > 0) {
      contracts.push({ feature: name, ...contract });
    }
    const kinds = [
      ['server', left.serverSurfaces, right.serverSurfaces],
      ['web', left.webSurfaces, right.webSurfaces],
      ['test', left.testSurfaces, right.testSurfaces],
    ] as const;
    for (const [kind, leftSurfaces, rightSurfaces] of kinds) {
      const delta = addedRemoved(leftSurfaces, rightSurfaces);
      if (delta.added.length > 0 || delta.removed.length > 0) {
        surfaces.push({ feature: name, kind, ...delta });
      }
    }
  }

  const baseEdges = new Map(base.dependencies.map((edge) => [edgeKey(edge), edge]));
  const targetEdges = new Map(target.dependencies.map((edge) => [edgeKey(edge), edge]));
  const dependencyAdded: DependencyDelta[] = [];
  const dependencyRemoved: DependencyDelta[] = [];
  for (const [key, edge] of targetEdges) {
    if (!baseEdges.has(key)) {
      dependencyAdded.push({
        from: edge.from,
        to: edge.to,
        imports: [...edge.imports].sort(),
        sourceFiles: [...edge.sourceFiles].sort(),
      });
    }
  }
  for (const [key, edge] of baseEdges) {
    if (!targetEdges.has(key)) {
      dependencyRemoved.push({
        from: edge.from,
        to: edge.to,
        imports: [...edge.imports].sort(),
        sourceFiles: [...edge.sourceFiles].sort(),
      });
    }
  }
  dependencyAdded.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  dependencyRemoved.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  const integrations: IntegrationChanges = {
    applicationImports: { added: [], removed: [] },
    serverRoutes: { added: [], removed: [] },
    webRoutes: { added: [], removed: [] },
  };
  const integrationNames = [...new Set([...baseNames, ...targetNames])].sort();
  for (const name of integrationNames) {
    const left = baseByName.get(name)?.integrations ?? emptyIntegrationFacts();
    const right = targetByName.get(name)?.integrations ?? emptyIntegrationFacts();
    const applicationImports = integrationDelta(
      left.applicationImports,
      right.applicationImports,
      (fact) => JSON.stringify([fact.feature, fact.appFile, fact.boundary, fact.symbols]),
      compareApplicationImports,
    );
    const serverRoutes = integrationDelta(
      left.serverRoutes,
      right.serverRoutes,
      (route) => JSON.stringify([route.feature, route.appFile, route.exportName, route.mountPath]),
      compareServerRoutes,
    );
    const webRoutes = integrationDelta(
      left.webRoutes,
      right.webRoutes,
      (route) => JSON.stringify([route.feature, route.appFile, route.exportName, route.path, route.name ?? null]),
      compareWebRoutes,
    );
    integrations.applicationImports.added.push(...applicationImports.added);
    integrations.applicationImports.removed.push(...applicationImports.removed);
    integrations.serverRoutes.added.push(...serverRoutes.added);
    integrations.serverRoutes.removed.push(...serverRoutes.removed);
    integrations.webRoutes.added.push(...webRoutes.added);
    integrations.webRoutes.removed.push(...webRoutes.removed);
  }

  const baseImportEvidence = base.importEvidence;
  const targetImportEvidence = target.importEvidence;
  const consumerEvidence = integrationDelta(
    baseImportEvidence,
    targetImportEvidence,
    featureImportEvidenceKey,
    compareFeatureImportEvidence,
  );
  const removedPublicApiConsumers: RemovedPublicApiConsumerImpact[] = [];
  for (const delta of publicExports) {
    for (const symbol of delta.removed) {
      const impact = removedConsumerImpact(
        baseImportEvidence,
        targetImportEvidence,
        delta.feature,
        'public',
        [symbol],
        symbol,
        'public',
      );
      if (impact) {
        removedPublicApiConsumers.push(impact);
      }
    }
  }
  for (const delta of webPublicExports) {
    for (const symbol of delta.removed) {
      const impact = removedConsumerImpact(
        baseImportEvidence,
        targetImportEvidence,
        delta.feature,
        'web',
        [symbol],
        symbol,
        'web',
      );
      if (impact) {
        removedPublicApiConsumers.push(impact);
      }
    }
  }
  for (const delta of contracts) {
    const baseFeature = baseByName.get(delta.feature);
    for (const symbol of delta.removed) {
      for (const boundary of ['public', 'web'] as const) {
        const impact = removedContractConsumerImpact(
          baseImportEvidence,
          targetImportEvidence,
          baseFeature === undefined ? [] : boundaryEvidenceFor(baseFeature, boundary),
          delta.feature,
          boundary,
          symbol,
        );
        if (impact) {
          removedPublicApiConsumers.push(impact);
        }
      }
    }
  }
  sortRemovedConsumerImpacts(removedPublicApiConsumers);

  const baseDiagnostics = new Map(base.diagnostics.map((d) => [diagnosticKey(d), d]));
  const targetDiagnostics = new Map(target.diagnostics.map((d) => [diagnosticKey(d), d]));
  const diagnosticsAdded = [...targetDiagnostics.values()]
    .filter((d) => !baseDiagnostics.has(diagnosticKey(d)))
    .sort((a, b) => diagnosticKey(a).localeCompare(diagnosticKey(b)));
  const diagnosticsResolved = [...baseDiagnostics.values()]
    .filter((d) => !targetDiagnostics.has(diagnosticKey(d)))
    .sort((a, b) => diagnosticKey(a).localeCompare(diagnosticKey(b)));

  boundaryExportProvenance.sort(
    (left, right) =>
      left.feature.localeCompare(right.feature) ||
      left.boundary.localeCompare(right.boundary) ||
      left.exportedName.localeCompare(right.exportedName),
  );
  return {
    features: { added, removed },
    publicExports,
    webPublicExports,
    boundaryExportProvenance,
    contracts,
    dependencies: { added: dependencyAdded, removed: dependencyRemoved },
    surfaces,
    integrations,
    consumerEvidence,
    removedPublicApiConsumers,
    diagnostics: { added: diagnosticsAdded, resolved: diagnosticsResolved },
  };
}


export function computeAffected(
  changes: ArchitectureChanges,
  target: ArchitectureSnapshot,
): AffectedSet {
  const directly = new Set<string>();
  for (const name of changes.features.added) directly.add(name);
  for (const name of changes.features.removed) directly.add(name);
  for (const delta of changes.publicExports) directly.add(delta.feature);
  for (const delta of changes.webPublicExports) directly.add(delta.feature);
  for (const delta of changes.boundaryExportProvenance) directly.add(delta.feature);
  for (const delta of changes.contracts) directly.add(delta.feature);
  for (const delta of changes.surfaces) directly.add(delta.feature);
  for (const delta of [
    changes.integrations.applicationImports,
    changes.integrations.serverRoutes,
    changes.integrations.webRoutes,
  ]) {
    for (const integration of [...delta.added, ...delta.removed]) {
      directly.add(integration.feature);
    }
  }
  for (const evidence of [...changes.consumerEvidence.added, ...changes.consumerEvidence.removed]) {
    directly.add(evidence.from);
  }
  for (const edge of changes.dependencies.added) {
    directly.add(edge.from);
    directly.add(edge.to);
  }
  for (const edge of changes.dependencies.removed) {
    directly.add(edge.from);
    directly.add(edge.to);
  }
  for (const diagnostic of [...changes.diagnostics.added, ...changes.diagnostics.resolved]) {
    const name = featureNameFromFile(diagnostic.file);
    if (name) directly.add(name);
  }

  // Downstream = dependents reachable through the target dependency graph
  // (same direction as `nara impact`: reverse edges from the changed node).
  const reverse = new Map<string, string[]>();
  for (const feature of target.features) reverse.set(feature.name, []);
  for (const edge of target.dependencies) {
    const list = reverse.get(edge.to) ?? [];
    if (!list.includes(edge.from)) list.push(edge.from);
    list.sort();
    reverse.set(edge.to, list);
  }
  // Removed features are absent from the target graph; still seed them so
  // dependents that remain (via other paths) resolve deterministically.
  for (const name of directly) {
    if (!reverse.has(name)) reverse.set(name, []);
  }

  const directlyChanged = [...directly].sort();
  const directSet = new Set(directlyChanged);
  const visited = new Set(directlyChanged);
  const queue = [...directlyChanged];
  const downstream: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const dependent of reverse.get(current) ?? []) {
      if (visited.has(dependent)) continue;
      visited.add(dependent);
      queue.push(dependent);
      if (!directSet.has(dependent)) downstream.push(dependent);
    }
  }
  downstream.sort();
  const all = [...new Set([...directlyChanged, ...downstream])].sort();
  return { scope: 'structural dependency impact', directlyChanged, downstream, all };
}

export type { SnapshotEdge };
