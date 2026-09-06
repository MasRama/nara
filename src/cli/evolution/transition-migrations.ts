import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { discoverMigrations, migrate } from '../../shared/database/migrator';

export interface RehearsalResult {
  status: 'pass' | 'fail' | 'missing' | 'unsupported';
  detail: string;
  fixtureDigest?: string;
  historyIds?: string[];
  limitations?: string[];
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function integrityDetails(database: Database.Database): string | undefined {
  const integrity = database.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check: string }>;
  if (integrity.length !== 1 || integrity[0]?.integrity_check !== 'ok') {
    return `integrity_check failed: ${JSON.stringify(integrity)}`;
  }
  const foreignKeys = database.prepare('PRAGMA foreign_key_check').all() as unknown[];
  if (foreignKeys.length > 0) {
    return `foreign_key_check failed: ${JSON.stringify(foreignKeys)}`;
  }
  return undefined;
}

/**
 * Stage candidate feature trees into a temp features root so the existing
 * SQLite migrator can rehearse the exact candidate migration set. Ownership
 * moves are compatible when identity, filename, bytes, and checksum match:
 * the migrator keys history by id and validates name+checksum, never by
 * source ownership, so a same-bytes move rehearses cleanly.
 */
export function stageCandidateFeatureRoots(
  candidateFeatures: Map<string, Map<string, Buffer>>,
  otherFeatureRoots?: string[],
): { directory: string; featuresRoot: string } {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nara-transition-migrations-'));
  const featuresRoot = path.join(directory, 'features');
  mkdirSync(featuresRoot, { recursive: true });
  for (const [feature, files] of candidateFeatures) {
    for (const [relativePath, bytes] of files) {
      if (!relativePath.includes('migrations/') || !relativePath.endsWith('.sql')) continue;
      const target = path.join(featuresRoot, feature, relativePath);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, bytes);
    }
  }
  if (otherFeatureRoots) {
    for (const otherRoot of otherFeatureRoots) {
      if (!existsSync(otherRoot)) continue;
      for (const entry of readdirSync(otherRoot)) {
        const source = path.join(otherRoot, entry);
        const target = path.join(featuresRoot, entry);
        if (existsSync(target)) continue;
        try {
          cpSync(source, target, { recursive: true });
        } catch {
          continue;
        }
      }
    }
  }
  return { directory, featuresRoot };
}

export function rehearseFreshMigration(featureRoots: string[]): RehearsalResult {
  let database: Database.Database | undefined;
  try {
    const migrations = discoverMigrations({ featureRoots });
    database = new Database(':memory:');
    migrate({ database, featureRoots });
    const problem = integrityDetails(database);
    if (problem) {
      return { status: 'fail', detail: `Fresh migration rehearsal failed: ${problem}.` };
    }
    if (migrations.length === 0) {
      return { status: 'pass', detail: 'Fresh migration rehearsal passed with no migrations.', historyIds: [] };
    }
    return {
      status: 'pass',
      detail: `Fresh migration rehearsal applied ${migrations.length} migration(s) with integrity and foreign-key checks.`,
      historyIds: migrations.map((migration) => migration.id),
    };
  } catch (error) {
    return {
      status: 'fail',
      detail: `Fresh migration rehearsal failed: ${error instanceof Error ? error.message : String(error)}.`,
    };
  } finally {
    try {
      database?.close();
    } catch {
      /* ignore */
    }
  }
}

export interface HistoryFixtureInput {
  fixturePath?: string;
}

/**
 * Rehearse pending candidate migrations against a cloned existing history.
 * The original fixture is never mutated; its bytes are fingerprinted and the
 * represented ledger history is recorded. Modified applied migrations BLOCK
 * before SQL executes via the migrator's checksum validation. Without a
 * reproducible fixture the scenario is UNVERIFIED, never assumed.
 */
export function rehearseHistoryMigration(
  featureRoots: string[],
  input: HistoryFixtureInput = {},
): RehearsalResult {
  if (!input.fixturePath || !existsSync(input.fixturePath)) {
    return {
      status: 'missing',
      detail:
        'Existing-history rehearsal was not established: no representative existing-history fixture is available.',
      limitations: [
        'Fresh installation and code checks do not prove adoption against this application\u2019s existing database history.',
      ],
    };
  }
  const fixtureDigest = sha256File(input.fixturePath);
  const workDirectory = mkdtempSync(path.join(os.tmpdir(), 'nara-transition-history-'));
  const clonePath = path.join(workDirectory, 'history-clone.sqlite3');
  let database: Database.Database | undefined;
  try {
    copyFileSync(input.fixturePath, clonePath);
    database = new Database(clonePath);
    let before: string[] = [];
    try {
      before = (database.prepare('SELECT id FROM _nara_migrations ORDER BY id').all() as Array<{ id: string }>).map(
        (row) => row.id,
      );
    } catch {
      before = [];
    }
    try {
      migrate({ database, featureRoots });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('no longer matches') || message.includes('is missing')) {
        return {
          status: 'fail',
          detail: `Existing-history rehearsal BLOCKED before applying SQL: ${message}`,
          fixtureDigest,
          historyIds: before,
        };
      }
      return {
        status: 'fail',
        detail: `Existing-history rehearsal failed: ${message}`,
        fixtureDigest,
        historyIds: before,
      };
    }
    const problem = integrityDetails(database);
    if (problem) {
      return {
        status: 'fail',
        detail: `Existing-history rehearsal failed: ${problem}.`,
        fixtureDigest,
        historyIds: before,
      };
    }
    return {
      status: 'pass',
      detail: `Existing-history rehearsal applied pending candidate migrations on history [${before.join(', ') || 'empty'}] with integrity checks.`,
      fixtureDigest,
      historyIds: before,
    };
  } catch (error) {
    return {
      status: 'fail',
      detail: `Existing-history rehearsal failed: ${error instanceof Error ? error.message : String(error)}.`,
      fixtureDigest,
    };
  } finally {
    try {
      database?.close();
    } catch {
      /* ignore */
    }
    rmSync(workDirectory, { recursive: true, force: true });
  }
}
