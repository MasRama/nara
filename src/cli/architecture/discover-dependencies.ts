import { discoverFeatures, type FeatureDiscovery } from './discover-features';
import { discoverFeatureImportEvidence, type FeatureImportEvidence } from './discover-import-evidence';


export interface FeatureDependency {
  from: string;
  to: string;
  imports: string[];
  sourceFiles: string[];
  usesInternalPath: boolean;
}

export interface DependencyDiscovery extends FeatureDiscovery {
  dependencies: FeatureDependency[];
  importEvidence: FeatureImportEvidence[];
}

export type { FeatureBoundary, FeatureReference } from './discover-import-evidence';
export { featureReferenceFromSpecifier } from './discover-import-evidence';


export function discoverFeatureDependencies(root = process.cwd()): DependencyDiscovery {
  const discovery = discoverFeatures(root);
  const importEvidence = discoverFeatureImportEvidence(root);
  const edges = new Map<string, FeatureDependency>();

  for (const evidence of importEvidence) {
    const key = `${evidence.from}\0${evidence.to}`;
    const dependency = edges.get(key) ?? {
      from: evidence.from,
      to: evidence.to,
      imports: [],
      sourceFiles: [],
      usesInternalPath: false,
    };
    if (!dependency.imports.includes(evidence.specifier)) {
      dependency.imports.push(evidence.specifier);
    }
    if (!dependency.sourceFiles.includes(evidence.sourceFile)) {
      dependency.sourceFiles.push(evidence.sourceFile);
    }
    dependency.usesInternalPath ||= evidence.usesInternalPath;
    edges.set(key, dependency);
  }

  const dependencies = [...edges.values()].sort((left, right) =>
    left.from.localeCompare(right.from) || left.to.localeCompare(right.to),
  );
  for (const dependency of dependencies) {
    dependency.imports.sort();
    dependency.sourceFiles.sort();
  }

  return { ...discovery, dependencies, importEvidence };
}
