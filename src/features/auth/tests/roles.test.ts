import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate } from '../../../shared/database';
import { createPermissionRegistry } from '../server/permissions';
import { createRoleRegistry } from '../server/roles';

const databases: Database.Database[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

/** A migrated database holding the permissions `customer` roles need. */
function freshDatabase(): Database.Database {
  const database = new Database(':memory:');
  databases.push(database);
  migrate({ database, root: process.cwd() });
  createPermissionRegistry([['orders', [{ action: 'view', name: 'View orders' }, { action: 'create', name: 'Create orders' }]]]).sync(database);
  return database;
}

function grants(database: Database.Database, slug: string): string[] {
  return (
    database
      .prepare(
        `SELECT p.slug FROM role_permissions rp
         JOIN roles r ON r.id = rp.role_id
         JOIN permissions p ON p.id = rp.permission_id
         WHERE r.slug = ? ORDER BY p.slug`,
      )
      .all(slug) as Array<{ slug: string }>
  ).map((row) => row.slug);
}

const CUSTOMER = { slug: 'customer', name: 'Customer', permissions: ['orders.view', 'orders.create'] } as const;

describe('declared roles', () => {
  it('creates an absent role with its permissions', () => {
    const database = freshDatabase();
    const registry = createRoleRegistry();
    registry.declare([CUSTOMER]);

    expect(registry.sync(database)).toEqual({ created: ['customer'] });
    expect(database.prepare('SELECT name, description FROM roles WHERE slug = ?').get('customer')).toEqual({
      name: 'Customer',
      description: null,
    });
    expect(grants(database, 'customer')).toEqual(['orders.create', 'orders.view']);
  });

  it('leaves an existing role exactly as administrators made it', () => {
    const database = freshDatabase();
    const registry = createRoleRegistry();
    registry.declare([CUSTOMER]);
    registry.sync(database);
    database.prepare("UPDATE roles SET name = 'Buyer' WHERE slug = 'customer'").run();
    database
      .prepare("DELETE FROM role_permissions WHERE permission_id = (SELECT id FROM permissions WHERE slug = 'orders.create')")
      .run();

    expect(registry.sync(database)).toEqual({ created: [] });
    expect(database.prepare('SELECT name FROM roles WHERE slug = ?').get('customer')).toEqual({ name: 'Buyer' });
    expect(grants(database, 'customer')).toEqual(['orders.view']);
  });

  it('refuses a permission no Feature declares, whether or not the role exists', () => {
    const database = freshDatabase();
    const registry = createRoleRegistry();
    registry.declare([{ slug: 'customer', name: 'Customer', permissions: ['orders.veiw'] }]);
    database
      .prepare("INSERT INTO roles (id, name, slug, description, created_at, updated_at) VALUES ('customer', 'Customer', 'customer', NULL, 1, 1)")
      .run();

    expect(() => registry.sync(database)).toThrow('Role "customer" names permission "orders.veiw", which no Feature declares.');
  });

  it('writes nothing when one declared role fails', () => {
    const database = freshDatabase();
    const registry = createRoleRegistry();
    registry.declare([CUSTOMER, { slug: 'vendor', name: 'Vendor', permissions: ['stock.edit'] }]);

    expect(() => registry.sync(database)).toThrow('Role "vendor" names permission "stock.edit"');
    expect(database.prepare('SELECT COUNT(*) AS count FROM roles WHERE slug = ?').get('customer')).toEqual({ count: 0 });
  });

  it('rejects malformed, administrator, or conflicting declarations', () => {
    const registry = createRoleRegistry();
    expect(() => registry.declare([{ slug: 'Customer', name: 'Customer', permissions: [] }])).toThrow('lowercase kebab-case');
    expect(() => registry.declare([{ slug: 'admin', name: 'Admin', permissions: [] }])).toThrow('belongs to Auth');
    registry.declare([CUSTOMER]);
    registry.declare([{ ...CUSTOMER, permissions: ['orders.create', 'orders.view'] }]);
    expect(() => registry.declare([{ ...CUSTOMER, name: 'Client' }])).toThrow('declared twice with different contents');
  });

  it('refuses declarations after a sync', () => {
    const registry = createRoleRegistry();
    registry.sync(freshDatabase());
    expect(() => registry.declare([CUSTOMER])).toThrow('declared after roles were synchronized');
  });
});
