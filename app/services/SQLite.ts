import 'dotenv/config';
import { existsSync } from 'fs';
import { resolve } from 'path';
import Database from 'better-sqlite3';
import type * as BetterSqlite3 from 'better-sqlite3';

const prodEnvPath = resolve(process.cwd(), '.env.production');
if (existsSync(prodEnvPath)) {
  require('dotenv').config({ path: prodEnvPath });
  process.env.NODE_ENV = 'production';
} else {
  require('dotenv').config();
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
}

const defaultDbFile = process.env.NODE_ENV === 'production'
  ? 'database/production.sqlite3'
  : process.env.NODE_ENV === 'test'
    ? ':memory:'
    : 'database/dev.sqlite3';
const dbFile = process.env.DB_FILE || defaultDbFile;
const nativeDb = new Database(dbFile === ':memory:' ? ':memory:' : resolve(process.cwd(), dbFile));

nativeDb.pragma('busy_timeout = 5000');
nativeDb.pragma('journal_mode = WAL');
nativeDb.pragma('synchronous = NORMAL');
nativeDb.pragma('foreign_keys = ON');

const statementCache = new Map<string, BetterSqlite3.Statement>();

const getStmt = (sql: string): BetterSqlite3.Statement => {
  let stmt = statementCache.get(sql);
  if (!stmt) {
    stmt = nativeDb.prepare(sql);
    statementCache.set(sql, stmt);
  }
  return stmt;
};

const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
  let query = strings[0];
  const params: unknown[] = [];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (Array.isArray(value)) {
      if (value.length === 0) throw new Error('Cannot interpolate an empty array into SQL');
      query += value.map(() => '?').join(', ');
      params.push(...value);
    } else {
      query += '?';
      params.push(value);
    }
    query += strings[i + 1];
  }
  return { query, params };
};

const SQLite = {
  one<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): T | undefined {
    const { query, params } = sql(strings, ...values);
    return getStmt(query).get(...params) as T | undefined;
  },

  many<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): T[] {
    const { query, params } = sql(strings, ...values);
    return getStmt(query).all(...params) as T[];
  },

  exec(strings: TemplateStringsArray, ...values: unknown[]): BetterSqlite3.RunResult {
    const { query, params } = sql(strings, ...values);
    return getStmt(query).run(...params);
  },

  transaction<T>(fn: () => T): T {
    return nativeDb.transaction(fn)();
  },

  update(table: string, where: Record<string, unknown>, data: Record<string, unknown>): BetterSqlite3.RunResult {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      fields.push(`${key} = ?`);
      values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }

    if (fields.length === 0) {
      return { changes: 0, lastInsertRowid: 0 } as BetterSqlite3.RunResult;
    }

    fields.push('updated_at = ?');
    values.push(Date.now());

    const whereClauses = Object.keys(where).map(k => `${k} = ?`);
    const whereValues = Object.values(where);
    values.push(...whereValues);

    return getStmt(`UPDATE ${table} SET ${fields.join(', ')} WHERE ${whereClauses.join(' AND ')}`).run(...values);
  },

  raw(): BetterSqlite3.Database {
    return nativeDb;
  },

  close(): void {
    nativeDb.close();
  }
};

export default SQLite;
 
