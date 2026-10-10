import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Official Users assembly: host-requirement proof that runs anywhere the
 * Feature source lands. It imports no Feature or shared modules — only the
 * file tree itself — so the same file passes inside
 * the reference app, the published package's `official-features/users/`,
 * and an installed `src/features/users/` without resolving host application code.
 *
 * The directory resolves from `__dirname` so the test checks its own
 * Feature copy under both the repo and installed layouts and under both
 * module systems. Behavioral coverage with a live host lives with the
 * reference suite (`src/features/users/tests/users-host.test.ts`) and the
 * packaged lifecycle proof; this file guards the distributable contract
 * statically.
 */
const featureDirectory = path.resolve(__dirname, '..');

function collectSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'tests' || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectSourceFiles(full));
    else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.vue'))) files.push(full);
  }
  return files;
}

function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const staticPattern = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g;
  const dynamicPattern = /(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const pattern of [staticPattern, dynamicPattern]) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

function isAuthSpecifier(specifier: string): boolean {
  return (
    specifier === 'auth' ||
    specifier.endsWith('/auth') ||
    specifier.includes('/auth/') ||
    specifier.includes('features/auth')
  );
}

// The modules every Nara application guarantees (GUARANTEED_SHARED_MODULES
// in the CLI, which refuses to add or evolve source reaching others).
const GUARANTEED_SHARED_MODULES = ['config', 'database', 'realtime', 'security', 'storage'];

function isUnguaranteedSharedSpecifier(specifier: string): boolean {
  const module = /(?:^|\/)shared\/([^/]+)/.exec(specifier)?.[1];
  return module !== undefined && !GUARANTEED_SHARED_MODULES.includes(module);
}

function accountTableReferences(source: string): string[] {
  const found: string[] = [];
  const pattern = /\b(?:FROM|INTO|UPDATE|JOIN)\s+users\b/i;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) found.push(match[0]);
  return found;
}

describe('official users host requirements', () => {
  it('ships feature-owned source with no direct Auth import', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(featureDirectory)) {
      const found = importSpecifiers(readFileSync(file, 'utf8')).filter(isAuthSpecifier);
      if (found.length > 0) offenders.push(`${path.relative(featureDirectory, file)}: ${found.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('exposes route factories built from explicit host requirements', () => {
    const boundary = readFileSync(path.join(featureDirectory, 'index.ts'), 'utf8');
    expect(boundary).toContain('createUserRoutes');
    expect(boundary).toContain('createAssetRoutes');
    expect(boundary).toContain('UsersServerHost');
    expect(boundary).toContain('./server/host');
  });

  it('exposes the browser-side host seam through the web boundary', () => {
    const boundary = readFileSync(path.join(featureDirectory, 'web', 'index.ts'), 'utf8');
    expect(boundary).toContain('UsersWebHost');
    expect(boundary).toContain('./host');
  });

  // Users' browser code asks its host in Users' own actions, as the server
  // side does; the slugs belong to whatever access control the host binds.
  const PERMISSION_SLUG = /['"`](?:users|roles|activity)\.(?:[a-z-]+['"`]|\$\{)/g;

  it('recognizes permission slugs however they are spelled', () => {
    for (const spelled of ["'users.create'", '"roles.view"', '`activity.view`', '`users.${action}`']) {
      expect(spelled.match(PERMISSION_SLUG), spelled).not.toBeNull();
    }
  });

  it('keeps permission slugs out of browser code', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(path.join(featureDirectory, 'web'))) {
      const found = readFileSync(file, 'utf8').match(PERMISSION_SLUG) ?? [];
      if (found.length > 0) offenders.push(`${path.relative(featureDirectory, file)}: ${found.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('ships users-owned migrations with the feature', () => {
    const migrations = readdirSync(path.join(featureDirectory, 'server', 'migrations')).sort();
    expect(migrations).toEqual([
      '202609030007_create_assets.sql',
      '202609030008_assets_owner_reference.sql',
      '202610060001_provider_neutral_asset_storage.sql',
    ]);
  });

  it('imports only the guaranteed shared substrate', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(featureDirectory)) {
      const found = importSpecifiers(readFileSync(file, 'utf8')).filter(isUnguaranteedSharedSpecifier);
      if (found.length > 0) offenders.push(`${path.relative(featureDirectory, file)}: ${found.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('never queries Auth-owned account rows with SQL', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(featureDirectory)) {
      const found = accountTableReferences(readFileSync(file, 'utf8'));
      if (found.length > 0) offenders.push(`${path.relative(featureDirectory, file)}: ${found.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
