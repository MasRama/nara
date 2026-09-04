import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { captureArchitectureSnapshot } from './snapshot';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function createFixture(): string {
  const fixture = mkdtempSync(path.join(os.tmpdir(), 'nara-snapshot-'));
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

describe('architecture snapshot', () => {
  it('captures features in deterministic sorted order', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', { 'index.ts': 'export const users = 1;\n' });
    writeFeature(fixture, 'billing', {
      'index.ts': 'export const billing = 1;\n',
      'contract.ts': 'export type BillingInput = { id: string };\n',
      'server/routes.ts': 'export const routes = 1;\n',
      'web/page.ts': 'export const page = 1;\n',
      'tests/billing.test.ts': 'export const test = 1;\n',
    });

    const snapshot = captureArchitectureSnapshot(fixture);

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.features.map((feature) => feature.name)).toEqual(['billing', 'users']);
    expect(snapshot.features[0]).toMatchObject({
      name: 'billing',
      publicExports: ['billing'],
      contractExports: ['BillingInput'],
      serverSurfaces: ['server/routes.ts'],
      webSurfaces: ['web/page.ts'],
      testSurfaces: ['tests/billing.test.ts'],
    });
  });

  it('produces stable output without timestamps or absolute paths', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'health', { 'index.ts': 'export const healthRoutes = 1;\n' });

    const first = JSON.stringify(captureArchitectureSnapshot(fixture));
    const second = JSON.stringify(captureArchitectureSnapshot(fixture));

    expect(second).toBe(first);
    expect(first).not.toContain(fixture);
    expect(first).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('sorts dependencies and diagnostics deterministically', () => {
    const fixture = createFixture();
    writeFeature(fixture, 'users', { 'index.ts': 'export const users = 1;\n' });
    writeFeature(fixture, 'billing', {
      'index.ts': "import '@/features/users';\nexport const billing = 1;\n",
    });
    writeFeature(fixture, 'reports', {
      'index.ts': "import '@/features/users';\nimport '@/features/billing';\nexport const reports = 1;\n",
    });

    const snapshot = captureArchitectureSnapshot(fixture);

    expect(snapshot.dependencies.map((edge) => `${edge.from}->${edge.to}`)).toEqual([
      'billing->users',
      'reports->billing',
      'reports->users',
    ]);
    for (const edge of snapshot.dependencies) {
      expect([...edge.imports].sort()).toEqual(edge.imports);
      expect([...edge.sourceFiles].sort()).toEqual(edge.sourceFiles);
      for (const file of edge.sourceFiles) {
        expect(path.isAbsolute(file)).toBe(false);
        expect(file).not.toContain('\\');
      }
    }
  });
});
