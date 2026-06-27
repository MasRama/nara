export const up = `
CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  created_at INTEGER,
  UNIQUE (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
);
`;

export const down = `DROP TABLE IF EXISTS user_roles;`;
