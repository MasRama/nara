// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evolveFeature } from '../../src/cli/commands/evolve';
import { digestFeatureFiles, readFeatureFiles, readFeatureLineage } from '../../src/cli/evolution/lineage';

/**
 * The reference app installs Users from `official-features/users` through
 * lineage, as any Nara application would: Users is edited there and brought
 * into `src/features/users` with `npm run nara -- evolve users`. These checks
 * fail when that step was skipped or when the installed copy was edited in
 * place, so the reference app always runs the official source unmodified.
 */
const root = process.cwd();
const officialDirectory = path.join(root, 'official-features', 'users');
const installedDirectory = path.join(root, 'src', 'features', 'users');

describe('official Users in the reference app', () => {
  it('records the current official source as its lineage base', () => {
    const lineage = readFeatureLineage(root, 'users');
    expect(lineage, 'run `npm run nara -- evolve users` to install Users through lineage').toBeDefined();
    expect(lineage!.record.baseDigest, 'official Users changed; run `npm run nara -- evolve users`').toBe(
      digestFeatureFiles(readFeatureFiles(officialDirectory, false)),
    );
  });

  it('runs every official file unmodified, adding only local files', () => {
    const installed = readFeatureFiles(installedDirectory);
    const edited = [...readFeatureFiles(officialDirectory, false)]
      .filter(([relativePath, bytes]) => !installed.get(relativePath)?.equals(bytes))
      .map(([relativePath]) => relativePath);
    expect(edited, 'edit official-features/users, then run `npm run nara -- evolve users`').toEqual([]);
  });

  it('has nothing left for nara evolve to apply', () => {
    const outcome = evolveFeature({ feature: 'users', cwd: root, dryRun: true });
    expect(outcome.ok && outcome.plan.status).toBe('up-to-date');
    expect(outcome.ok && outcome.plan.conflicts).toEqual([]);
  });

  // Bindings are application-owned, so lineage never touches them; the
  // reference app keeps the ones `nara add` would install.
  it('keeps the default server binding aligned with the reference app', () => {
    expect(readFileSync(path.join(officialDirectory, '.nara', 'assembly', 'server.ts'), 'utf8')).toBe(
      readFileSync(path.join(root, 'src', 'app', 'bindings', 'users.server.ts'), 'utf8'),
    );
  });

  it('keeps the default web binding aligned with the reference app', () => {
    expect(readFileSync(path.join(officialDirectory, '.nara', 'assembly', 'web.ts'), 'utf8')).toBe(
      readFileSync(path.join(root, 'src', 'app', 'bindings', 'users.web.ts'), 'utf8'),
    );
  });
});
