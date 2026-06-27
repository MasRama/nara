import type SQLiteType from '../app/services/SQLite';
import { randomUUID } from 'crypto';

export function run(SQLite: typeof SQLiteType): void {
  const now = Date.now();
  const permissions = [
    { name: 'View Users', slug: 'users.view', resource: 'users', action: 'view' },
    { name: 'Create Users', slug: 'users.create', resource: 'users', action: 'create' },
    { name: 'Edit Users', slug: 'users.edit', resource: 'users', action: 'edit' },
    { name: 'Delete Users', slug: 'users.delete', resource: 'users', action: 'delete' },
    { name: 'View Roles', slug: 'roles.view', resource: 'roles', action: 'view' },
    { name: 'Create Roles', slug: 'roles.create', resource: 'roles', action: 'create' },
    { name: 'Edit Roles', slug: 'roles.edit', resource: 'roles', action: 'edit' },
    { name: 'Delete Roles', slug: 'roles.delete', resource: 'roles', action: 'delete' },
    { name: 'View Settings', slug: 'settings.view', resource: 'settings', action: 'view' },
    { name: 'Edit Settings', slug: 'settings.edit', resource: 'settings', action: 'edit' },
  ];

  for (const p of permissions) {
    SQLite.run(
      'INSERT OR IGNORE INTO permissions (id, name, slug, resource, action, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), p.name, p.slug, p.resource, p.action, now, now]
    );
  }
}
