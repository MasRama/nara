import 'tsconfig-paths/register';
import type { Knex } from "knex";
import path from 'path';

// Load env for DB_FILE support
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = nodeEnv === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: envFile });

// Resolve DB file path (relative to project root)
const defaultDbFile = nodeEnv === 'production'
  ? 'database/production.sqlite3'
  : 'database/dev.sqlite3';

const dbFile = process.env.DB_FILE || defaultDbFile;
const resolvedDbPath = path.resolve(process.cwd(), dbFile);

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "better-sqlite3",
    connection: {
      filename: resolvedDbPath
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  },

  production: {
    client: "better-sqlite3",
    connection: {
      filename: resolvedDbPath
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  },
};

export default config;