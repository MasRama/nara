export const up = `
CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY NOT NULL,
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  created_at INTEGER,
  UNIQUE (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
);
`;

export const down = `DROP TABLE IF EXISTS role_permissions;`;
