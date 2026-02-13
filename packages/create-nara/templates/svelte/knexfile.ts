import 'tsconfig-paths/register';
import type { Knex } from "knex";
import path from 'path';
import { existsSync } from 'fs';

const prodEnvPath = path.resolve(process.cwd(), '.env.production');
const hasProdEnv = existsSync(prodEnvPath);

if (hasProdEnv) {
  require('dotenv').config({ path: prodEnvPath });
  process.env.NODE_ENV = 'production';
} else {
  require('dotenv').config({ path: '.env' });
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
}

const nodeEnv = process.env.NODE_ENV;

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
