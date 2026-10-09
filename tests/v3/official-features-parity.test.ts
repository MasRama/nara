// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evolveFeature } from '../../src/cli/commands/evolve';
import { digestFeatureFiles, readFeatureFiles, readFeatureLineage } from '../../src/cli/evolution/lineage';

/**
 * The reference app installs its official Features through lineage, as any
 * Nara application would: each is edited in `official-features/<name>` and
 * brought into `src/features/<name>` with `npm run nara -- evolve <name>`.
 * These checks fail when that step was skipped or when the installed copy was
 * edited in place, so the reference app always runs the official source
 * unmodified.
 */
const root = process.cwd();

describe.each(['users', 'activity'])('official %s in the reference app', (feature) => {
  const officialDirectory = path.join(root, 'official-features', feature);
  const installedDirectory = path.join(root, 'src', 'features', feature);
  const evolve = `run \`npm run nara -- evolve ${feature}\``;

  it('records the current official source as its lineage base', () => {
    const lineage = readFeatureLineage(root, feature);
    expect(lineage, `${evolve} to install ${feature} through lineage`).toBeDefined();
    expect(lineage!.record.baseDigest, `official ${feature} changed; ${evolve}`).toBe(
      digestFeatureFiles(readFeatureFiles(officialDirectory, false)),
    );
  });

  it('runs every official file unmodified, adding only local files', () => {
    const installed = readFeatureFiles(installedDirectory);
    const edited = [...readFeatureFiles(officialDirectory, false)]
      .filter(([relativePath, bytes]) => !installed.get(relativePath)?.equals(bytes))
      .map(([relativePath]) => relativePath);
    expect(edited, `edit official-features/${feature}, then ${evolve}`).toEqual([]);
  });

  it('has nothing left for nara evolve to apply', () => {
    const outcome = evolveFeature({ feature, cwd: root, dryRun: true });
    expect(outcome.ok && outcome.plan.status).toBe('up-to-date');
    expect(outcome.ok && outcome.plan.conflicts).toEqual([]);
  });

  // Bindings are application-owned, so lineage never touches them; the
  // reference app keeps the ones `nara add` would install.
  it.each(['server', 'web'])('keeps the default %s binding aligned with the reference app', (side) => {
    expect(readFileSync(path.join(officialDirectory, '.nara', 'assembly', `${side}.ts`), 'utf8')).toBe(
      readFileSync(path.join(root, 'src', 'app', 'bindings', `${feature}.${side}.ts`), 'utf8'),
    );
  });
});
