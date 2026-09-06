import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli, type CliIO } from '../router';
import { installOfficialFeature } from '../composition/install-feature';
import { lineageDirectory, readFeatureLineage } from '../evolution/lineage';
import { evolveFeature, formatEvolutionHuman } from '../commands/evolve';
import { resolveOfficialFeatureDirectory } from '../package-root';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-evolve-'));
  fixtures.push(fixture);
  return fixture;
}
function createIO(): CliIO & { output: string[]; errors: string[] } {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    output,
    errors,
    stdout: (message) => output.push(message),
    stderr: (message) => errors.push(message),
  };
}

function installHealth(fixture: string): void {
  mkdirSync(path.join(fixture, 'src', 'app'), { recursive: true });
  writeFileSync(
    path.join(fixture, 'src', 'app', 'server.ts'),
    `import { Hono } from 'hono';\n\nexport const app = new Hono();\n`,
  );
  const result = installOfficialFeature('health', fixture);
  expect(result.ok).toBe(true);
}

function copyOfficialHealth(): string {
  const root = createFixture();
  const directory = path.join(root, 'health');
  cpSync(resolveOfficialFeatureDirectory('health'), directory, { recursive: true });
  return directory;
}

function healthIndex(fixture: string): string {
  return path.join(fixture, 'src/features/health/index.ts');
}

describe('evolve command', () => {
  it('parses evolve dry-run JSON options through the CLI router', () => {
    const fixture = createFixture();
    installHealth(fixture);
    const io = createIO();

    const result = runCli(['evolve', 'health', '--dry-run', '--json'], io, { cwd: fixture });

    expect(result.exitCode).toBe(0);
    expect(io.errors).toHaveLength(0);
    expect(JSON.parse(io.output.join('')).status).toBe('up-to-date');
  });
  it('keeps dry-run read-only while reporting architecture changes', () => {
    const fixture = createFixture();
    installHealth(fixture);
    const incoming = copyOfficialHealth();
    writeFileSync(path.join(incoming, 'index.ts'), `${readFileSync(path.join(incoming, 'index.ts'), 'utf8')}\nexport const healthVersion = 'next';\n`);
    writeFileSync(path.join(fixture, 'src/features/health/local.ts'), 'export const localCustomization = true;\n');
    const beforeFeature = readFileSync(healthIndex(fixture));
    const beforeLineage = readFileSync(path.join(lineageDirectory(fixture, 'health'), 'lineage.json'));

    const result = evolveFeature({ feature: 'health', cwd: fixture, officialDirectory: incoming, dryRun: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.status).toBe('dry-run');
    expect(result.plan.canApply).toBe(true);
    expect(result.plan.applied).toBe(false);
    expect(result.plan.files.find((file) => file.path === 'index.ts')?.action).toBe('update');
    expect(result.plan.files.find((file) => file.path === 'local.ts')?.action).toBe('keep-local');
    expect(result.plan.architecture?.changes.publicExports.some((delta) => delta.feature === 'health')).toBe(true);
    expect(readFileSync(healthIndex(fixture))).toEqual(beforeFeature);
    expect(readFileSync(path.join(lineageDirectory(fixture, 'health'), 'lineage.json'))).toEqual(beforeLineage);
  });

  it('applies a clean update, stores pure incoming lineage, and preserves customization on a second cycle', () => {
    const fixture = createFixture();
    installHealth(fixture);
    const incomingOne = copyOfficialHealth();
    writeFileSync(path.join(incomingOne, 'index.ts'), `${readFileSync(path.join(incomingOne, 'index.ts'), 'utf8')}\nexport const healthVersion = 'one';\n`);
    writeFileSync(path.join(fixture, 'src/features/health/local.ts'), 'export const localCustomization = 1;\n');

    const first = evolveFeature({ feature: 'health', cwd: fixture, officialDirectory: incomingOne });

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.plan.status).toBe('applied');
    expect(readFileSync(healthIndex(fixture), 'utf8')).toContain("healthVersion = 'one'");
    expect(readFileSync(path.join(fixture, 'src/features/health/local.ts'), 'utf8')).toContain('localCustomization');
    const firstLineage = readFeatureLineage(fixture, 'health');
    expect(firstLineage?.files.has('local.ts')).toBe(false);
    expect(firstLineage?.files.get('index.ts')?.toString()).toBe(readFileSync(path.join(incomingOne, 'index.ts'), 'utf8'));

    const incomingTwo = copyOfficialHealth();
    writeFileSync(path.join(incomingTwo, 'index.ts'), `${readFileSync(path.join(incomingTwo, 'index.ts'), 'utf8')}\nexport const healthVersion = 'two';\n`);
    writeFileSync(path.join(fixture, 'src/features/health/local.ts'), 'export const localCustomization = 2;\n');

    const second = evolveFeature({ feature: 'health', cwd: fixture, officialDirectory: incomingTwo });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.plan.status).toBe('applied');
    expect(readFileSync(healthIndex(fixture), 'utf8')).toContain("healthVersion = 'two'");
    expect(readFileSync(path.join(fixture, 'src/features/health/local.ts'), 'utf8')).toBe('export const localCustomization = 2;\n');
    const secondLineage = readFeatureLineage(fixture, 'health');
    expect(secondLineage?.files.get('index.ts')?.toString()).toBe(readFileSync(path.join(incomingTwo, 'index.ts'), 'utf8'));
    expect(readdirSync(path.join(fixture, 'src', 'features')).filter((entry) => entry.startsWith('.nara-'))).toEqual([]);
    expect(
      readdirSync(path.join(fixture, '.nara', 'lineage', 'official-features')).filter((entry) =>
        entry.startsWith('.nara-'),
      ),
    ).toEqual([]);
  });

  it('blocks text conflicts without markers or mutations', () => {
    const fixture = createFixture();
    installHealth(fixture);
    const incoming = copyOfficialHealth();
    const localIndex = healthIndex(fixture);
    const incomingIndex = path.join(incoming, 'index.ts');
    writeFileSync(localIndex, readFileSync(localIndex, 'utf8').replace("status: 'ok'", "status: 'local'"));
    writeFileSync(incomingIndex, readFileSync(incomingIndex, 'utf8').replace("status: 'ok'", "status: 'incoming'"));
    const beforeFeature = readFileSync(localIndex);
    const beforeLineage = readFileSync(path.join(lineageDirectory(fixture, 'health'), 'lineage.json'));

    const result = evolveFeature({ feature: 'health', cwd: fixture, officialDirectory: incoming });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.status).toBe('conflict');
    expect(result.plan.canApply).toBe(false);
    expect(result.plan.conflicts).toEqual(['index.ts']);
    expect(readFileSync(localIndex)).toEqual(beforeFeature);
    expect(readFileSync(localIndex, 'utf8')).not.toContain('<<<<<<<');
    expect(readFileSync(path.join(lineageDirectory(fixture, 'health'), 'lineage.json'))).toEqual(beforeLineage);
    const human = formatEvolutionHuman(result);
    expect(human).toContain('Conflicts:');
    expect(human).toContain('! index.ts');
    expect(human).toContain('Cannot apply: unresolved merge conflicts.');
  });

  it('bootstraps an identical legacy Feature but rejects a divergent one', () => {
    const fixture = createFixture();
    installHealth(fixture);
    rmSync(lineageDirectory(fixture, 'health'), { recursive: true, force: true });

    const bootstrapped = evolveFeature({ feature: 'health', cwd: fixture });

    expect(bootstrapped.ok).toBe(true);
    if (!bootstrapped.ok) return;
    expect(bootstrapped.plan.status).toBe('bootstrapped');
    expect(existsSync(path.join(lineageDirectory(fixture, 'health'), 'lineage.json'))).toBe(true);

    rmSync(lineageDirectory(fixture, 'health'), { recursive: true, force: true });
    writeFileSync(path.join(fixture, 'src/features/health/local.ts'), 'legacy customization\n');
    const divergent = evolveFeature({ feature: 'health', cwd: fixture });

    expect(divergent.ok).toBe(false);
    if (divergent.ok) return;
    expect(divergent.error.errorCode).toBe('missing-lineage');
    expect(divergent.error.message).toContain('cannot prove the historical official base');
    expect(existsSync(lineageDirectory(fixture, 'health'))).toBe(false);
  });

  it('reports application-owned Features and ignores local divergence when upstream is unchanged', () => {
    const fixture = createFixture();
    installHealth(fixture);
    writeFileSync(path.join(fixture, 'src/features/health/local.ts'), 'local customization\n');

    const unchanged = evolveFeature({ feature: 'health', cwd: fixture });
    const unknown = evolveFeature({ feature: 'billing', cwd: fixture });

    expect(unchanged.ok).toBe(true);
    if (unchanged.ok) expect(unchanged.plan.status).toBe('up-to-date');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error.errorCode).toBe('unknown-feature');
      expect(unknown.error.message).toBe('billing is application-owned and has no official upstream lineage.');
    }
  });
  it('rejects corrupted lineage before changing Feature source', () => {
    const fixture = createFixture();
    installHealth(fixture);
    const localIndex = healthIndex(fixture);
    const beforeFeature = readFileSync(localIndex);
    writeFileSync(path.join(lineageDirectory(fixture, 'health'), 'base', 'index.ts'), 'corrupted base\n');

    const result = evolveFeature({ feature: 'health', cwd: fixture });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.errorCode).toBe('lineage-error');
    expect(readFileSync(localIndex)).toEqual(beforeFeature);
  });

  it('blocks a newly introduced architecture diagnostic', () => {
    const fixture = createFixture();
    installHealth(fixture);
    expect(installOfficialFeature('audit', fixture).ok).toBe(true);
    const incoming = copyOfficialHealth();
    writeFileSync(
      path.join(incoming, 'index.ts'),
      `import type { AuditEvent } from '../audit/contract';\n${readFileSync(path.join(incoming, 'index.ts'), 'utf8')}`,
    );
    const beforeFeature = readFileSync(healthIndex(fixture));
    const beforeLineage = readFileSync(path.join(lineageDirectory(fixture, 'health'), 'lineage.json'));

    const result = evolveFeature({ feature: 'health', cwd: fixture, officialDirectory: incoming });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.status).toBe('architecture-regression');
    expect(result.plan.canApply).toBe(false);
    expect(result.plan.architecture?.introducedDiagnostics.some((issue) => issue.code === 'CROSS_FEATURE_INTERNAL_IMPORT')).toBe(true);
    expect(readFileSync(healthIndex(fixture))).toEqual(beforeFeature);
    expect(readFileSync(path.join(lineageDirectory(fixture, 'health'), 'lineage.json'))).toEqual(beforeLineage);
  });

  it('reports a valid official dependency change without blocking the apply', () => {
    const fixture = createFixture();
    installHealth(fixture);
    expect(installOfficialFeature('audit', fixture).ok).toBe(true);
    const incoming = copyOfficialHealth();
    writeFileSync(
      path.join(incoming, 'index.ts'),
      `import { createAuditEvent } from '../audit';\n${readFileSync(path.join(incoming, 'index.ts'), 'utf8')}`,
    );

    const result = evolveFeature({ feature: 'health', cwd: fixture, officialDirectory: incoming });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.status).toBe('applied');
    expect(result.plan.architecture?.changes.dependencies.added).toEqual(
      expect.arrayContaining([expect.objectContaining({ from: 'health', to: 'audit' })]),
    );
    expect(readFileSync(healthIndex(fixture), 'utf8')).toContain("from '../audit'");
  });
  it('tolerates an existing baseline diagnostic while reporting the candidate architecture change', () => {
    const fixture = createFixture();
    installHealth(fixture);
    expect(installOfficialFeature('audit', fixture).ok).toBe(true);
    const localIndex = healthIndex(fixture);
    writeFileSync(
      localIndex,
      `import type { AuditEvent } from '../audit/contract';\n${readFileSync(localIndex, 'utf8')}`,
    );
    const incoming = copyOfficialHealth();
    writeFileSync(path.join(incoming, 'index.ts'), `${readFileSync(path.join(incoming, 'index.ts'), 'utf8')}\nexport const healthVersion = 'next';\n`);

    const result = evolveFeature({ feature: 'health', cwd: fixture, officialDirectory: incoming });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.status).toBe('applied');
    expect(result.plan.architecture?.introducedDiagnostics).toEqual([]);
    expect(readFileSync(localIndex, 'utf8')).toContain("healthVersion = 'next'");
  });
});
