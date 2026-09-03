import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { env } from '../config';

let database: Database.Database | null = null;
function databasePath(): string {
  if (env.DB_FILE) return env.DB_FILE;
  if (env.NODE_ENV === 'test') return ':memory:';
  return env.NODE_ENV === 'production'
    ? 'database/production.sqlite3'
    : 'database/dev.sqlite3';
}

export function getDatabasePath(): string {
  const file = databasePath();
  return file === ':memory:' ? file : resolve(process.cwd(), file);
}

function openDatabase(): Database.Database {
  const file = getDatabasePath();
  if (file !== ':memory:') {
    mkdirSync(dirname(file), { recursive: true });
  }

  const connection = new Database(file);
  if (file !== ':memory:') {
    connection.pragma('journal_mode = WAL');
    connection.pragma('synchronous = NORMAL');
  }
  connection.pragma('foreign_keys = ON');
  connection.pragma('busy_timeout = 5000');
  return connection;
}

export function getDatabase(): Database.Database {
  database ??= openDatabase();
  return database;
}

export function closeDatabase(): void {
  database?.close();
  database = null;
}
