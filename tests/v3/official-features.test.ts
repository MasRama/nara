// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evolveFeature } from '../../src/cli/commands/evolve';
import { readAssemblyTemplates } from '../../src/cli/composition/assembly';
import { readFeatureRequirements, validateRequirementsAgainstSource } from '../../src/cli/composition/requirements';
import { checkSharedSubstrate, sharedModuleUses } from '../../src/cli/composition/substrate';
import { digestFeatureFiles, readFeatureLineage, readOfficialFeatureFiles } from '../../src/cli/evolution/lineage';

/**
 * Official Features have one copy: the one installed in `src/features/<name>`,
 * marked official by its `.nara/` distribution folder and shipped from there
 * by `npm run stage:package` (minus `tests/app/`, the reference app's own
 * tests). The committed lineage base is what an application started from this
 * repository evolves from, so it must match that source; after editing an
 * official Feature, `npm run nara -- evolve <name>` records it again.
 */
const root = process.cwd();
const featuresRoot = path.join(root, 'src', 'features');
const official = readdirSync(featuresRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(featuresRoot, entry.name, '.nara')))
  .map((entry) => entry.name)
  .sort();

it('ships the official Features from the reference app', () => {
  expect(official).toEqual(expect.arrayContaining(['activity', 'auth', 'health', 'users']));
  expect(existsSync(path.join(root, 'official-features'))).toBe(false);
});

describe.each(official)('official %s', (feature) => {
  const directory = path.join(featuresRoot, feature);
  const evolve = `run \`npm run nara -- evolve ${feature}\``;

  it('records its current source as the lineage base', () => {
    const lineage = readFeatureLineage(root, feature);
    expect(lineage, `record ${feature}'s lineage under .nara/lineage/official-features/${feature}`).toBeDefined();
    expect(lineage!.record.baseDigest, `official ${feature} changed; ${evolve}`).toBe(
      digestFeatureFiles(readOfficialFeatureFiles(directory)),
    );
  });

  it('has nothing left for nara evolve to apply', () => {
    const outcome = evolveFeature({ feature, cwd: root, dryRun: true });
    expect(outcome.ok && outcome.plan.status).toBe('up-to-date');
    expect(outcome.ok && outcome.plan.conflicts).toEqual([]);
  });

  it('declares exactly the npm packages it imports and reaches only the guaranteed substrate', () => {
    const files = readOfficialFeatureFiles(directory);
    const templates = readAssemblyTemplates(directory);
    const read = readFeatureRequirements(directory);
    if (!read.ok) throw new Error(read.error);
    // Without a requirements file a Feature may import no package beyond the stack.
    const requirements = read.requirements ?? { schemaVersion: 1 as const, providers: [], packages: {} };
    expect(validateRequirementsAgainstSource(requirements, files, templates)).toBeUndefined();
    expect(checkSharedSubstrate(root, feature, sharedModuleUses(feature, files, templates), 'add')).toBeUndefined();
  });

  // Bindings are application-owned, so lineage never touches them; the
  // reference app keeps the ones `nara add` would install.
  it.each(['server', 'web'])('keeps the default %s binding aligned with the reference app', (side) => {
    const template = path.join(directory, '.nara', 'assembly', `${side}.ts`);
    const binding = path.join(root, 'src', 'app', 'bindings', `${feature}.${side}.ts`);
    if (!existsSync(template) || !existsSync(binding)) return;
    expect(readFileSync(template, 'utf8')).toBe(readFileSync(binding, 'utf8'));
  });
});
