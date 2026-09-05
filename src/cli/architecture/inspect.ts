import path from 'node:path';
import { boundaryExportNames, boundaryExportsForFeature, discoverExportedNames } from './discover-boundary-exports';
import { discoverFeatureDependencies } from './discover-dependencies';
import { discoverFeatureIntegrations, type FeatureIntegrationFacts } from './discover-integrations';
import type { BoundaryExportEvidenceByBoundary } from './discover-boundary-exports';
import type { FeatureImportEvidence } from './discover-import-evidence';

export interface FeatureInspection {
  name: string;
  path: string;
  publicExports: string[];
  webPublicExports: string[];
  boundaryExports: BoundaryExportEvidenceByBoundary;
  dependencies: string[];
  dependents: string[];
  serverEntrypoints: string[];
  webEntrypoints: string[];
  contracts: string[];
  tests: string[];
  consumerEvidence: FeatureImportEvidence[];
  integrations: FeatureIntegrationFacts;
}

export type InspectFeatureResult =
  | { ok: true; feature: FeatureInspection }
  | { ok: false; message: string };


function normalizedFiles(files: string[], directory: string): string[] {
  return files
    .filter((file) => file.startsWith(`${directory}${path.sep}`))
    .map((file) => file.replaceAll(path.sep, '/'))
    .sort();
}

export function inspectFeature(name: string, root = process.cwd()): InspectFeatureResult {
  const discovery = discoverFeatureDependencies(root);
  const feature = discovery.features.find((candidate) => candidate.name === name);
  if (!feature) {
    const available = discovery.features.map((candidate) => candidate.name).join(', ') || 'none';
    return {
      ok: false,
      message: `Unknown feature "${name}". Available features: ${available}.`,
    };
  }

  const dependencies = discovery.dependencies
    .filter((dependency) => dependency.from === name)
    .map((dependency) => dependency.to)
    .sort();
  const dependents = discovery.dependencies
    .filter((dependency) => dependency.to === name)
    .map((dependency) => dependency.from)
    .sort();
  const boundaryExports = boundaryExportsForFeature(discovery.boundaryExports, name);
  const consumerEvidence = discovery.importEvidence
    .filter(
      (evidence) =>
        evidence.to === name && evidence.precision === 'symbol' && evidence.boundary !== undefined,
    )
    .map((evidence) => ({ ...evidence }));
  const integrations = discoverFeatureIntegrations(root)[name] ?? {
    applicationImports: [],
    serverRoutes: [],
    webRoutes: [],
  };

  return {
    ok: true,
    feature: {
      name: feature.name,
      path: feature.directory,
      publicExports: boundaryExportNames(boundaryExports.public),
      webPublicExports: boundaryExportNames(boundaryExports.web),
      boundaryExports,
      dependencies,
      dependents,
      serverEntrypoints: normalizedFiles(feature.files, 'server'),
      webEntrypoints: normalizedFiles(feature.files, 'web'),
      contracts: feature.hasContract
        ? discoverExportedNames(path.resolve(root, feature.directory, 'contract.ts'))
        : [],
      tests: normalizedFiles(feature.files, 'tests'),
      consumerEvidence,
      integrations: {
        applicationImports: integrations.applicationImports.map((fact) => ({
          ...fact,
          symbols: [...fact.symbols],
        })),
        serverRoutes: integrations.serverRoutes.map((route) => ({ ...route })),
        webRoutes: integrations.webRoutes.map((route) => ({ ...route })),
      },
    },
  };
}
