import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { env } from '../config';
import { getDatabase } from './sqlite';

const MIGRATION_FILE_PATTERN = /^(\d+)_([a-z0-9][a-z0-9_-]*)\.sql$/;
const MIGRATION_LEDGER = '_nara_migrations';

const LEGACY_BASELINE = [
  { id: '202609030001', name: '202609030001_create_users.sql' },
  { id: '202609030002', name: '202609030002_create_sessions.sql' },
  { id: '202609030003', name: '202609030003_create_roles.sql' },
  { id: '202609030004', name: '202609030004_create_permissions.sql' },
  { id: '202609030005', name: '202609030005_create_role_permissions.sql' },
  { id: '202609030006', name: '202609030006_create_user_roles.sql' },
  { id: '202609030007', name: '202609030007_create_assets.sql' },
] as const;

const LEGACY_BASELINE_IDS: ReadonlySet<string> = new Set(LEGACY_BASELINE.map((migration) => migration.id));

interface TableColumn {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

interface ForeignKey {
  table: string;
  from: string;
  to: string;
  on_delete: string;
  on_update: string;
}

interface IndexDefinition {
  name: string;
  unique: number;
  origin: string;
}

interface IndexColumn {
  name: string;
}

interface SchemaTableExpectation {
  columns: Array<Pick<TableColumn, 'name' | 'type' | 'notnull' | 'pk'>>;
  foreignKeys: ForeignKey[];
  indexes: Array<{ name: string; columns: string[] }>;
  uniqueIndexes: string[][];
}


const LEGACY_SCHEMA: Record<string, SchemaTableExpectation> = {
  users: {
    columns: [
      { name: 'id', type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'name', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'email', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'password', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'avatar', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'created_at', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'updated_at', type: 'INTEGER', notnull: 1, pk: 0 },
    ],
    foreignKeys: [],
    indexes: [],
    uniqueIndexes: [['email']],
  },
  sessions: {
    columns: [
      { name: 'id', type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'user_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'user_agent', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'expires_at', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'created_at', type: 'INTEGER', notnull: 1, pk: 0 },
    ],
    foreignKeys: [{ table: 'users', from: 'user_id', to: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' }],
    indexes: [
      { name: 'idx_sessions_user_id', columns: ['user_id'] },
      { name: 'idx_sessions_expires_at', columns: ['expires_at'] },
    ],
    uniqueIndexes: [],
  },
  roles: {
    columns: [
      { name: 'id', type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'slug', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'description', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'created_at', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'updated_at', type: 'INTEGER', notnull: 1, pk: 0 },
    ],
    foreignKeys: [],
    indexes: [],
    uniqueIndexes: [['slug']],
  },
  permissions: {
    columns: [
      { name: 'id', type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'name', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'slug', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'resource', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'action', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'description', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'created_at', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'updated_at', type: 'INTEGER', notnull: 1, pk: 0 },
    ],
    foreignKeys: [],
    indexes: [],
    uniqueIndexes: [['slug']],
  },
  role_permissions: {
    columns: [
      { name: 'id', type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'role_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'permission_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_at', type: 'INTEGER', notnull: 1, pk: 0 },
    ],
    foreignKeys: [
      { table: 'roles', from: 'role_id', to: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
      { table: 'permissions', from: 'permission_id', to: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
    ],
    indexes: [],
    uniqueIndexes: [['role_id', 'permission_id']],
  },
  user_roles: {
    columns: [
      { name: 'id', type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'user_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'role_id', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'created_at', type: 'INTEGER', notnull: 1, pk: 0 },
    ],
    foreignKeys: [
      { table: 'users', from: 'user_id', to: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
      { table: 'roles', from: 'role_id', to: 'id', on_delete: 'CASCADE', on_update: 'NO ACTION' },
    ],
    indexes: [],
    uniqueIndexes: [['user_id', 'role_id']],
  },
  assets: {
    columns: [
      { name: 'id', type: 'TEXT', notnull: 1, pk: 1 },
      { name: 'name', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'type', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'url', type: 'TEXT', notnull: 1, pk: 0 },
      { name: 'mime_type', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'size', type: 'INTEGER', notnull: 0, pk: 0 },
      { name: 's3_key', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'user_id', type: 'TEXT', notnull: 0, pk: 0 },
      { name: 'created_at', type: 'INTEGER', notnull: 1, pk: 0 },
      { name: 'updated_at', type: 'INTEGER', notnull: 1, pk: 0 },
    ],
    foreignKeys: [{ table: 'users', from: 'user_id', to: 'id', on_delete: 'SET NULL', on_update: 'NO ACTION' }],
    indexes: [
      { name: 'idx_assets_user_id', columns: ['user_id'] },
      { name: 'idx_assets_s3_key', columns: ['s3_key'] },
    ],
    uniqueIndexes: [],
  },
};

export interface MigrationFile {
  id: string;
  name: string;
  path: string;
  sql: string;
  checksum: string;
}

export interface MigrationOptions {
  database?: Database.Database;
  root?: string;
  featureRoots?: string[];
}

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export interface MigrationStatus {
  applied: string[];
  pending: string[];
}

interface LedgerRow {
  id: string;
  name: string;
  checksum: string;
  applied_at: number;
}

interface SchemaObject {
  type: 'table' | 'trigger' | 'view';
  name: string;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function checksum(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

function migrationRoots(options: MigrationOptions): string[] {
  if (options.featureRoots) {
    return [...new Set(options.featureRoots.map((root) => path.resolve(root)))];
  }

  if (options.root) {
    return [path.resolve(options.root, 'src', 'features')];
  }

  const sourceRoot = path.resolve(process.cwd(), 'src', 'features');
  const runtimeRoot = path.resolve(__dirname, '..', '..', 'features');
  return [existsSync(runtimeRoot) ? runtimeRoot : sourceRoot];
}

function compareMigrationIds(left: string, right: string): number {
  const leftNumber = BigInt(left);
  const rightNumber = BigInt(right);
  if (leftNumber < rightNumber) return -1;
  if (leftNumber > rightNumber) return 1;
  return 0;
}

function readMigrationFiles(root: string): MigrationFile[] {
  if (!existsSync(root)) return [];

  const migrations: MigrationFile[] = [];
  const features = readdirSync(root, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  for (const feature of features) {
    if (!feature.isDirectory() || feature.name.startsWith('.')) continue;

    const directory = path.join(root, feature.name, 'server', 'migrations');
    if (!existsSync(directory)) continue;

    const files = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (const file of files) {
      if (!file.isFile() || file.name.endsWith('.d.ts')) continue;
      if (!file.name.endsWith('.sql')) {
        throw new Error(
          `Invalid migration file "${path.join(directory, file.name)}". ` +
            'Feature migrations must use .sql files.',
        );
      }

      const match = MIGRATION_FILE_PATTERN.exec(file.name);
      if (!match) {
        throw new Error(
          `Invalid migration filename "${path.join(directory, file.name)}". ` +
            'Expected <numeric-id>_<description>.sql.',
        );
      }

      const filePath = path.join(directory, file.name);
      const sql = readFileSync(filePath, 'utf8');
      if (sql.trim().length === 0) {
        throw new Error(`Migration "${filePath}" is empty.`);
      }

      migrations.push({
        id: match[1],
        name: file.name,
        path: filePath,
        sql,
        checksum: checksum(sql),
      });
    }
  }

  migrations.sort((left, right) => {
    const idOrder = compareMigrationIds(left.id, right.id);
    if (idOrder !== 0) return idOrder;
    return left.path.localeCompare(right.path);
  });

  for (let index = 1; index < migrations.length; index += 1) {
    const previous = migrations[index - 1];
    const current = migrations[index];
    if (previous.id === current.id) {
      throw new Error(
        `Duplicate migration ID "${current.id}" found:\n` +
          `  - ${previous.path}\n` +
          `  - ${current.path}\n` +
          'Migration IDs must be globally unique across all Features.',
      );
    }
  }

  return migrations;
}

export function discoverMigrations(options: MigrationOptions = {}): MigrationFile[] {
  const migrations = migrationRoots(options).flatMap((root) => readMigrationFiles(root));
  migrations.sort((left, right) => {
    const idOrder = compareMigrationIds(left.id, right.id);
    if (idOrder !== 0) return idOrder;
    return left.path.localeCompare(right.path);
  });

  for (let index = 1; index < migrations.length; index += 1) {
    const previous = migrations[index - 1];
    const current = migrations[index];
    if (previous.id === current.id) {
      throw new Error(
        `Duplicate migration ID "${current.id}" found:\n` +
          `  - ${previous.path}\n` +
          `  - ${current.path}\n` +
          'Migration IDs must be globally unique across all Features.',
      );
    }
  }

  return migrations;
}

function ensureLedger(database: Database.Database): void {
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

function readLedger(database: Database.Database): LedgerRow[] {
  return database
    .prepare(
      `SELECT id, name, checksum, applied_at
       FROM ${MIGRATION_LEDGER}
       ORDER BY id ASC`,
    )
    .all() as LedgerRow[];
}


function validateAppliedMigration(
  migration: MigrationFile,
  row: LedgerRow,
): void {
  if (row.name !== migration.name || row.checksum !== migration.checksum) {
    throw new Error(
      `Applied migration "${row.name}" (${row.id}) no longer matches "${migration.path}".\n` +
        'Applied migration files are immutable. Restore the original file or create a new forward migration; ' +
        'do not edit migration history.',
    );
  }
}

function validateLedgerAgainstFiles(
  database: Database.Database,
  migrations: MigrationFile[],
): Map<string, LedgerRow> {
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
    validateAppliedMigration(migration, row);
  }

  return new Map(rows.map((row) => [row.id, row]));
}

function tableExists(database: Database.Database, table: string): boolean {
  const row = database
    .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { present: number } | undefined;
  return row !== undefined;
}
function tableDefinition(database: Database.Database, table: string): string | undefined {
  const row = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { sql: string | null } | undefined;
  return row?.sql ?? undefined;
}

function tableColumns(database: Database.Database, table: string): TableColumn[] {
  return database.pragma(`table_info(${quoteIdentifier(table)})`) as TableColumn[];
}

function tableForeignKeys(database: Database.Database, table: string): ForeignKey[] {
  return (database.pragma(`foreign_key_list(${quoteIdentifier(table)})`) as ForeignKey[]).map((foreignKey) => ({
    table: foreignKey.table,
    from: foreignKey.from,
    to: foreignKey.to,
    on_delete: foreignKey.on_delete.toUpperCase(),
    on_update: foreignKey.on_update.toUpperCase(),
  }));
}

function tableIndexes(database: Database.Database, table: string): IndexDefinition[] {
  return database.pragma(`index_list(${quoteIdentifier(table)})`) as IndexDefinition[];
}

function indexColumns(database: Database.Database, index: string): string[] {
  return (database.pragma(`index_info(${quoteIdentifier(index)})`) as IndexColumn[]).map((column) => column.name);
}

function sameColumns(actual: TableColumn[], expected: SchemaTableExpectation['columns']): boolean {
  return (
    actual.length === expected.length &&
    actual.every((column, index) => {
      const expectedColumn = expected[index];
      return (
        column.name === expectedColumn.name &&
        column.type.toUpperCase() === expectedColumn.type &&
        column.notnull === expectedColumn.notnull &&
        column.pk === expectedColumn.pk
      );
    })
  );
}

function sameForeignKeys(actual: ForeignKey[], expected: ForeignKey[]): boolean {
  const normalize = (foreignKey: ForeignKey) =>
    `${foreignKey.table}\u0000${foreignKey.from}\u0000${foreignKey.to}\u0000${foreignKey.on_delete.toUpperCase()}\u0000${foreignKey.on_update.toUpperCase()}`;
  return actual.map(normalize).sort().join('\n') === expected.map(normalize).sort().join('\n');
}

function sameIndexes(
  database: Database.Database,
  table: string,
  expected: SchemaTableExpectation['indexes'],
  expectedUnique: SchemaTableExpectation['uniqueIndexes'],
): boolean {
  const indexes = tableIndexes(database, table);
  const actual = new Map(indexes.map((index) => [index.name, index]));
  const explicitIndexesMatch = expected.every((index) => {
    const actualIndex = actual.get(index.name);
    return (
      actualIndex !== undefined &&
      actualIndex.unique === 0 &&
      indexColumns(database, index.name).join('\u0000') === index.columns.join('\u0000')
    );
  });
  const actualUnique = indexes
    .filter((index) => index.unique === 1 && index.origin === 'u')
    .map((index) => indexColumns(database, index.name).join('\u0000'))
    .sort();
  const expectedUniqueColumns = expectedUnique.map((columns) => columns.join('\u0000')).sort();
  return explicitIndexesMatch && actualUnique.join('\n') === expectedUniqueColumns.join('\n');
}

function legacySchemaMatches(database: Database.Database): boolean {
  return Object.entries(LEGACY_SCHEMA).every(([table, expected]) => {
    const definition = tableDefinition(database, table);
    if (!definition || /\)\s*STRICT\b/i.test(definition)) return false;
    return (
      sameColumns(tableColumns(database, table), expected.columns) &&
      sameForeignKeys(tableForeignKeys(database, table), expected.foreignKeys) &&
      sameIndexes(database, table, expected.indexes, expected.uniqueIndexes)
    );
  });
}

function hasPartialLegacySchema(database: Database.Database): boolean {
  return Object.keys(LEGACY_SCHEMA).some((table) => tableExists(database, table)) && !legacySchemaMatches(database);
}

function beginImmediate(database: Database.Database): void {
  database.exec('BEGIN IMMEDIATE');
}

function rollback(database: Database.Database): void {
  try {
    database.exec('ROLLBACK');
  } catch {
    // Preserve the original migration or fresh-reset error.
  }
}

function bootstrapLegacyLedger(
  database: Database.Database,
  migrations: MigrationFile[],
): void {
  if (!migrations.some((migration) => LEGACY_BASELINE_IDS.has(migration.id))) return;

  const rows = readLedger(database);
  if (rows.length > 0) return;

  const baselineFiles = new Map(migrations.map((migration) => [migration.id, migration]));
  for (const baseline of LEGACY_BASELINE) {
    const migration = baselineFiles.get(baseline.id);
    if (!migration || migration.name !== baseline.name) {
      throw new Error(
        'The existing SQLite schema matches the previous v3 bootstrap, but the canonical baseline migration files are missing or renamed. ' +
          'Restore the baseline files before migrating.',
      );
    }
  }

  if (tableExists(database, 'migrations')) {
    throw new Error(
      'The existing SQLite database contains the v2 migrations ledger. ' +
        'Nara does not translate v2 migration history automatically; back up the data and create an explicit v3 forward migration.',
    );
  }
  if (!legacySchemaMatches(database)) {
    if (hasPartialLegacySchema(database)) {
      throw new Error(
        'The existing SQLite schema is not equivalent to the previous v3 bootstrap. ' +
          'Nara did not mark migrations as applied or destroy data. Back up the database and create a corrective forward migration for the detected schema.',
      );
    }
    return;
  }

  beginImmediate(database);
  try {
    if (readLedger(database).length === 0) {
      const insert = database.prepare(
        `INSERT INTO ${MIGRATION_LEDGER} (id, name, checksum, applied_at, duration_ms)
         VALUES (?, ?, ?, ?, 0)`,
      );
      const now = Date.now();
      for (const baseline of LEGACY_BASELINE) {
        const migration = baselineFiles.get(baseline.id)!;
        insert.run(migration.id, migration.name, migration.checksum, now);
      }
    }
    database.exec('COMMIT');
  } catch (error) {
    rollback(database);
    throw error;
  }
}

function migrationFailure(migration: MigrationFile, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Migration "${migration.name}" failed and was rolled back: ${message}`, { cause: error });
}

function applyMigration(database: Database.Database, migration: MigrationFile): boolean {
  beginImmediate(database);
  try {
    const row = database
      .prepare(`SELECT id, name, checksum, applied_at FROM ${MIGRATION_LEDGER} WHERE id = ?`)
      .get(migration.id) as LedgerRow | undefined;
    if (row) {
      validateAppliedMigration(migration, row);
      database.exec('COMMIT');
      return false;
    }

    const sameName = database
      .prepare(`SELECT id FROM ${MIGRATION_LEDGER} WHERE name = ?`)
      .get(migration.name) as { id: string } | undefined;
    if (sameName) {
      throw new Error(
        `Migration "${migration.name}" is already recorded under ID "${sameName.id}"; migration names and IDs are immutable.`,
      );
    }

    const startedAt = Date.now();
    database.exec(migration.sql);
    database
      .prepare(
        `INSERT INTO ${MIGRATION_LEDGER} (id, name, checksum, applied_at, duration_ms)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(migration.id, migration.name, migration.checksum, Date.now(), Date.now() - startedAt);
    database.exec('COMMIT');
    return true;
  } catch (error) {
    rollback(database);
    if (error instanceof Error && error.message.startsWith('Applied migration')) throw error;
    throw migrationFailure(migration, error);
  }
}

function optionsDatabase(options: MigrationOptions): Database.Database {
  return options.database ?? getDatabase();
}

function prepareMigrationState(
  database: Database.Database,
  migrations: MigrationFile[],
): Map<string, LedgerRow> {
  ensureLedger(database);
  bootstrapLegacyLedger(database, migrations);
  return validateLedgerAgainstFiles(database, migrations);
}

export function migrate(options: MigrationOptions = {}): MigrationResult {
  const database = optionsDatabase(options);
  const migrations = discoverMigrations(options);
  let appliedRows = prepareMigrationState(database, migrations);
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of migrations) {
    const row = appliedRows.get(migration.id);
    if (row) {
      validateAppliedMigration(migration, row);
      skipped.push(migration.name);
      continue;
    }

    if (applyMigration(database, migration)) {
      applied.push(migration.name);
    } else {
      skipped.push(migration.name);
    }
    appliedRows = validateLedgerAgainstFiles(database, migrations);
  }

  return { applied, skipped };
}

export function migrateStatus(options: MigrationOptions = {}): MigrationStatus {
  const database = optionsDatabase(options);
  const migrations = discoverMigrations(options);
  const appliedRows = prepareMigrationState(database, migrations);
  const applied: string[] = [];
  const pending: string[] = [];

  for (const migration of migrations) {
    if (appliedRows.has(migration.id)) {
      applied.push(migration.name);
    } else {
      pending.push(migration.name);
    }
  }

  return { applied, pending };
}

function dropApplicationSchema(database: Database.Database): void {
  const objects = database
    .prepare(
      `SELECT type, name
       FROM sqlite_master
       WHERE name NOT LIKE 'sqlite_%'
         AND type IN ('trigger', 'view', 'table')
       ORDER BY CASE type WHEN 'trigger' THEN 0 WHEN 'view' THEN 1 ELSE 2 END, name`,
    )
    .all() as SchemaObject[];

  for (const object of objects) {
    database.exec(`DROP ${object.type.toUpperCase()} IF EXISTS ${quoteIdentifier(object.name)}`);
  }
}

export function migrateFresh(options: MigrationOptions = {}): MigrationResult {
  if (process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production') {
    throw new Error('Refusing migrate:fresh in production. Use a backup and a corrective forward migration instead.');
  }

  const database = optionsDatabase(options);
  const previousForeignKeys = Boolean(database.pragma('foreign_keys', { simple: true }));
  database.pragma('foreign_keys = OFF');
  beginImmediate(database);
  try {
    dropApplicationSchema(database);
    database.exec('COMMIT');
  } catch (error) {
    rollback(database);
    throw new Error(`Fresh database reset failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  } finally {
    database.pragma(`foreign_keys = ${previousForeignKeys ? 'ON' : 'OFF'}`);
  }

  return migrate(options);
}

export { MIGRATION_LEDGER };
export default { discoverMigrations, migrate, migrateStatus, migrateFresh };
