import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Canonical Nara package identities. Source/reference execution resolves
 * the private root package (`nara`); installed execution resolves the
 * published artifact (`@nara-web/cli`). Both are legitimate Nara package
 * roots — anything else is not a Nara installation.
 */
const NARA_PACKAGE_NAMES: ReadonlySet<string> = new Set(['nara', '@nara-web/cli']);

/**
 * Resolve the nearest enclosing Nara package root by walking upward from
 * the executing CLI file. Used by both CLI version discovery and
 * official-feature discovery so staged (`packages/nara/dist`), built
 * (`build/src/cli`), and source (`src/cli`) execution all resolve to the
 * same owning package without fixed-depth guessing.
 */
export function resolveNaraPackageRoot(startDirectory: string = __dirname): string {
  let current = path.resolve(startDirectory);
  const origin = current;
  for (;;) {
    const candidate = path.join(current, 'package.json');
    if (existsSync(candidate)) {
      try {
        const manifest = JSON.parse(readFileSync(candidate, 'utf8')) as {
          name?: unknown;
        };
        if (typeof manifest.name === 'string' && NARA_PACKAGE_NAMES.has(manifest.name)) {
          return current;
        }
      } catch {
        // Malformed manifest cannot identify a package root; keep walking.
      }
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  throw new Error(
    `Nara package root not found: walked upward from ${origin} without finding a package.json with a canonical Nara package name (${[...NARA_PACKAGE_NAMES].join(', ')}).`,
  );
}

export function readNaraCliVersion(startDirectory: string = __dirname): string {
  const root = resolveNaraPackageRoot(startDirectory);
  const manifestPath = path.join(root, 'package.json');
  let manifest: { name?: unknown; version?: unknown };
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      name?: unknown;
      version?: unknown;
    };
  } catch (error) {
    throw new Error(
      `Nara package at ${root} has no readable package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
    throw new Error(`Nara package at ${root} has no valid version in ${manifestPath}.`);
  }
  return manifest.version;
}

export function resolveOfficialFeatureDirectory(name: string, startDirectory: string = __dirname): string {
  return path.join(resolveNaraPackageRoot(startDirectory), 'official-features', name);
}
