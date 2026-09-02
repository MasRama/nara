import { discoverFeatureDependencies } from './discover-dependencies';

export interface FeatureDependencyCycle {
  path: string[];
}

export function detectFeatureDependencyCycles(root = process.cwd()): FeatureDependencyCycle[] {
  const discovery = discoverFeatureDependencies(root);
  const adjacency: Record<string, string[]> = {};

  for (const feature of discovery.features) {
    adjacency[feature.name] = [];
  }
  for (const dependency of discovery.dependencies) {
    const targets = adjacency[dependency.from] ?? [];
    if (!targets.includes(dependency.to)) {
      targets.push(dependency.to);
    }
    targets.sort();
    adjacency[dependency.from] = targets;
  }

  const featureNames = Object.keys(adjacency).sort();
  const cycles: FeatureDependencyCycle[] = [];
  const cycleKeys = new Set<string>();

  function visit(start: string, current: string, trail: string[]): void {
    for (const target of adjacency[current] ?? []) {
      if (target === start) {
        const cyclePath = [...trail, start];
        const cycleKey = cyclePath.slice(0, -1).join('\0');
        if (!cycleKeys.has(cycleKey)) {
          cycleKeys.add(cycleKey);
          cycles.push({ path: cyclePath });
        }
        continue;
      }
      if (target < start || trail.includes(target)) {
        continue;
      }
      visit(start, target, [...trail, target]);
    }
  }

  for (const feature of featureNames) {
    visit(feature, feature, [feature]);
  }

  return cycles.sort((left, right) => left.path.join('\0').localeCompare(right.path.join('\0')));
}
