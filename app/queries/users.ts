import SQLite from '@services/SQLite';
import type { User, UserRole, Role, Permission } from '@types';
import { randomUUID } from 'crypto';

export const findUserById = (id: string): User | undefined =>
  SQLite.one<User>`SELECT * FROM users WHERE id = ${id}`;

export const findUserByEmail = (email: string): User | undefined =>
  SQLite.one<User>`SELECT * FROM users WHERE email = ${email}`;

export const createUser = (data: {
  id: string;
  name?: string | null;
  email: string;
  password: string;
  avatar?: string | null;
}): User => {
  const now = Date.now();
  SQLite.exec`
    INSERT INTO users (id, name, email, avatar, password, created_at, updated_at)
    VALUES (${data.id}, ${data.name ?? null}, ${data.email}, ${data.avatar ?? null}, ${data.password}, ${now}, ${now})
  `;
  return findUserById(data.id)!;
};

export const updateUser = (id: string, data: Partial<Omit<User, 'id' | 'created_at'>>): User | undefined => {
  const { id: _id, created_at: _created_at, ...rest } = data as Record<string, unknown>;
  SQLite.update('users', { id }, rest);
  return findUserById(id);
};

export const deleteUser = (id: string): boolean => {
  const result = SQLite.run('DELETE FROM users WHERE id = ?', [id]);
  return result.changes > 0;
};

export const deleteUsers = (ids: string[]): number => {
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => '?').join(',');
  const result = SQLite.run(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
  return result.changes;
};

export const emailExists = (email: string, excludeId?: string): boolean => {
  if (excludeId) {
    const row = SQLite.one<{ id: string }>`SELECT id FROM users WHERE email = ${email} AND id != ${excludeId}`;
    return !!row;
  }
  const row = SQLite.one<{ id: string }>`SELECT id FROM users WHERE email = ${email}`;
  return !!row;
};

export const searchUsers = (search: string): User[] => {
  const pattern = `%${search.replace(/[%_]/g, '')}%`;
  const query = `SELECT * FROM users WHERE (name LIKE ? OR email LIKE ?) ORDER BY created_at DESC`;
  return SQLite.all<User>(query, [pattern, pattern]);
};

export const getUsersPaginated = (
  page: number,
  limit: number,
  search = ''
): { data: User[]; total: number } => {
  const pattern = `%${search.replace(/[%_]/g, '')}%`;
  const whereClause = `(name LIKE ? OR email LIKE ?)`;
  const params: unknown[] = [pattern, pattern];

  const countRow = SQLite.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM users WHERE ${whereClause}`,
    params
  );

  const offset = (page - 1) * limit;
  const data = SQLite.all<User>(
    `SELECT * FROM users WHERE ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { data, total: countRow?.count ?? 0 };
};

export const updateAvatar = (id: string, avatarUrl: string): void => {
  SQLite.update('users', { id }, { avatar: avatarUrl });
};

export const updatePassword = (id: string, hashedPassword: string): void => {
  SQLite.update('users', { id }, { password: hashedPassword });
};

export const getUserRoles = (userId: string): Role[] =>
  SQLite.many<Role>`
    SELECT r.id, r.name, r.slug, r.description, r.created_at, r.updated_at
    FROM roles r
    INNER JOIN user_roles ur ON r.id = ur.role_id
    WHERE ur.user_id = ${userId}
  `;

export const getRolesForUsers = (userIds: string[]): Map<string, Role[]> => {
  if (userIds.length === 0) return new Map();
  const placeholders = userIds.map(() => '?').join(',');
  const rows = SQLite.all<{ user_id: string; id: string; name: string; slug: string; description: string | null; created_at: number; updated_at: number }>(
    `SELECT ur.user_id, r.id, r.name, r.slug, r.description, r.created_at, r.updated_at
     FROM roles r
     INNER JOIN user_roles ur ON r.id = ur.role_id
     WHERE ur.user_id IN (${placeholders})`,
    userIds
  );
  const map = new Map<string, Role[]>();
  for (const row of rows) {
    const { user_id, ...role } = row;
    if (!map.has(user_id)) map.set(user_id, []);
    map.get(user_id)!.push(role);
  }
  return map;
};

export const getUserPermissions = (userId: string): Permission[] =>
  SQLite.many<Permission>`
    SELECT DISTINCT p.id, p.name, p.slug, p.resource, p.action, p.description, p.created_at, p.updated_at
    FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    INNER JOIN user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = ${userId}
  `;

export const hasRole = (userId: string, roleSlug: string): boolean => {
  const row = SQLite.one<{ id: string }>`
    SELECT r.id FROM roles r
    INNER JOIN user_roles ur ON r.id = ur.role_id
    WHERE ur.user_id = ${userId} AND r.slug = ${roleSlug}
  `;
  return !!row;
};

export const hasPermission = (userId: string, permissionSlug: string): boolean => {
  const row = SQLite.one<{ id: string }>`
    SELECT p.id FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    INNER JOIN user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = ${userId} AND p.slug = ${permissionSlug}
  `;
  return !!row;
};

export const isAdmin = (userId: string): boolean => hasRole(userId, 'admin');

export const assignRole = (userId: string, roleId: string): void => {
  SQLite.exec`INSERT OR IGNORE INTO user_roles (id, user_id, role_id, created_at) VALUES (${randomUUID()}, ${userId}, ${roleId}, ${Date.now()})`;
};

export const removeRole = (userId: string, roleId: string): void => {
  SQLite.exec`DELETE FROM user_roles WHERE user_id = ${userId} AND role_id = ${roleId}`;
};

export const syncRoles = (userId: string, roleIds: string[]): void => {
  SQLite.transaction(() => {
    SQLite.exec`DELETE FROM user_roles WHERE user_id = ${userId}`;
    const now = Date.now();
    for (const roleId of roleIds) {
      SQLite.exec`INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (${randomUUID()}, ${userId}, ${roleId}, ${now})`;
    }
  });
};
