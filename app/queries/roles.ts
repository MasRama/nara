import SQLite from '@services/SQLite';
import type { Role, Permission, RolePermission } from '@types';
import { randomUUID } from 'crypto';

export const findAllRoles = (): Role[] =>
  SQLite.many<Role>`SELECT * FROM roles ORDER BY created_at ASC`;

export const findRoleById = (id: string): Role | undefined =>
  SQLite.one<Role>`SELECT * FROM roles WHERE id = ${id}`;

export const findRoleBySlug = (slug: string): Role | undefined =>
  SQLite.one<Role>`SELECT * FROM roles WHERE slug = ${slug}`;

export const createRole = (data: { id: string; name: string; slug: string; description?: string | null }): Role => {
  const now = Date.now();
  SQLite.exec`
    INSERT INTO roles (id, name, slug, description, created_at, updated_at)
    VALUES (${data.id}, ${data.name}, ${data.slug}, ${data.description ?? null}, ${now}, ${now})
  `;
  return findRoleById(data.id)!;
};

export const updateRole = (id: string, data: Partial<Pick<Role, 'name' | 'slug' | 'description'>>): Role | undefined => {
  SQLite.update('roles', { id }, data);
  return findRoleById(id);
};

export const deleteRole = (id: string): boolean => {
  const result = SQLite.run('DELETE FROM roles WHERE id = ?', [id]);
  return result.changes > 0;
};

export const getRolePermissions = (roleId: string): Permission[] =>
  SQLite.many<Permission>`
    SELECT p.* FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ${roleId}
  `;

export const getPermissionsForRoles = (roleIds: string[]): Map<string, Permission[]> => {
  if (roleIds.length === 0) return new Map();
  const placeholders = roleIds.map(() => '?').join(',');
  const rows = SQLite.all<{ role_id: string; id: string; name: string; slug: string; resource: string; action: string; description: string | null; created_at: number; updated_at: number }>(
    `SELECT rp.role_id, p.id, p.name, p.slug, p.resource, p.action, p.description, p.created_at, p.updated_at
     FROM permissions p
     INNER JOIN role_permissions rp ON p.id = rp.permission_id
     WHERE rp.role_id IN (${placeholders})`,
    roleIds
  );
  const map = new Map<string, Permission[]>();
  for (const row of rows) {
    const { role_id, ...perm } = row;
    if (!map.has(role_id)) map.set(role_id, []);
    map.get(role_id)!.push(perm);
  }
  return map;
};

export const getUserCountsForRoles = (roleIds: string[]): Map<string, number> => {
  if (roleIds.length === 0) return new Map();
  const placeholders = roleIds.map(() => '?').join(',');
  const rows = SQLite.all<{ role_id: string; count: number }>(
    `SELECT role_id, COUNT(*) as count FROM user_roles WHERE role_id IN (${placeholders}) GROUP BY role_id`,
    roleIds
  );
  const map = new Map<string, number>();
  for (const r of roleIds) map.set(r, 0);
  for (const row of rows) map.set(row.role_id, row.count);
  return map;
};

export const roleHasPermission = (roleId: string, permissionSlug: string): boolean => {
  const row = SQLite.one<{ id: string }>`
    SELECT p.id FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ${roleId} AND p.slug = ${permissionSlug}
  `;
  return !!row;
};

export const giveRolePermission = (roleId: string, permissionId: string): void => {
  SQLite.exec`
    INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at)
    VALUES (${randomUUID()}, ${roleId}, ${permissionId}, ${Date.now()})
  `;
};

export const revokeRolePermission = (roleId: string, permissionId: string): void => {
  SQLite.exec`DELETE FROM role_permissions WHERE role_id = ${roleId} AND permission_id = ${permissionId}`;
};

export const syncRolePermissions = (roleId: string, permissionIds: string[]): void => {
  SQLite.transaction(() => {
    SQLite.exec`DELETE FROM role_permissions WHERE role_id = ${roleId}`;
    const now = Date.now();
    for (const permissionId of permissionIds) {
      SQLite.exec`
        INSERT INTO role_permissions (id, role_id, permission_id, created_at)
        VALUES (${randomUUID()}, ${roleId}, ${permissionId}, ${now})
      `;
    }
  });
};

export const findAllPermissions = (): Permission[] =>
  SQLite.many<Permission>`SELECT * FROM permissions ORDER BY resource ASC, action ASC`;

export const findPermissionById = (id: string): Permission | undefined =>
  SQLite.one<Permission>`SELECT * FROM permissions WHERE id = ${id}`;

export const findPermissionBySlug = (slug: string): Permission | undefined =>
  SQLite.one<Permission>`SELECT * FROM permissions WHERE slug = ${slug}`;

export const findPermissionsByResource = (resource: string): Permission[] =>
  SQLite.many<Permission>`SELECT * FROM permissions WHERE resource = ${resource} ORDER BY action ASC`;

export const getUsersWithRole = (roleId: string): { id: string; name: string | null; email: string }[] =>
  SQLite.many<{ id: string; name: string | null; email: string }>`
    SELECT u.id, u.name, u.email FROM users u
    INNER JOIN user_roles ur ON u.id = ur.user_id
    WHERE ur.role_id = ${roleId}
  `;
