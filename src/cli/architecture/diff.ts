import type { ArchitectureSnapshot, SnapshotDiagnostic, SnapshotEdge } from './snapshot';

export interface ExportDelta {
  feature: string;
  added: string[];
  removed: string[];
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

export interface DiagnosticDelta extends SnapshotDiagnostic {}

export interface ArchitectureChanges {
  features: { added: string[]; removed: string[] };
  publicExports: ExportDelta[];
  contracts: ExportDelta[];
  dependencies: { added: DependencyDelta[]; removed: DependencyDelta[] };
  surfaces: SurfaceDelta[];
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

  const baseDiagnostics = new Map(base.diagnostics.map((d) => [diagnosticKey(d), d]));
  const targetDiagnostics = new Map(target.diagnostics.map((d) => [diagnosticKey(d), d]));
  const diagnosticsAdded = [...targetDiagnostics.values()]
    .filter((d) => !baseDiagnostics.has(diagnosticKey(d)))
    .sort((a, b) => diagnosticKey(a).localeCompare(diagnosticKey(b)));
  const diagnosticsResolved = [...baseDiagnostics.values()]
    .filter((d) => !targetDiagnostics.has(diagnosticKey(d)))
    .sort((a, b) => diagnosticKey(a).localeCompare(diagnosticKey(b)));

  return {
    features: { added, removed },
    publicExports,
    contracts,
    dependencies: { added: dependencyAdded, removed: dependencyRemoved },
    surfaces,
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
  for (const delta of changes.contracts) directly.add(delta.feature);
  for (const delta of changes.surfaces) directly.add(delta.feature);
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
