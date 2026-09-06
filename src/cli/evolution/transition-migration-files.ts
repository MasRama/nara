import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Pure migration-file reasoning for Feature Transitions. Node builtins
 * only: no `better-sqlite3`, no database singleton, no environment
 * configuration. Every CLI command can load this module, including from
 * the packed `@nara-web/cli` artifact whose only runtime dependency is
 * `typescript`.
 *
 * Executable rehearsal lives in `transition-migrations.ts` and loads the
 * SQLite runtime lazily, only when migration evidence actually executes.
 */

export const MIGRATION_FILE_PATTERN = /^(\d+)_([a-z0-9][a-z0-9_-]*)\.sql$/;

export interface TransitionMigrationFile {
  id: string;
  name: string;
  path: string;
  sql: string;
  checksum: string;
}

export function migrationChecksum(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

function compareMigrationIds(left: string, right: string): number {
  const leftNumber = BigInt(left);
  const rightNumber = BigInt(right);
  if (leftNumber < rightNumber) return -1;
  if (leftNumber > rightNumber) return 1;
  return 0;
}

function readMigrationDirectory(directory: string): TransitionMigrationFile[] {
  const migrations: TransitionMigrationFile[] = [];
  const files = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  for (const file of files) {
    if (!file.isFile() || file.name.endsWith('.d.ts')) continue;
    const filePath = path.join(directory, file.name);
    if (!file.name.endsWith('.sql')) {
      throw new Error(
        `Invalid migration file "${filePath}". Feature migrations must use .sql files.`,
      );
    }
    const match = MIGRATION_FILE_PATTERN.exec(file.name);
    if (!match) {
      throw new Error(
        `Invalid migration filename "${filePath}". Expected <numeric-id>_<description>.sql.`,
      );
    }
    const sql = readFileSync(filePath, 'utf8');
    if (sql.trim().length === 0) {
      throw new Error(`Migration "${filePath}" is empty.`);
    }
    migrations.push({
      id: match[1] as string,
      name: file.name,
      path: filePath,
      sql,
      checksum: migrationChecksum(sql),
    });
  }
  return migrations;
}

/**
 * Discover migration files under a features root (`<root>/users/server/migrations/*.sql`),
 * mirroring the canonical migrator's discovery, ordering, and validation
 * without touching any database.
 */
export function discoverMigrationsInFeaturesDir(featuresRoot: string): TransitionMigrationFile[] {
  if (!existsSync(featuresRoot)) return [];
  const migrations: TransitionMigrationFile[] = [];
  const features = readdirSync(featuresRoot, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  for (const feature of features) {
    if (!feature.isDirectory() || feature.name.startsWith('.')) continue;
    const directory = path.join(featuresRoot, feature.name, 'server', 'migrations');
    if (!existsSync(directory)) continue;
    migrations.push(...readMigrationDirectory(directory));
  }
  migrations.sort((left, right) => {
    const idOrder = compareMigrationIds(left.id, right.id);
    if (idOrder !== 0) return idOrder;
    return left.path.localeCompare(right.path);
  });
  for (let index = 1; index < migrations.length; index += 1) {
    const previous = migrations[index - 1] as TransitionMigrationFile;
    const current = migrations[index] as TransitionMigrationFile;
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

/**
 * Stage candidate migration files into a disposable features root for
 * rehearsal. Ownership moves are irrelevant here: identity is the
 * migration ID plus filename plus bytes, never source ownership.
 */
export function stageCandidateFeatureRoots(
  candidateFeatures: Map<string, Map<string, Buffer>>,
  otherFeatureRoots?: string[],
): { directory: string; featuresRoot: string } {
  const directory: string = mkdtempSync(path.join(os.tmpdir(), 'nara-transition-migrations-'));
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
