import { inspectFeature, type FeatureInspection } from './inspect';

export interface FeatureContext {
  name: string;
  workDirectory: string;
  publicBoundary: string;
  publicDependencies: string[];
  dependents: string[];
  contracts: string[];
  serverSurfaces: string[];
  webSurfaces: string[];
  testSurfaces: string[];
}

export type FeatureContextResult =
  | { ok: true; context: FeatureContext }
  | { ok: false; message: string };

export function buildFeatureContext(name: string, root = process.cwd()): FeatureContextResult {
  const result = inspectFeature(name, root);
  if (!result.ok) {
    return result;
  }

  const feature: FeatureInspection = result.feature;
  return {
    ok: true,
    context: {
      name: feature.name,
      workDirectory: feature.path,
      publicBoundary: `${feature.path}/index.ts`,
      publicDependencies: feature.dependencies.map((dependency) => `${dependency} -> @/features/${dependency}`),
      dependents: feature.dependents,
      contracts: feature.contracts,
      serverSurfaces: feature.serverEntrypoints,
      webSurfaces: feature.webEntrypoints,
      testSurfaces: feature.tests,
    },
  };
}
