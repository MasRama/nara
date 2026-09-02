import type { CreateUserInput, ProfileInput, UpdateUserInput, UserProfile } from '../contract';
import { getDatabase } from '../../../shared/database';

export function findUserProfileById(userId: string): UserProfile | undefined {
  return getDatabase()
    .prepare('SELECT id, name, email, avatar FROM users WHERE id = ?')
    .get(userId) as UserProfile | undefined;
}

export function updateUserProfile(userId: string, data: ProfileInput): UserProfile | undefined {
  getDatabase()
    .prepare('UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?')
    .run(data.name, data.email, Date.now(), userId);
  return findUserProfileById(userId);
}

export function listUsers(page: number, limit: number, search = ''): { data: UserProfile[]; total: number } {
  const normalizedPage = Math.max(1, page);
  const normalizedLimit = Math.max(1, Math.min(100, limit));
  const pattern = `%${search.replace(/[%_]/g, '')}%`;
  const database = getDatabase();
  const count = database
    .prepare('SELECT COUNT(*) AS count FROM users WHERE name LIKE ? OR email LIKE ?')
    .get(pattern, pattern) as { count: number };
  const data = database
    .prepare(
      `SELECT id, name, email, avatar
       FROM users
       WHERE name LIKE ? OR email LIKE ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(pattern, pattern, normalizedLimit, (normalizedPage - 1) * normalizedLimit) as UserProfile[];
  return { data, total: count.count };
}

export function createManagedUser(data: {
  id: string;
  name: CreateUserInput['name'];
  email: CreateUserInput['email'];
  password: string;
}): UserProfile {
  const now = Date.now();
  getDatabase()
    .prepare(
      `INSERT INTO users (id, name, email, password, avatar, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(data.id, data.name, data.email, data.password, null, now, now);
  return findUserProfileById(data.id)!;
}

export function updateManagedUser(
  userId: string,
  data: Pick<UpdateUserInput, 'name' | 'email'> & { password?: string },
): UserProfile | undefined {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.email !== undefined) {
    fields.push('email = ?');
    values.push(data.email);
  }
  if (data.password !== undefined) {
    fields.push('password = ?');
    values.push(data.password);
  }
  if (fields.length > 0) {
    fields.push('updated_at = ?');
    values.push(Date.now(), userId);
    getDatabase().prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  return findUserProfileById(userId);
}

export function deleteUsers(userIds: string[]): number {
  if (userIds.length === 0) return 0;
  const placeholders = userIds.map(() => '?').join(', ');
  return getDatabase().prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...userIds).changes;
}
