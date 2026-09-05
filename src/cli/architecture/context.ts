import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { analyzeArchitecture, type DoctorIssue } from './doctor';
import { discoverFeatures } from './discover-features';
import { inspectFeature } from './inspect';
import { inspectFeatureImpact } from './impact';

export interface ArchitectureContextTarget {
  feature: string;
  selectedBy: 'feature' | 'file';
  sourceFile?: string;
}

export interface ArchitectureContextOwnership {
  directory: string;
  publicBoundary: string;
  ownedFiles: string[];
}

export interface ArchitectureContextPublicApi {
  exports: string[];
  contracts: string[];
}

export interface ArchitectureContextRelationships {
  dependencies: string[];
  directDependents: string[];
  transitiveDependents: string[];
}

export interface ArchitectureContextSurfaces {
  server: string[];
  web: string[];
  tests: string[];
}

export interface ArchitectureConstraint {
  code: string;
  description: string;
}

export interface ArchitectureReadingEntry {
  path: string;
  reason: string;
}

export interface ArchitectureContextPack {
  schemaVersion: 1;
  target: ArchitectureContextTarget;
  ownership: ArchitectureContextOwnership;
  publicApi: ArchitectureContextPublicApi;
  relationships: ArchitectureContextRelationships;
  surfaces: ArchitectureContextSurfaces;
  constraints: ArchitectureConstraint[];
  diagnostics: DoctorIssue[];
  readingOrder: ArchitectureReadingEntry[];
}

export type FeatureContextResult =
  | { ok: true; context: ArchitectureContextPack }
  | { ok: false; message: string };

export type OwningFeatureResult =
  | { ok: true; feature: string; sourceFile: string }
  | { ok: false; message: string };

/**
 * Stable architecture rules relevant while editing any Feature. These describe
 * Nara's existing architecture contract; they are not configurable policy.
 */
export const ARCHITECTURE_CONSTRAINTS: ArchitectureConstraint[] = [
  {
    code: 'PUBLIC_BOUNDARY_IS_INDEX',
    description: 'The public Feature boundary is index.ts; cross-Feature consumers use it as the entry point.',
  },
  {
    code: 'CROSS_FEATURE_USES_PUBLIC_BOUNDARY',
    description:
      'Cross-Feature consumers must import through the Feature public boundary (index.ts or the browser-safe web/index.ts), never through Feature internals.',
  },
  {
    code: 'FEATURE_INTERNALS_PRIVATE',
    description: 'Feature internals (server/*, web/* internals, and other non-index modules) are not public API.',
  },
  {
    code: 'NO_SERVER_INTO_CLIENT',
    description:
      'Server-owned code must not leak into browser/client surfaces: web/* must not import server modules, Node built-ins, or server-only packages.',
  },
  {
    code: 'CANONICAL_FEATURE_SHAPE',
    description:
      'Canonical Feature shape must remain valid: a lowercase kebab-case directory under src/features with a public index.ts.',
  },
];

function toPosix(value: string): string {
  return value.replaceAll('\\', '/');
}

function prefixOwnedFiles(directory: string, entries: string[]): string[] {
  const normalizedDirectory = toPosix(directory);
  return entries.map((entry) => `${normalizedDirectory}/${toPosix(entry)}`).sort();
}

function ownedByFeature(file: string, directory: string): boolean {
  const normalizedFile = toPosix(file);
  const normalizedDirectory = toPosix(directory);
  return normalizedFile === normalizedDirectory || normalizedFile.startsWith(`${normalizedDirectory}/`);
}

/**
 * Resolve the owning Feature for a file path from discovered architecture.
 * No fuzzy name matching: the normalized path must sit inside a discovered
 * Feature directory.
 */
export function resolveOwningFeature(input: string, root = process.cwd()): OwningFeatureResult {
  const resolvedRoot = path.resolve(root);
  const separatorsNormalized = input.replaceAll('\\', '/');
  const resolvedFile =
    path.isAbsolute(input) || path.isAbsolute(separatorsNormalized)
      ? path.normalize(path.isAbsolute(input) ? input : separatorsNormalized)
      : path.resolve(resolvedRoot, separatorsNormalized);
  const relative = path.relative(resolvedRoot, resolvedFile);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return { ok: false, message: `File "${input}" is outside the repository (${resolvedRoot}).` };
  }
  if (!existsSync(resolvedFile)) {
    return { ok: false, message: `File "${input}" does not exist.` };
  }
  try {
    if (statSync(resolvedFile).isDirectory()) {
      return { ok: false, message: `Path "${input}" is a directory; pass a file owned by a Feature.` };
    }
  } catch (error) {
    return { ok: false, message: `Could not inspect "${input}": ${error instanceof Error ? error.message : String(error)}.` };
  }

  const sourceFile = toPosix(relative);
  const discovery = discoverFeatures(resolvedRoot);
  const feature = discovery.features.find((candidate) => ownedByFeature(sourceFile, candidate.directory));
  if (!feature) {
    return { ok: false, message: `File "${sourceFile}" is not owned by a discovered Feature.` };
  }
  return { ok: true, feature: feature.name, sourceFile };
}

function assembleContextPack(
  name: string,
  root: string,
  target: ArchitectureContextTarget,
): FeatureContextResult {
  const inspection = inspectFeature(name, root);
  if (!inspection.ok) {
    return inspection;
  }
  const impact = inspectFeatureImpact(name, root);
  if (!impact.ok) {
    return impact;
  }
  const discovery = discoverFeatures(root);
  const discovered = discovery.features.find((candidate) => candidate.name === name);
  if (!discovered) {
    return { ok: false, message: `Unknown feature "${name}".` };
  }

  const feature = inspection.feature;
  const directory = toPosix(discovered.directory);
  const publicBoundary = `${directory}/index.ts`;
  const ownedFiles = prefixOwnedFiles(discovered.directory, discovered.files);
  const server = prefixOwnedFiles(discovered.directory, feature.serverEntrypoints);
  const web = prefixOwnedFiles(discovered.directory, feature.webEntrypoints);
  const tests = prefixOwnedFiles(discovered.directory, feature.tests);

  const diagnostics = analyzeArchitecture(root)
    .issues.filter((issue) => ownedByFeature(issue.file, directory));

  const seen = new Set<string>();
  const readingOrder: ArchitectureReadingEntry[] = [];
  function push(entryPath: string, reason: string): void {
    if (seen.has(entryPath)) {
      return;
    }
    seen.add(entryPath);
    readingOrder.push({ path: entryPath, reason });
  }

  push(publicBoundary, `Public boundary of the ${name} Feature.`);
  if (discovered.hasContract) {
    push(`${directory}/contract.ts`, `Shared contract of the ${name} Feature.`);
  }
  for (const entry of server) {
    push(entry, `Server surface of the ${name} Feature.`);
  }
  for (const entry of web) {
    push(entry, `Web surface of the ${name} Feature.`);
  }
  for (const entry of tests) {
    push(entry, `Test surface of the ${name} Feature.`);
  }
  for (const dependency of feature.dependencies) {
    push(`src/features/${dependency}/index.ts`, `Public boundary of direct dependency ${dependency}.`);
  }

  return {
    ok: true,
    context: {
      schemaVersion: 1,
      target,
      ownership: { directory, publicBoundary, ownedFiles },
      publicApi: { exports: [...feature.publicExports], contracts: [...feature.contracts] },
      relationships: {
        dependencies: [...feature.dependencies],
        directDependents: [...impact.impact.directDependents],
        transitiveDependents: [...impact.impact.transitiveDependents],
      },
      surfaces: { server, web, tests },
      constraints: ARCHITECTURE_CONSTRAINTS.map((constraint) => ({ ...constraint })),
      diagnostics,
      readingOrder,
    },
  };
}

export function buildFeatureContext(name: string, root = process.cwd()): FeatureContextResult {
  return assembleContextPack(name, root, { feature: name, selectedBy: 'feature' });
}

export function buildFeatureContextForFile(input: string, root = process.cwd()): FeatureContextResult {
  const resolved = resolveOwningFeature(input, root);
  if (!resolved.ok) {
    return resolved;
  }
  return assembleContextPack(resolved.feature, root, {
    feature: resolved.feature,
    selectedBy: 'file',
    sourceFile: resolved.sourceFile,
  });
}
