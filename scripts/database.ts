import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import { env } from '../src/shared/config';
import * as database from '../src/shared/database';

const USAGE = `Usage:
  npm run migrate
  npm run migrate:status
  npm run migrate:fresh
  npm run seed
  npm run db:backup
  npm run db:check
`;

function printFiles(label: string, files: string[]): void {
  process.stdout.write(`${label}:\n`);
  if (files.length === 0) {
    process.stdout.write('  - none\n');
    return;
  }
  for (const file of files) process.stdout.write(`  - ${file}\n`);
}

function backupFilename(): string {
  const timestamp = new Date().toISOString().replaceAll(/[-:.]/g, '');
  return `nara-${timestamp}.sqlite3`;
}

function nextBackupPath(directory: string): string {
  const base = path.join(directory, backupFilename());
  if (!existsSync(base)) return base;

  const extension = path.extname(base);
  const stem = base.slice(0, -extension.length);
  let suffix = 1;
  let candidate = `${stem}-${suffix}${extension}`;
  while (existsSync(candidate)) {
    suffix += 1;
    candidate = `${stem}-${suffix}${extension}`;
  }
  return candidate;
}

async function run(command: string | undefined): Promise<void> {
  if (!command) {
    process.stderr.write(USAGE);
    process.exitCode = 64;
    return;
  }

  if (command === 'migrate:fresh' && (process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production')) {
    throw new Error('Refusing migrate:fresh in production. Use a backup and a corrective forward migration instead.');
  }

  switch (command) {
    case 'migrate': {
      const result = database.migrate();
      printFiles('Applied migrations', result.applied);
      printFiles('Skipped migrations', result.skipped);
      return;
    }
    case 'migrate:status': {
      const result = database.migrateStatus();
      printFiles('Applied migrations', result.applied);
      printFiles('Pending migrations', result.pending);
      return;
    }
    case 'migrate:fresh': {
      const result = database.migrateFresh();
      const seeds = database.seed();
      printFiles('Applied migrations', result.applied);
      printFiles('Reference seeds', seeds.applied);
      return;
    }
    case 'seed': {
      const result = database.seed();
      printFiles('Reference seeds', result.applied);
      return;
    }
    case 'db:backup': {
      const sourcePath = database.getDatabasePath();
      if (sourcePath === ':memory:') {
        throw new Error('Cannot create a persistent backup from an in-memory database. Set DB_FILE first.');
      }
      const backupDirectory = path.resolve(process.cwd(), 'database', 'backups');
      mkdirSync(backupDirectory, { recursive: true });
      const destination = nextBackupPath(backupDirectory);
      await database.getDatabase().backup(destination);
      process.stdout.write(`Database backup created: ${destination}\n`);
      return;
    }
    case 'db:check': {
      const connection = database.getDatabase();
      const quickCheck = connection.pragma('quick_check') as Array<{ quick_check: string }>;
      const foreignKeyCheck = connection.pragma('foreign_key_check') as Array<Record<string, unknown>>;
      const quickFailures = quickCheck.filter((row) => row.quick_check !== 'ok');
      if (quickFailures.length > 0 || foreignKeyCheck.length > 0) {
        const details = [
          ...quickFailures.map((row) => `quick_check: ${row.quick_check}`),
          ...foreignKeyCheck.map((row) => `foreign_key_check: ${JSON.stringify(row)}`),
        ];
        throw new Error(`Database integrity check failed:\n  - ${details.join('\n  - ')}`);
      }
      process.stdout.write('Database integrity check passed (quick_check, foreign_key_check).\n');
      return;
    }
    default:
      process.stderr.write(`Unknown database command "${command}".\n${USAGE}`);
      process.exitCode = 64;
  }
}

run(process.argv[2]).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
