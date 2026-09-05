import { analyzeArchitecture, type DoctorIssue } from './doctor';
import { discoverFeatureDependencies } from './discover-dependencies';
import { discoverFeatureIntegrations, type FeatureIntegrationFacts } from './discover-integrations';
import { inspectFeature } from './inspect';
import { boundaryExportNames, boundaryExportsForFeature, type BoundaryExportEvidenceByBoundary } from './discover-boundary-exports';
import type { FeatureImportEvidence } from './discover-import-evidence';
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
  webPublicExports: string[];
  boundaryExports: BoundaryExportEvidenceByBoundary;
  contractExports: string[];
  serverSurfaces: string[];
  webSurfaces: string[];
  testSurfaces: string[];
  integrations: FeatureIntegrationFacts;
}

export interface ArchitectureSnapshot {
  schemaVersion: 1;
  features: SnapshotFeature[];
  importEvidence: FeatureImportEvidence[];
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
  const integrations = discoverFeatureIntegrations(root);
  const names = discovery.features.map((feature) => feature.name).sort();

  const features: SnapshotFeature[] = names.map((name) => {
    const boundaryExports = boundaryExportsForFeature(discovery.boundaryExports, name);
    const inspected = inspectFeature(name, root);
    if (!inspected.ok) {
      return {
        name,
        publicExports: boundaryExportNames(boundaryExports.public),
        webPublicExports: boundaryExportNames(boundaryExports.web),
        boundaryExports,
        contractExports: [],
        serverSurfaces: [],
        webSurfaces: [],
        testSurfaces: [],
        integrations: integrations[name] ?? {
          applicationImports: [],
          serverRoutes: [],
          webRoutes: [],
        },
      };
    }
    const featureIntegrations = integrations[name] ?? {
      applicationImports: [],
      serverRoutes: [],
      webRoutes: [],
    };
    return {
      name,
      publicExports: boundaryExportNames(boundaryExports.public),
      webPublicExports: boundaryExportNames(boundaryExports.web),
      boundaryExports,
      contractExports: [...inspected.feature.contracts].sort(),
      serverSurfaces: [...inspected.feature.serverEntrypoints].sort(),
      webSurfaces: [...inspected.feature.webEntrypoints].sort(),
      testSurfaces: [...inspected.feature.tests].sort(),
      integrations: {
        applicationImports: featureIntegrations.applicationImports.map((fact) => ({
          ...fact,
          symbols: [...fact.symbols].sort(),
        })),
        serverRoutes: featureIntegrations.serverRoutes.map((route) => ({ ...route })),
        webRoutes: featureIntegrations.webRoutes.map((route) => ({ ...route })),
      },
    };
  });

  const importEvidence = discovery.importEvidence.map((evidence) => ({
    ...evidence,
    sourceFile: toPosix(evidence.sourceFile),
  }));
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

  return { snapshot: { schemaVersion: 1, features, importEvidence, dependencies, diagnostics }, issues };
}

export function captureArchitectureSnapshot(root = process.cwd()): ArchitectureSnapshot {
  return captureArchitectureSnapshotWithIssues(root).snapshot;
}
