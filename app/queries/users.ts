import SQLite from '@services/SQLite';
import type { User, UserRole, Role, Permission } from '@types';
import { randomUUID } from 'crypto';

export const findUserById = (id: string): User | undefined =>
  SQLite.one<User>`SELECT * FROM users WHERE id = ${id}`;

export const findUserByEmail = (email: string): User | undefined =>
  SQLite.one<User>`SELECT * FROM users WHERE email = ${email}`;

export const findUserByPhone = (phone: string): User | undefined =>
  SQLite.one<User>`SELECT * FROM users WHERE phone = ${phone}`;

export const findUserByEmailOrPhone = (email?: string, phone?: string): User | undefined => {
  if (email) return findUserByEmail(email);
  if (phone) return findUserByPhone(phone);
  return undefined;
};

export const createUser = (data: {
  id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  password: string;
  avatar?: string | null;
  is_verified?: boolean;
}): User => {
  const now = Date.now();
  SQLite.exec`
    INSERT INTO users (id, name, email, phone, avatar, password, is_verified, created_at, updated_at)
    VALUES (${data.id}, ${data.name ?? null}, ${data.email}, ${data.phone ?? null}, ${data.avatar ?? null}, ${data.password}, ${data.is_verified ? 1 : 0}, ${now}, ${now})
  `;
  return findUserById(data.id)!;
};

export const updateUser = (id: string, data: Partial<Omit<User, 'id' | 'created_at'>>): User | undefined => {
  const fields: string[] = [];
  const values: unknown[] = [];
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && key !== 'id' && key !== 'created_at') {
      fields.push(`${key} = ?`);
      values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }
  }
  
  if (fields.length === 0) return findUserById(id);
  
  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);
  
  SQLite.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
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

export const searchUsers = (search: string, filter: 'all' | 'verified' | 'unverified' = 'all'): User[] => {
  const pattern = `%${search.replace(/[%_]/g, '')}%`;
  
  let query = `SELECT * FROM users WHERE (name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
  const params: unknown[] = [pattern, pattern, pattern];
  
  if (filter === 'verified') {
    query += ' AND is_verified = 1';
  } else if (filter === 'unverified') {
    query += ' AND is_verified = 0';
  }
  
  query += ' ORDER BY created_at DESC';
  return SQLite.all<User>(query, params);
};

export const getUsersPaginated = (
  page: number, 
  limit: number, 
  search = '', 
  filter: 'all' | 'verified' | 'unverified' = 'all'
): { data: User[]; total: number } => {
  const pattern = `%${search.replace(/[%_]/g, '')}%`;
  
  let whereClause = `(name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
  const params: unknown[] = [pattern, pattern, pattern];
  
  if (filter === 'verified') {
    whereClause += ' AND is_verified = 1';
  } else if (filter === 'unverified') {
    whereClause += ' AND is_verified = 0';
  }
  
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
  SQLite.exec`UPDATE users SET avatar = ${avatarUrl}, updated_at = ${Date.now()} WHERE id = ${id}`;
};

export const updatePassword = (id: string, hashedPassword: string): void => {
  SQLite.exec`UPDATE users SET password = ${hashedPassword}, updated_at = ${Date.now()} WHERE id = ${id}`;
};

export const getUserRoles = (userId: string): Role[] =>
  SQLite.many<Role>`
    SELECT r.id, r.name, r.slug, r.description, r.created_at, r.updated_at
    FROM roles r
    INNER JOIN user_roles ur ON r.id = ur.role_id
    WHERE ur.user_id = ${userId}
  `;

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
  const exists = SQLite.one<UserRole>`SELECT * FROM user_roles WHERE user_id = ${userId} AND role_id = ${roleId}`;
  if (!exists) {
    SQLite.exec`INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (${randomUUID()}, ${userId}, ${roleId}, ${Date.now()})`;
  }
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
