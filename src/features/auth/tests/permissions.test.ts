import Database from 'better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrate } from '../../../shared/database';
import { Logger } from '../../../shared/logging';
import { createPermissionRegistry, syncDeclaredPermissions } from '../server/permissions';

const databases: Database.Database[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const database of databases.splice(0)) database.close();
});

/** A migrated database whose permission rows the test owns. */
function freshDatabase(): Database.Database {
  const database = new Database(':memory:');
  databases.push(database);
  migrate({ database, root: process.cwd() });
  database.exec('DELETE FROM role_permissions; DELETE FROM permissions;');
  return database;
}

function insertRole(database: Database.Database, id: string, slug: string): void {
  database
    .prepare('INSERT INTO roles (id, name, slug, description, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1)')
    .run(id, slug, slug, slug);
}

function permission(database: Database.Database, slug: string) {
  return database.prepare('SELECT * FROM permissions WHERE slug = ?').get(slug) as
    | { id: string; name: string; description: string | null; resource: string; action: string; updated_at: number }
    | undefined;
}

const VIEW_USERS = [{ action: 'view', name: 'View Users' }] as const;

describe('Feature-declared permissions', () => {
  it('inserts declared permissions with stable ids', () => {
    const database = freshDatabase();
    const registry = createPermissionRegistry();
    registry.declare('users', VIEW_USERS);

    expect(registry.sync(database)).toEqual({ inserted: ['users.view'], updated: [], undeclared: [] });
    expect(permission(database, 'users.view')).toMatchObject({
      id: 'nara-permission-users-view',
      name: 'View Users',
      resource: 'users',
      action: 'view',
    });
  });

  it('is idempotent', () => {
    const database = freshDatabase();
    const registry = createPermissionRegistry([['users', VIEW_USERS]]);
    registry.sync(database);

    expect(registry.sync(database)).toEqual({ inserted: [], updated: [], undeclared: [] });
    expect(database.prepare('SELECT COUNT(*) AS count FROM permissions').get()).toEqual({ count: 1 });
  });

  it('updates a changed name without touching id or grants', () => {
    const database = freshDatabase();
    insertRole(database, 'role-support', 'support');
    database
      .prepare(
        `INSERT INTO permissions (id, name, slug, resource, action, description, created_at, updated_at)
         VALUES ('old-id', 'Old', 'users.view', 'users', 'view', NULL, 1, 1)`,
      )
      .run();
    database
      .prepare("INSERT INTO role_permissions (id, role_id, permission_id, created_at) VALUES ('grant', 'role-support', 'old-id', 1)")
      .run();

    const result = createPermissionRegistry([['users', VIEW_USERS]]).sync(database);

    expect(result).toEqual({ inserted: [], updated: ['users.view'], undeclared: [] });
    const row = permission(database, 'users.view');
    expect(row).toMatchObject({ id: 'old-id', name: 'View Users' });
    expect(row!.updated_at).toBeGreaterThan(1);
    expect(database.prepare("SELECT id FROM role_permissions WHERE id = 'grant'").get()).toEqual({ id: 'grant' });
  });

  it('grants the admin role every declared permission', () => {
    const database = freshDatabase();
    insertRole(database, 'role-admin', 'admin');

    createPermissionRegistry([['users', VIEW_USERS]]).sync(database);

    expect(
      database.prepare("SELECT role_id, permission_id FROM role_permissions WHERE id = 'nara-role-permission:admin:users.view'").get(),
    ).toEqual({ role_id: 'role-admin', permission_id: 'nara-permission-users-view' });
  });

  it('skips the admin grant without an admin role', () => {
    const database = freshDatabase();
    database.exec("DELETE FROM roles WHERE slug = 'admin'");

    expect(() => createPermissionRegistry([['users', VIEW_USERS]]).sync(database)).not.toThrow();
    expect(database.prepare('SELECT COUNT(*) AS count FROM role_permissions').get()).toEqual({ count: 0 });
  });

  it('keeps and reports undeclared permissions', () => {
    const withLegacy = () => {
      const database = freshDatabase();
      database
        .prepare(
          `INSERT INTO permissions (id, name, slug, resource, action, description, created_at, updated_at)
           VALUES ('legacy', 'Legacy', 'legacy.view', 'legacy', 'view', NULL, 1, 1)`,
        )
        .run();
      return database;
    };
    const database = withLegacy();

    expect(createPermissionRegistry([['users', VIEW_USERS]]).sync(database).undeclared).toEqual(['legacy.view']);
    expect(permission(database, 'legacy.view')).toBeDefined();

    const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    expect(syncDeclaredPermissions(withLegacy()).undeclared).toEqual(['legacy.view']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('Permissions no Feature declares', { slugs: ['legacy.view'] });
  });

  it('rejects malformed or duplicate declarations', () => {
    const registry = createPermissionRegistry();
    expect(() => registry.declare('Users', VIEW_USERS)).toThrow('Users.view');
    expect(() => registry.declare('users', [{ action: 'view all', name: 'View All' }])).toThrow('users.view all');
    registry.declare('users', VIEW_USERS);
    expect(() => registry.declare('users', VIEW_USERS)).toThrow('users.view');
  });

  it('refuses declarations after a sync', () => {
    const registry = createPermissionRegistry();
    registry.sync(freshDatabase());

    expect(() => registry.declare('users', VIEW_USERS)).toThrow(
      'Permission "users.view" was declared after permissions were synchronized',
    );
  });
});
