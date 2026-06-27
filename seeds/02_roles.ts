import type SQLiteType from '../app/services/SQLite';
import { randomUUID } from 'crypto';

export function run(SQLite: typeof SQLiteType): void {
  const now = Date.now();
  const adminRoleId = randomUUID();
  const userRoleId = randomUUID();

  SQLite.run(
    'INSERT OR IGNORE INTO roles (id, name, slug, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [adminRoleId, 'Admin', 'admin', 'Full access to all features', now, now]
  );

  SQLite.run(
    'INSERT OR IGNORE INTO roles (id, name, slug, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userRoleId, 'User', 'user', 'Standard user access', now, now]
  );

  // Admin gets all permissions
  const allPerms = SQLite.all<{ id: string }>('SELECT id FROM permissions');
  for (const p of allPerms) {
    SQLite.run(
      'INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?, ?, ?, ?)',
      [randomUUID(), adminRoleId, p.id, now]
    );
  }

  // User gets view-only permissions
  const viewPerms = SQLite.all<{ id: string }>(
    "SELECT id FROM permissions WHERE slug IN ('users.view', 'settings.view')"
  );
  for (const p of viewPerms) {
    SQLite.run(
      'INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?, ?, ?, ?)',
      [randomUUID(), userRoleId, p.id, now]
    );
  }
}
