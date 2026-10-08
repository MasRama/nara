// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverMigrations, migrate, outstandingMigrations } from '../migrator';

const roots: string[] = [];

/** A features root holding one Feature with one migration. */
function fixtureFeaturesRoot(feature: string): string {
  const root = mkdtempSync(join(tmpdir(), 'nara-outstanding-'));
  roots.push(root);
  const directory = join(root, feature, 'server', 'migrations');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, '209901010001_create_invoices.sql'), 'CREATE TABLE invoices (id TEXT PRIMARY KEY);\n');
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('outstanding migrations', () => {
  it('attributes each discovered migration to its Feature directory', () => {
    const featureRoots = [fixtureFeaturesRoot('billing')];
    expect(discoverMigrations({ featureRoots }).map(({ feature, name }) => ({ feature, name }))).toEqual([
      { feature: 'billing', name: '209901010001_create_invoices.sql' },
    ]);
  });

  it('reports a new Feature migration until it is applied, without writing to the database', () => {
    const featureRoots = [fixtureFeaturesRoot('billing')];
    const migrations = discoverMigrations({ featureRoots });
    const database = new Database(':memory:');
    try {
      expect(outstandingMigrations(database, migrations).map((migration) => migration.feature)).toEqual(['billing']);
      expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).toEqual([]);

      migrate({ database, featureRoots });
      expect(outstandingMigrations(database, migrations)).toEqual([]);
    } finally {
      database.close();
    }
  });
});
