import { discoverFeatureDependencies } from './discover-dependencies';
import type { FeatureImportEvidence } from './discover-import-evidence';

export interface FeatureImpact {
  name: string;
  directDependents: string[];
  transitiveDependents: string[];
  directConsumerEvidence: FeatureImportEvidence[];
  scope: 'feature dependency graph';
}

export type FeatureImpactResult =
  | { ok: true; impact: FeatureImpact }
  | { ok: false; message: string };

export function inspectFeatureImpact(name: string, root = process.cwd()): FeatureImpactResult {
  const discovery = discoverFeatureDependencies(root);
  if (!discovery.features.some((feature) => feature.name === name)) {
    const available = discovery.features.map((feature) => feature.name).join(', ') || 'none';
    return {
      ok: false,
      message: `Unknown feature "${name}". Available features: ${available}.`,
    };
  }

  const reverseDependencies: Record<string, string[]> = {};
  for (const feature of discovery.features) {
    reverseDependencies[feature.name] = [];
  }
  for (const dependency of discovery.dependencies) {
    const dependents = reverseDependencies[dependency.to] ?? [];
    if (!dependents.includes(dependency.from)) {
      dependents.push(dependency.from);
    }
    dependents.sort();
    reverseDependencies[dependency.to] = dependents;
  }

  const directDependents = reverseDependencies[name] ?? [];
  const directSet = new Set(directDependents);
  const directConsumerEvidence = discovery.importEvidence
    .filter(
      (evidence) =>
        evidence.to === name &&
        directSet.has(evidence.from) &&
        evidence.precision === 'symbol' &&
        evidence.boundary !== undefined,
    )
    .map((evidence) => ({ ...evidence }));
  const visited = new Set<string>([name]);
  const queue = [...directDependents];
  const transitiveDependents: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    for (const dependent of reverseDependencies[current] ?? []) {
      if (visited.has(dependent)) {
        continue;
      }
      visited.add(dependent);
      queue.push(dependent);
      if (!directSet.has(dependent)) {
        transitiveDependents.push(dependent);
      }
    }
  }

  transitiveDependents.sort();
  return {
    ok: true,
    impact: {
      name,
      directDependents,
      transitiveDependents,
      directConsumerEvidence,
      scope: 'feature dependency graph',
    },
  };
}
