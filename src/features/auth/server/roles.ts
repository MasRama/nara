import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getDatabase } from '../../../shared/database';
import { ADMIN_ROLE_SLUG } from '../contract';

export interface RoleDeclaration {
  slug: string;
  name: string;
  description?: string;
  /** Permission slugs (`<resource>.<action>`) the role starts with. */
  permissions: readonly string[];
}

export interface RoleSyncResult {
  created: string[];
}

const SLUG = /^[a-z][a-z0-9-]*$/;

function sameRole(left: RoleDeclaration, right: RoleDeclaration): boolean {
  return (
    left.name === right.name
    && left.description === right.description
    && [...left.permissions].sort().join() === [...right.permissions].sort().join()
  );
}

/**
 * Roles an application needs from its first start, such as `customer`.
 * Startup creates each declared role that is absent, with its permissions,
 * and never touches one that exists: once created, administrators own it.
 * A declared role an administrator deletes returns at the next start; drop
 * it from the declaration to retire it.
 */
export function createRoleRegistry() {
  const declared = new Map<string, RoleDeclaration>();
  let synchronized = false;

  // An identical declaration may arrive again: the dev server re-evaluates
  // the composition after a server-side edit while this module stays loaded.
  function declare(roles: readonly RoleDeclaration[]): void {
    const incoming: RoleDeclaration[] = [];
    for (const role of roles) {
      if (!SLUG.test(role.slug)) throw new Error(`Role "${role.slug}" must be lowercase kebab-case.`);
      if (role.slug === ADMIN_ROLE_SLUG) throw new Error(`Role "${ADMIN_ROLE_SLUG}" belongs to Auth and cannot be declared.`);
      const known = declared.get(role.slug) ?? incoming.find((pending) => pending.slug === role.slug);
      if (known) {
        if (!sameRole(known, role)) throw new Error(`Role "${role.slug}" is declared twice with different contents.`);
        continue;
      }
      if (synchronized) {
        throw new Error(`Role "${role.slug}" was declared after roles were synchronized; restart the server, or declare it while composing the application.`);
      }
      incoming.push({ ...role, permissions: [...role.permissions] });
    }
    for (const role of incoming) declared.set(role.slug, role);
  }

  function sync(database: Database.Database): RoleSyncResult {
    synchronized = true;
    const now = Date.now();
    const exists = database.prepare('SELECT 1 FROM roles WHERE slug = ?');
    const permissionId = database.prepare('SELECT id FROM permissions WHERE slug = ?');
    const insertRole = database.prepare(
      `INSERT INTO roles (id, name, slug, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const grant = database.prepare(
      `INSERT INTO role_permissions (id, role_id, permission_id, created_at)
       VALUES (?, ?, ?, ?)`,
    );

    return database.transaction((): RoleSyncResult => {
      const result: RoleSyncResult = { created: [] };
      for (const role of [...declared.values()].sort((left, right) => left.slug.localeCompare(right.slug))) {
        // A misspelt permission fails every start, not only the first.
        const permissionIds = role.permissions.map((slug) => {
          const row = permissionId.get(slug) as { id: string } | undefined;
          if (!row) throw new Error(`Role "${role.slug}" names permission "${slug}", which no Feature declares.`);
          return row.id;
        });
        if (exists.get(role.slug)) continue;
        const id = randomUUID();
        insertRole.run(id, role.name, role.slug, role.description ?? null, now, now);
        for (const permission of permissionIds) grant.run(randomUUID(), id, permission, now);
        result.created.push(role.slug);
      }
      return result;
    })();
  }

  return { declare, sync };
}

const registry = createRoleRegistry();

/** Declare roles the application needs while composing it; startup creates the absent ones. */
export function declareRoles(roles: readonly RoleDeclaration[]): void {
  registry.declare(roles);
}

/** Create every declared role that is absent; startup runs this right after permissions are written. */
export function syncDeclaredRoles(database: Database.Database = getDatabase()): RoleSyncResult {
  return registry.sync(database);
}
