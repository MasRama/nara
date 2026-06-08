import 'dotenv/config';
import config from "@root/knexfile";
import Database from 'better-sqlite3';
import type * as BetterSqlite3 from 'better-sqlite3';

const connectionType = process.env.DB_CONNECTION || 'development';
const dbConfig = config[connectionType];

interface SQLiteConnectionConfig {
  filename: string;
}

if (!dbConfig || 
    !dbConfig.connection || 
    typeof dbConfig.connection !== 'object' || 
    !('filename' in dbConfig.connection)) {
  throw new Error(`Invalid database configuration for connection: ${connectionType}`);
}

const connectionConfig = dbConfig.connection as SQLiteConnectionConfig;
const nativeDb = new Database(connectionConfig.filename);

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

const toArray = (params: unknown): unknown[] => 
  Array.isArray(params) ? params : Object.values(params as object);

const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
  let query = strings[0];
  const params: unknown[] = [];
  for (let i = 0; i < values.length; i++) {
    params.push(values[i]);
    query += '?' + strings[i + 1];
  }
  return { query, params };
};

const SQLite = {
  get<T = unknown>(sqlStr: string, params: unknown[] = []): T | undefined {
    return getStmt(sqlStr).get(...toArray(params)) as T | undefined;
  },

  all<T = unknown>(sqlStr: string, params: unknown[] = []): T[] {
    return getStmt(sqlStr).all(...toArray(params)) as T[];
  },

  run(sqlStr: string, params: unknown[] = []): BetterSqlite3.RunResult {
    return getStmt(sqlStr).run(...toArray(params));
  },

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

  raw(): BetterSqlite3.Database {
    return nativeDb;
  },

  close(): void {
    nativeDb.close();
  }
};

export default SQLite;
 
