import Knex from 'knex';

const config = {
  client: 'better-sqlite3',
  connection: {
    filename: './database/dev.sqlite3',
  },
  useNullAsDefault: true,
  migrations: {
    directory: './migrations',
    extension: 'ts',
  },
};

export const db = Knex(config);
export default config;
