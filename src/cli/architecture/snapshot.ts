import { analyzeArchitecture, type DoctorIssue } from './doctor';
import { discoverFeatureDependencies } from './discover-dependencies';
import { inspectFeature } from './inspect';
/**
 * Deterministic internal architecture snapshot used by `nara diff`.
 * Derived only from facts Nara already owns (discovery, inspection,
 * doctor). Sorted, no timestamps, no absolute paths.
 */
export interface SnapshotEdge {
  from: string;
  to: string;
  imports: string[];
  sourceFiles: string[];
}

export interface SnapshotDiagnostic {
  code: string;
  file: string;
  relationship: string;
}

export interface SnapshotFeature {
  name: string;
  publicExports: string[];
  contractExports: string[];
  serverSurfaces: string[];
  webSurfaces: string[];
  testSurfaces: string[];
}

export interface ArchitectureSnapshot {
  schemaVersion: 1;
  features: SnapshotFeature[];
  dependencies: SnapshotEdge[];
  diagnostics: SnapshotDiagnostic[];
}

export function toPosix(value: string): string {
  return value.replaceAll('\\', '/');
}

export function captureArchitectureSnapshotWithIssues(root = process.cwd()): {
  snapshot: ArchitectureSnapshot;
  issues: DoctorIssue[];
} {
  const discovery = discoverFeatureDependencies(root);
  const names = discovery.features.map((feature) => feature.name).sort();

  const features: SnapshotFeature[] = names.map((name) => {
    const inspected = inspectFeature(name, root);
    if (!inspected.ok) {
      return {
        name,
        publicExports: [],
        contractExports: [],
        serverSurfaces: [],
        webSurfaces: [],
        testSurfaces: [],
      };
    }
    return {
      name,
      publicExports: [...inspected.feature.publicExports].sort(),
      contractExports: [...inspected.feature.contracts].sort(),
      serverSurfaces: [...inspected.feature.serverEntrypoints].sort(),
      webSurfaces: [...inspected.feature.webEntrypoints].sort(),
      testSurfaces: [...inspected.feature.tests].sort(),
    };
  });

  const dependencies: SnapshotEdge[] = discovery.dependencies
    .map((dependency) => ({
      from: dependency.from,
      to: dependency.to,
      imports: [...dependency.imports].sort(),
      sourceFiles: dependency.sourceFiles.map(toPosix).sort(),
    }))
    .sort((left, right) => left.from.localeCompare(right.from) || left.to.localeCompare(right.to));

  const issues = analyzeArchitecture(root).issues;
  const diagnostics: SnapshotDiagnostic[] = issues
    .map((issue) => ({
      code: issue.code,
      file: toPosix(issue.file),
      relationship: issue.relationship,
    }))
    .sort(
      (left, right) =>
        left.code.localeCompare(right.code) ||
        left.file.localeCompare(right.file) ||
        left.relationship.localeCompare(right.relationship),
    );

  return { snapshot: { schemaVersion: 1, features, dependencies, diagnostics }, issues };
}

export function captureArchitectureSnapshot(root = process.cwd()): ArchitectureSnapshot {
  return captureArchitectureSnapshotWithIssues(root).snapshot;
}
