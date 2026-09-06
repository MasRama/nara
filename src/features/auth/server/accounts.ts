import { getDatabase } from '../../../shared/database';

/**
 * Auth-owned account directory. Auth owns account identity data
 * (identity, credentials, login identifiers) along with sessions, roles,
 * permissions, and role assignments. Other capabilities reach accounts only
 * through these functions or through a typed host requirement adapted in
 * application-owned bindings — never through direct SQL on the users table.
 *
 * Returned records never include password hashes. Credential writes accept
 * an already-hashed password; hashing policy lives in the auth service.
 */
export interface AccountRecord {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export interface AccountList {
  data: AccountRecord[];
  total: number;
}

export interface AccountCreateInput {
  id: string;
  name: AccountRecord['name'];
  email: AccountRecord['email'];
  passwordHash: string;
}

export interface AccountUpdateInput {
  name?: AccountRecord['name'];
  email?: AccountRecord['email'];
  passwordHash?: string;
  avatar?: AccountRecord['avatar'];
}

export function findAccountById(userId: string): AccountRecord | undefined {
  return getDatabase()
    .prepare('SELECT id, name, email, avatar FROM users WHERE id = ?')
    .get(userId) as AccountRecord | undefined;
}

export function listAccounts(page: number, limit: number, search = ''): AccountList {
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
    .all(pattern, pattern, normalizedLimit, (normalizedPage - 1) * normalizedLimit) as AccountRecord[];
  return { data, total: count.count };
}

export function createAccount(data: AccountCreateInput): AccountRecord {
  const now = Date.now();
  getDatabase()
    .prepare(
      `INSERT INTO users (id, name, email, password, avatar, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(data.id, data.name, data.email, data.passwordHash, null, now, now);
  return findAccountById(data.id)!;
}

export function updateAccount(userId: string, data: AccountUpdateInput): AccountRecord | undefined {
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
  if (data.passwordHash !== undefined) {
    fields.push('password = ?');
    values.push(data.passwordHash);
  }
  if (data.avatar !== undefined) {
    fields.push('avatar = ?');
    values.push(data.avatar);
  }
  if (fields.length > 0) {
    fields.push('updated_at = ?');
    values.push(Date.now(), userId);
    getDatabase().prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  return findAccountById(userId);
}

export function deleteAccounts(userIds: string[]): number {
  if (userIds.length === 0) return 0;
  const placeholders = userIds.map(() => '?').join(', ');
  return getDatabase().prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...userIds).changes;
}
