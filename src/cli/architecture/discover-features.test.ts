import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverFeatures } from './discover-features';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-discovery-'));
  fixtures.push(fixture);
  return fixture;
}

function writeFeature(fixture: string, name: string, files: Record<string, string>): void {
  const directory = path.join(fixture, 'src/features', name);
  for (const [file, content] of Object.entries(files)) {
    const filePath = path.join(directory, file);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
  }
}

describe('feature discovery', () => {
  it('discovers valid features in deterministic order', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', { 'index.ts': 'export {};\n' });
    writeFeature(fixture, 'billing', {
      'index.ts': 'export {};\n',
      'contract.ts': 'export type BillingInput = {};\n',
      'server/routes.ts': 'export {};\n',
    });

    const result = discoverFeatures(fixture);

    expect(result.features.map((feature) => feature.name)).toEqual(['billing', 'users']);
    expect(result.features[0]).toMatchObject({
      directory: 'src/features/billing',
      hasContract: true,
      layers: ['server'],
      hasPublicIndex: true,
    });
    expect(result.malformed).toHaveLength(0);
  });

  it('reports malformed entries without aborting valid discovery', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'valid', { 'index.ts': 'export {};\n' });
    writeFeature(fixture, 'missing-index', { 'contract.ts': 'export {};\n' });
    mkdirSync(path.join(fixture, 'src/features'), { recursive: true });
    writeFileSync(path.join(fixture, 'src/features/not-a-feature.ts'), 'export {};\n');

    const result = discoverFeatures(fixture);

    expect(result.features.map((feature) => feature.name)).toEqual(['valid']);
    expect(result.malformed.map((entry) => entry.name)).toEqual(['missing-index', 'not-a-feature.ts']);
    expect(result.malformed.map((entry) => entry.reason)).toEqual([
      'feature is missing its public index.ts',
      'feature entry is not a directory',
    ]);
  });

  it('returns an empty result when the features directory is absent', () => {
    const result = discoverFeatures(createFixture());

    expect(result).toEqual({ features: [], malformed: [] });
  });
});
