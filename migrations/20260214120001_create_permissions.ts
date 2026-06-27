export const up = `
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
`;

export const down = `DROP TABLE IF EXISTS permissions;`;
