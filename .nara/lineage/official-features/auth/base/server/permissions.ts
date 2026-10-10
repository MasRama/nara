import type Database from 'better-sqlite3';
import { getDatabase } from '../../../shared/database';
import { Logger } from '../../../shared/logging';
import type { PermissionDeclaration } from '../../../shared/security';
import { ROLES_PERMISSIONS } from '../contract';

export interface PermissionSyncResult {
  inserted: string[];
  updated: string[];
  /** Stored slugs no Feature declares; kept so their role grants survive. */
  undeclared: string[];
}

interface DeclaredPermission extends PermissionDeclaration {
  resource: string;
  slug: string;
}

const SEGMENT = /^[a-z][a-z0-9-]*$/;

/**
 * Permissions are owned by the Feature that gates them. Bindings declare
 * them at composition; startup writes them in one transaction after
 * migrations. Rows are matched by slug, so existing ids and role grants
 * survive, and nothing is deleted: a slug no Feature declares is reported.
 */
export function createPermissionRegistry(
  initial: ReadonlyArray<readonly [resource: string, permissions: readonly PermissionDeclaration[]]> = [],
) {
  const declared = new Map<string, DeclaredPermission>();
  let synchronized = false;

  // An identical declaration may arrive again: the dev server re-evaluates
  // bindings after a server-side edit while this module stays loaded.
  function declare(resource: string, permissions: readonly PermissionDeclaration[]): void {
    const incoming: DeclaredPermission[] = [];
    for (const permission of permissions) {
      const slug = `${resource}.${permission.action}`;
      if (!SEGMENT.test(resource) || !SEGMENT.test(permission.action)) {
        throw new Error(`Permission "${slug}" must be <resource>.<action> in lowercase kebab-case.`);
      }
      const known = declared.get(slug) ?? incoming.find((pending) => pending.slug === slug);
      if (known) {
        if (known.name !== permission.name || known.description !== permission.description) {
          throw new Error(`Permission "${slug}" is declared twice with different names or descriptions.`);
        }
        continue;
      }
      if (synchronized) {
        throw new Error(`Permission "${slug}" was declared after permissions were synchronized; restart the server, or declare it while composing the application.`);
      }
      incoming.push({ ...permission, resource, slug });
    }
    for (const permission of incoming) declared.set(permission.slug, permission);
  }

  function sync(database: Database.Database): PermissionSyncResult {
    synchronized = true;
    const now = Date.now();
    const insert = database.prepare(
      `INSERT INTO permissions (id, name, slug, resource, action, description, created_at, updated_at)
       VALUES (@id, @name, @slug, @resource, @action, @description, @now, @now)
       ON CONFLICT (slug) DO NOTHING`,
    );
    const update = database.prepare(
      `UPDATE permissions
       SET name = @name, description = @description, resource = @resource, action = @action, updated_at = @now
       WHERE slug = @slug
         AND (name IS NOT @name OR description IS NOT @description OR resource IS NOT @resource OR action IS NOT @action)`,
    );
    const grantAdmin = database.prepare(
      `INSERT INTO role_permissions (id, role_id, permission_id, created_at)
       SELECT 'nara-role-permission:admin:' || permissions.slug, roles.id, permissions.id, @now
       FROM roles
       JOIN permissions ON permissions.slug = @slug
       WHERE roles.slug = 'admin'
       ON CONFLICT (role_id, permission_id) DO NOTHING`,
    );
    const stored = database.prepare('SELECT slug FROM permissions ORDER BY slug ASC');

    return database.transaction((): PermissionSyncResult => {
      const result: PermissionSyncResult = { inserted: [], updated: [], undeclared: [] };
      for (const permission of [...declared.values()].sort((left, right) => left.slug.localeCompare(right.slug))) {
        const row = {
          id: `nara-permission-${permission.resource}-${permission.action}`,
          name: permission.name,
          slug: permission.slug,
          resource: permission.resource,
          action: permission.action,
          description: permission.description ?? null,
          now,
        };
        if (insert.run(row).changes > 0) result.inserted.push(permission.slug);
        else if (update.run(row).changes > 0) result.updated.push(permission.slug);
        grantAdmin.run({ slug: permission.slug, now });
      }
      for (const { slug } of stored.all() as Array<{ slug: string }>) {
        if (!declared.has(slug)) result.undeclared.push(slug);
      }
      return result;
    })();
  }

  for (const [resource, permissions] of initial) declare(resource, permissions);
  return { declare, sync };
}

const registry = createPermissionRegistry([['roles', ROLES_PERMISSIONS]]);

/** Declare a Feature's permissions while composing the application. */
export function declarePermissions(resource: string, permissions: readonly PermissionDeclaration[]): void {
  registry.declare(resource, permissions);
}

/** Write every declared permission; startup runs this right after migrations. */
export function syncDeclaredPermissions(database: Database.Database = getDatabase()): PermissionSyncResult {
  const result = registry.sync(database);
  if (result.undeclared.length > 0) Logger.warn('Permissions no Feature declares', { slugs: result.undeclared });
  return result;
}
