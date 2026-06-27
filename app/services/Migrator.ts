import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import SQLite from './SQLite';
import Logger from './Logger';

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');

type MigrationStep = string | ((sqlite: typeof SQLite) => void);

interface Migration {
  up: MigrationStep;
  down?: MigrationStep;
}

function ensureMigrationsTable(): void {
  SQLite.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      run_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function appliedMigrations(): Set<string> {
  ensureMigrationsTable();
  const rows = SQLite.all<{ name: string }>('SELECT name FROM migrations');
  return new Set(rows.map(r => r.name));
}

function listMigrationFiles(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
    .filter(f => !f.endsWith('.d.ts'))
    .sort();
}

function loadMigration(file: string): Migration {
  const fullPath = join(MIGRATIONS_DIR, file);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(fullPath) as Migration;
  if (typeof mod.up !== 'string' && typeof mod.up !== 'function') {
    throw new Error(`Migration ${file} must export 'up' as string or function`);
  }
  return mod;
}

function execStep(step: MigrationStep): void {
  if (typeof step === 'string') {
    SQLite.raw().exec(step);
  } else {
    step(SQLite);
  }
}

export function migrate(): { applied: string[]; skipped: string[] } {
  const applied = appliedMigrations();
  const files = listMigrationFiles();
  const newlyApplied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (applied.has(file)) {
      skipped.push(file);
      continue;
    }

    const migration = loadMigration(file);
    SQLite.transaction(() => {
      execStep(migration.up);
      SQLite.run('INSERT INTO migrations (name) VALUES (?)', [file]);
    });

    newlyApplied.push(file);
    Logger.info(`Migration applied: ${file}`);
  }

  if (newlyApplied.length === 0) {
    Logger.info('No pending migrations');
  }

  return { applied: newlyApplied, skipped };
}

export function migrateRollback(steps = 1): { rolledBack: string[] } {
  const rows = SQLite.all<{ name: string }>(
    'SELECT name FROM migrations ORDER BY id DESC LIMIT ?', [steps]
  );
  const rolledBack: string[] = [];

  for (const { name } of rows) {
    const migration = loadMigration(name);
    if (!migration.down) {
      Logger.warn(`Migration ${name} has no down — skipping`);
      continue;
    }
    SQLite.transaction(() => {
      execStep(migration.down as MigrationStep);
      SQLite.run('DELETE FROM migrations WHERE name = ?', [name]);
    });
    rolledBack.push(name);
    Logger.info(`Migration rolled back: ${name}`);
  }

  return { rolledBack };
}

export function migrateStatus(): { applied: string[]; pending: string[] } {
  const applied = appliedMigrations();
  const files = listMigrationFiles();
  const pending = files.filter(f => !applied.has(f));
  return { applied: [...applied], pending };
}

export function migrateFresh(): { applied: string[] } {
  const db = SQLite.raw();
  const prevFk = db.pragma('foreign_keys', { simple: true });
  db.pragma('foreign_keys = OFF');

  try {
    const tables = SQLite.all<{ name: string }>(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'migrations'
    `);
    for (const { name } of tables) {
      SQLite.run(`DROP TABLE IF EXISTS "${name}"`);
    }
    SQLite.run('DELETE FROM migrations WHERE 1=1');
  } catch {
    // migrations table may not exist yet on a fresh DB — that's fine
  } finally {
    db.pragma(`foreign_keys = ${prevFk ? 'ON' : 'OFF'}`);
  }

  const result = migrate();
  return { applied: result.applied };
}

export default { migrate, migrateRollback, migrateStatus, migrateFresh };
