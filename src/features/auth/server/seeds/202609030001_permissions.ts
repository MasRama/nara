import type Database from 'better-sqlite3';

const SEED_TIMESTAMP = 1_704_067_200_000;

const permissions = [
  { id: 'nara-permission-users-view', name: 'View Users', slug: 'users.view', resource: 'users', action: 'view' },
  { id: 'nara-permission-users-create', name: 'Create Users', slug: 'users.create', resource: 'users', action: 'create' },
  { id: 'nara-permission-users-edit', name: 'Edit Users', slug: 'users.edit', resource: 'users', action: 'edit' },
  { id: 'nara-permission-users-delete', name: 'Delete Users', slug: 'users.delete', resource: 'users', action: 'delete' },
  { id: 'nara-permission-roles-view', name: 'View Roles', slug: 'roles.view', resource: 'roles', action: 'view' },
  { id: 'nara-permission-roles-create', name: 'Create Roles', slug: 'roles.create', resource: 'roles', action: 'create' },
  { id: 'nara-permission-roles-edit', name: 'Edit Roles', slug: 'roles.edit', resource: 'roles', action: 'edit' },
  { id: 'nara-permission-roles-delete', name: 'Delete Roles', slug: 'roles.delete', resource: 'roles', action: 'delete' },
  { id: 'nara-permission-settings-view', name: 'View Settings', slug: 'settings.view', resource: 'settings', action: 'view' },
  { id: 'nara-permission-settings-edit', name: 'Edit Settings', slug: 'settings.edit', resource: 'settings', action: 'edit' },
] as const;

export function run(database: Database.Database): void {
  const insert = database.prepare(
    `INSERT INTO permissions (id, name, slug, resource, action, created_at, updated_at)
     VALUES (@id, @name, @slug, @resource, @action, @createdAt, @updatedAt)
     ON CONFLICT (slug) DO NOTHING`,
  );

  for (const permission of permissions) {
    insert.run({
      ...permission,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    });
  }
}
