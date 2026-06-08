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
  const fields: string[] = [];
  const values: unknown[] = [];
  
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.slug !== undefined) { fields.push('slug = ?'); values.push(data.slug); }
  if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
  
  if (fields.length === 0) return findRoleById(id);
  
  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);
  
  SQLite.run(`UPDATE roles SET ${fields.join(', ')} WHERE id = ?`, values);
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

export const roleHasPermission = (roleId: string, permissionSlug: string): boolean => {
  const row = SQLite.one<{ id: string }>`
    SELECT p.id FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ${roleId} AND p.slug = ${permissionSlug}
  `;
  return !!row;
};

export const giveRolePermission = (roleId: string, permissionId: string): void => {
  const exists = SQLite.one<RolePermission>`
    SELECT * FROM role_permissions WHERE role_id = ${roleId} AND permission_id = ${permissionId}
  `;
  if (!exists) {
    SQLite.exec`
      INSERT INTO role_permissions (id, role_id, permission_id, created_at)
      VALUES (${randomUUID()}, ${roleId}, ${permissionId}, ${Date.now()})
    `;
  }
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
