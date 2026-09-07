import { getDatabase } from '../../../shared/database';
import { syncUserRoles } from './access';

/**
 * Auth-owned account directory. Auth owns account identity data
 * (identity, credentials, login identifiers) along with sessions, roles,
 * permissions, and role assignments. Other capabilities reach accounts only
 * through these functions or through a typed host requirement adapted in
 * application-owned bindings — never through direct SQL on the users table.
 *
 * Returned records never include password hashes. Credential reset is a
 * dedicated operation so generic profile edits cannot accidentally mutate
 * credentials without also revoking active sessions.
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
  avatar?: AccountRecord['avatar'];
}

const MAX_PAGE = 1_000_000;
const MAX_PAGE_SIZE = 100;

function boundedInteger(value: number, fallback: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}

function escapeLikeLiteral(value: string): string {
  return value.replace(/[!%_]/g, (character) => `!${character}`);
}

export function findAccountById(userId: string): AccountRecord | undefined {
  return getDatabase()
    .prepare('SELECT id, name, email, avatar FROM users WHERE id = ?')
    .get(userId) as AccountRecord | undefined;
}

export function listAccounts(page: number, limit: number, search = ''): AccountList {
  const normalizedPage = boundedInteger(page, 1, 1, MAX_PAGE);
  const normalizedLimit = boundedInteger(limit, 10, 1, MAX_PAGE_SIZE);
  const pattern = `%${escapeLikeLiteral(search)}%`;
  const database = getDatabase();
  const count = database
    .prepare("SELECT COUNT(*) AS count FROM users WHERE name LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!'")
    .get(pattern, pattern) as { count: number };
  const data = database
    .prepare(
      `SELECT id, name, email, avatar
       FROM users
       WHERE name LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!'
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

export function createAccountWithRoles(data: AccountCreateInput, roleIds?: string[]): AccountRecord {
  const database = getDatabase();
  return database.transaction(() => {
    const account = createAccount(data);
    if (roleIds !== undefined) syncUserRoles(account.id, roleIds);
    return account;
  })();
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

export interface AccountManagedUpdateOptions {
  roleIds?: string[];
}

export function updateAccountWithRoles(
  userId: string,
  data: AccountUpdateInput,
  options: AccountManagedUpdateOptions = {},
): AccountRecord | undefined {
  const database = getDatabase();
  return database.transaction(() => {
    const account = updateAccount(userId, data);
    if (!account) return undefined;
    if (options.roleIds !== undefined) syncUserRoles(userId, options.roleIds);
    return findAccountById(userId);
  })();
}

export function resetAccountPassword(userId: string, passwordHash: string): AccountRecord | undefined {
  const database = getDatabase();
  return database.transaction(() => {
    const result = database
      .prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?')
      .run(passwordHash, Date.now(), userId);
    if (result.changes === 0) return undefined;
    database.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    return findAccountById(userId);
  })();
}

export function deleteAccounts(userIds: string[]): number {
  if (userIds.length === 0) return 0;
  const placeholders = userIds.map(() => '?').join(', ');
  return getDatabase().prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...userIds).changes;
}
