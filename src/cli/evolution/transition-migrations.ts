import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {
  discoverMigrationsInFeaturesDir,
  stageCandidateFeatureRoots,
  type TransitionMigrationFile,
} from './transition-migration-files';

export { stageCandidateFeatureRoots };

export interface RehearsalResult {
  status: 'pass' | 'fail' | 'missing' | 'unsupported';
  detail: string;
  fixtureDigest?: string;
  historyIds?: string[];
  limitations?: string[];
}

/**
 * Minimal structural handle over the lazily loaded SQLite runtime. The
 * `better-sqlite3` package is never imported statically: unrelated CLI
 * commands (notably `nara new` from the packed artifact, whose only
 * runtime dependency is `typescript`) must not require the migration
 * rehearsal runtime at startup.
 */
interface RehearsalDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): unknown;
  };
  close(): void;
}

type DatabaseConstructor = new (filename: string) => RehearsalDatabase;

interface LedgerRow {
  id: string;
  name: string;
  checksum: string;
}

const MIGRATION_LEDGER = '_nara_migrations';

/**
 * Load the SQLite rehearsal runtime only when migration evidence actually
 * executes. Resolution prefers the target application's own dependency
 * (pinned generated apps carry `better-sqlite3` themselves) and falls
 * back to the ambient resolution scope. Set NARA_TRANSITION_NO_SQLITE=1
 * to force the unavailable path (tests, minimal environments).
 */
function loadDatabaseConstructor(appRoot?: string): DatabaseConstructor | undefined {
  if (process.env.NARA_TRANSITION_NO_SQLITE === '1') return undefined;
  const anchors = [
    ...(appRoot ? [path.join(appRoot, 'package.json')] : []),
    path.join(process.cwd(), 'package.json'),
  ];
  for (const anchor of anchors) {
    try {
      const loaded = createRequire(anchor)('better-sqlite3') as { default?: unknown } | DatabaseConstructor;
      const candidate =
        typeof loaded === 'function' ? loaded : (loaded as { default?: unknown }).default;
      if (typeof candidate === 'function') return candidate as DatabaseConstructor;
    } catch {
      continue;
    }
  }
  return undefined;
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}


function ensureLedger(database: RehearsalDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_LEDGER} (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0
    )
  `);
}

function readLedger(database: RehearsalDatabase): LedgerRow[] {
  return database
    .prepare(`SELECT id, name, checksum FROM ${MIGRATION_LEDGER} ORDER BY id ASC`)
    .all() as LedgerRow[];
}

/**
 * Mirror the canonical migrator's history protection exactly: an applied
 * migration must still exist under its ID with a compatible filename and
 * identical bytes. A modified history BLOCKS before any SQL executes; the
 * remedy is a new forward migration, never a ledger rewrite.
 */
function validateHistory(
  database: RehearsalDatabase,
  migrations: TransitionMigrationFile[],
): Map<string, LedgerRow> {
  ensureLedger(database);
  const rows = readLedger(database);
  const filesById = new Map(migrations.map((migration) => [migration.id, migration]));
  for (const row of rows) {
    const migration = filesById.get(row.id);
    if (!migration) {
      throw new Error(
        `Applied migration "${row.name}" (${row.id}) is missing from Feature migration directories. ` +
        'Applied migrations are immutable; restore the file or add a corrective forward migration.',
      );
    }
    if (row.name !== migration.name || row.checksum !== migration.checksum) {
      throw new Error(
        `Applied migration "${row.name}" (${row.id}) no longer matches "${migration.path}".\n` +
        'Applied migration files are immutable. Restore the original file or create a new forward migration; ' +
        'do not edit migration history.',
      );
    }
  }
  return new Map(rows.map((row) => [row.id, row]));
}

function rollback(database: RehearsalDatabase): void {
  try {
    database.exec('ROLLBACK');
  } catch {
    /* already rolled back or nothing to roll back */
  }
}

function applyMigration(database: RehearsalDatabase, migration: TransitionMigrationFile): void {
  database.exec('BEGIN IMMEDIATE');
  try {
    const row = database
      .prepare(`SELECT id, name, checksum FROM ${MIGRATION_LEDGER} WHERE id = ?`)
      .get(migration.id) as LedgerRow | undefined;
    if (row) {
      if (row.name !== migration.name || row.checksum !== migration.checksum) {
        throw new Error(
          `Applied migration "${row.name}" (${row.id}) no longer matches "${migration.path}".\n` +
          'Applied migration files are immutable. Restore the original file or create a new forward migration; ' +
          'do not edit migration history.',
        );
      }
      database.exec('COMMIT');
      return;
    }
    const sameName = database.prepare(`SELECT id FROM ${MIGRATION_LEDGER} WHERE name = ?`).get(migration.name) as
      | { id: string }
      | undefined;
    if (sameName) {
      throw new Error(
        `Migration "${migration.name}" is already recorded under ID "${sameName.id}"; migration names and IDs are immutable.`,
      );
    }
    const startedAt = Date.now();
    database.exec(migration.sql);
    database
      .prepare(
        `INSERT INTO ${MIGRATION_LEDGER} (id, name, checksum, applied_at, duration_ms) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(migration.id, migration.name, migration.checksum, Date.now(), Date.now() - startedAt);
    database.exec('COMMIT');
  } catch (error) {
    rollback(database);
    if (error instanceof Error && error.message.startsWith('Applied migration')) throw error;
    if (error instanceof Error && error.message.includes('already recorded under ID')) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Migration "${migration.name}" failed and was rolled back: ${message}`);
  }
}

function integrityProblem(database: RehearsalDatabase): string | undefined {
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

export interface RehearsalOptions {
  appRoot?: string;
}

function unavailable(detail: string): RehearsalResult {
  return {
    status: 'unsupported',
    detail,
    limitations: ['SQLite rehearsal requires the better-sqlite3 runtime, which is unavailable in this environment.'],
  };
}

export function rehearseFreshMigration(featureRoots: string[], options: RehearsalOptions = {}): RehearsalResult {
  const Database = loadDatabaseConstructor(options.appRoot);
  if (!Database) {
    return unavailable(
      'Fresh migration rehearsal was not executed: the SQLite rehearsal runtime is unavailable in this environment.',
    );
  }
  let database: RehearsalDatabase | undefined;
  try {
    const migrations = featureRoots.flatMap((root) => discoverMigrationsInFeaturesDir(root));
    database = new Database(':memory:');
    validateHistory(database, migrations);
    for (const migration of migrations) applyMigration(database, migration);
    const problem = integrityProblem(database);
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
 * The original fixture is never mutated; its bytes are fingerprinted and
 * the represented ledger history is recorded. Modified applied migrations
 * BLOCK before SQL executes. Without a reproducible fixture the scenario
 * is UNVERIFIED, never assumed.
 */
export function rehearseHistoryMigration(
  featureRoots: string[],
  input: HistoryFixtureInput = {},
  options: RehearsalOptions = {},
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
  const Database = loadDatabaseConstructor(options.appRoot);
  if (!Database) {
    return unavailable(
      'Existing-history rehearsal was not executed: the SQLite rehearsal runtime is unavailable in this environment.',
    );
  }
  const fixtureDigest = sha256File(input.fixturePath);
  const workDirectory = mkdtempSync(path.join(os.tmpdir(), 'nara-transition-history-'));
  const clonePath = path.join(workDirectory, 'history-clone.sqlite3');
  let database: RehearsalDatabase | undefined;
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
      const migrations = featureRoots.flatMap((root) => discoverMigrationsInFeaturesDir(root));
      validateHistory(database, migrations);
      for (const migration of migrations) applyMigration(database, migration);
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
    const problem = integrityProblem(database);
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
