import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../shared/database';
import type { AccessRule } from '../../../shared/security';
import { ADMIN_ROLE_SLUG } from '../contract';
import { accountsChanged, rolesChanged } from './live';

export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  revision: number;
  created_at: number;
  updated_at: number;
}

/** `stale` carries the role as it is now; nothing was written. */
export type RoleUpdate = { status: 'updated'; role: Role } | { status: 'stale'; role: Role } | { status: 'missing' };

export interface Permission {
  id: string;
  name: string;
  slug: string;
  resource: string;
  action: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

export interface AccessUser {
  id: string;
  name: string;
  email: string;
}

export function findAllRoles(): Role[] {
  return getDatabase().prepare('SELECT * FROM roles ORDER BY created_at ASC').all() as Role[];
}

export function findRoleById(roleId: string): Role | undefined {
  return getDatabase().prepare('SELECT * FROM roles WHERE id = ?').get(roleId) as Role | undefined;
}

export function findRoleBySlug(slug: string): Role | undefined {
  return getDatabase().prepare('SELECT * FROM roles WHERE slug = ?').get(slug) as Role | undefined;
}

export function createRole(data: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}): Role {
  const now = Date.now();
  getDatabase()
    .prepare(
      `INSERT INTO roles (id, name, slug, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(data.id, data.name, data.slug, data.description, now, now);
  return findRoleById(data.id)!;
}


function replaceRolePermissions(database: ReturnType<typeof getDatabase>, roleId: string, permissionIds: string[]): void {
  database.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
  const statement = database.prepare(
    `INSERT INTO role_permissions (id, role_id, permission_id, created_at)
     VALUES (?, ?, ?, ?)`,
  );
  const now = Date.now();
  for (const permissionId of permissionIds) {
    statement.run(randomUUID(), roleId, permissionId, now);
  }
}

export function createRoleWithPermissions(
  data: { id: string; name: string; slug: string; description: string | null },
  permissionIds: string[],
): Role {
  const database = getDatabase();
  const role = database.transaction(() => {
    const created = createRole(data);
    replaceRolePermissions(database, created.id, permissionIds);
    return created;
  })();
  rolesChanged();
  return role;
}

/**
 * Applies `data` and raises the revision. With `revision`, writes only while
 * the role is still at it, so an edit based on stale data is refused.
 */
export function updateRole(
  roleId: string,
  data: Partial<Pick<Role, 'name' | 'slug' | 'description'>>,
  revision?: number,
): RoleUpdate {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.slug !== undefined) {
    fields.push('slug = ?');
    values.push(data.slug);
  }
  if (data.description !== undefined) {
    fields.push('description = ?');
    values.push(data.description);
  }
  fields.push('revision = revision + 1', 'updated_at = ?');
  values.push(Date.now(), roleId);
  const current = revision === undefined ? '' : ' AND revision = ?';
  if (revision !== undefined) values.push(revision);
  const written = getDatabase().prepare(`UPDATE roles SET ${fields.join(', ')} WHERE id = ?${current}`).run(...values).changes;
  const role = findRoleById(roleId);
  if (!role) return { status: 'missing' };
  return written === 0 ? { status: 'stale', role } : { status: 'updated', role };
}

export function deleteRoles(roleIds: string[]): number {
  if (roleIds.length === 0) return 0;
  const members = roleIds.flatMap((roleId) => getUsersWithRole(roleId).map((user) => user.id));
  const placeholders = roleIds.map(() => '?').join(', ');
  const result = getDatabase().prepare(`DELETE FROM roles WHERE id IN (${placeholders})`).run(...roleIds);
  accountsChanged(members);
  rolesChanged();
  return result.changes;
}

export function findAllPermissions(): Permission[] {
  return getDatabase()
    .prepare('SELECT * FROM permissions ORDER BY resource ASC, action ASC')
    .all() as Permission[];
}

export function getRolePermissions(roleId: string): Permission[] {
  return getDatabase()
    .prepare(
      `SELECT p.*
       FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?
       ORDER BY p.resource ASC, p.action ASC`,
    )
    .all(roleId) as Permission[];
}

export function getUserRoles(userId: string): Role[] {
  return getDatabase()
    .prepare(
      `SELECT r.*
       FROM roles r
       INNER JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ?
       ORDER BY r.created_at ASC`,
    )
    .all(userId) as Role[];
}

export function getUserPermissions(userId: string): Permission[] {
  return getDatabase()
    .prepare(
      `SELECT DISTINCT p.*
       FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       INNER JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = ?
       ORDER BY p.resource ASC, p.action ASC`,
    )
    .all(userId) as Permission[];
}

export function hasRole(userId: string, roleSlug: string): boolean {
  const row = getDatabase()
    .prepare(
      `SELECT r.id
       FROM roles r
       INNER JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = ? AND r.slug = ?`,
    )
    .get(userId, roleSlug) as { id: string } | undefined;
  return row !== undefined;
}

export function hasPermission(userId: string, permissionSlug: string): boolean {
  const row = getDatabase()
    .prepare(
      `SELECT p.id
       FROM permissions p
       INNER JOIN role_permissions rp ON p.id = rp.permission_id
       INNER JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = ? AND p.slug = ?`,
    )
    .get(userId, permissionSlug) as { id: string } | undefined;
  return row !== undefined;
}

export function isAdmin(userId: string): boolean {
  return hasRole(userId, ADMIN_ROLE_SLUG);
}

/** Whether the account meets the rule; `admin` meets every rule. */
export function isAllowed(userId: string, rule: AccessRule): boolean {
  return isAdmin(userId) || ('permission' in rule && hasPermission(userId, rule.permission));
}

export function getUserCountsForRoles(roleIds: string[]): Map<string, number> {
  const counts = new Map(roleIds.map((roleId) => [roleId, 0]));
  if (roleIds.length === 0) return counts;
  const placeholders = roleIds.map(() => '?').join(', ');
  const rows = getDatabase()
    .prepare(
      `SELECT role_id, COUNT(*) AS count
       FROM user_roles
       WHERE role_id IN (${placeholders})
       GROUP BY role_id`,
    )
    .all(...roleIds) as Array<{ role_id: string; count: number }>;
  for (const row of rows) counts.set(row.role_id, row.count);
  return counts;
}

export function updateRoleWithPermissions(
  roleId: string,
  data: Partial<Pick<Role, 'name' | 'slug' | 'description'>>,
  permissionIds?: string[],
  revision?: number,
): RoleUpdate {
  const database = getDatabase();
  const update = database.transaction(() => {
    const result = updateRole(roleId, data, revision);
    if (result.status === 'updated' && permissionIds !== undefined) replaceRolePermissions(database, roleId, permissionIds);
    return result;
  })();
  if (update.status === 'updated') {
    accountsChanged(getUsersWithRole(roleId).map((user) => user.id));
    rolesChanged();
  }
  return update;
}

export function syncUserRoles(userId: string, roleIds: string[]): void {
  const database = getDatabase();
  const replace = database.transaction(() => {
    database.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
    const statement = database.prepare(
      `INSERT INTO user_roles (id, user_id, role_id, created_at)
       VALUES (?, ?, ?, ?)`,
    );
    const now = Date.now();
    for (const roleId of roleIds) {
      statement.run(randomUUID(), userId, roleId, now);
    }
  });
  replace();
}

/** Accounts holding the admin role, earliest first. */
export function findAdministrators(): AccessUser[] {
  return getDatabase()
    .prepare(
      `SELECT u.id, u.name, u.email
       FROM users u
       INNER JOIN user_roles ur ON u.id = ur.user_id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE r.slug = ?
       ORDER BY u.created_at ASC`,
    )
    .all(ADMIN_ROLE_SLUG) as AccessUser[];
}

export function getUsersWithRole(roleId: string): AccessUser[] {
  return getDatabase()
    .prepare(
      `SELECT u.id, u.name, u.email
       FROM users u
       INNER JOIN user_roles ur ON u.id = ur.user_id
       WHERE ur.role_id = ?
       ORDER BY u.created_at ASC`,
    )
    .all(roleId) as AccessUser[];
}
