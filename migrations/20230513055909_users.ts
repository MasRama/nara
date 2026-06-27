export const up = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  avatar TEXT,
  membership_date TEXT,
  password TEXT NOT NULL,
  remember_me_token TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
`;

export const down = `DROP TABLE IF EXISTS users;`;
