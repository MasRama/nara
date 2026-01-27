import type { Knex } from 'knex';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: './database/dev.sqlite3',
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations',
      extension: 'ts',
    },
  },

  production: {
    client: 'better-sqlite3',
    connection: {
      filename: './database/production.sqlite3',
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations',
    },
  },
};

export default config;
