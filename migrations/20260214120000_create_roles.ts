export const up = `
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
`;

export const down = `DROP TABLE IF EXISTS roles;`;
