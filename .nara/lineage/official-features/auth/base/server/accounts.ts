import { getDatabase } from '../../../shared/database';
import { syncUserRoles } from './access';
import { accountsChanged, rolesChanged, sessionsChanged } from './live';

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
  /** Raised by every edit of the account's profile or roles. */
  revision: number;
}

/** `stale` carries the account as it is now; nothing was written. */
export type AccountUpdate =
  | { status: 'updated'; account: AccountRecord }
  | { status: 'stale'; account: AccountRecord }
  | { status: 'missing' };

export interface AccountList {
  data: AccountRecord[];
  total: number;
}

export interface AccountCreateInput {
  id: string;
  name: AccountRecord['name'];
  email: AccountRecord['email'];
  passwordHash: string;
  /** The password is temporary: the account must replace it before using the API. */
  mustChangePassword?: boolean;
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

/**
 * Whether `error` is the refusal of an account write because another account
 * already uses the email; creating and updating accounts throw it.
 */
export function isDuplicateEmailError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    error.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
    error.message.includes('users.email')
  );
}

/** Whether any account uses the email, ignoring case. */
export function accountEmailTaken(email: string): boolean {
  return getDatabase().prepare('SELECT 1 FROM users WHERE lower(email) = lower(?)').get(email) !== undefined;
}

export function findAccountById(userId: string): AccountRecord | undefined {
  return getDatabase()
    .prepare('SELECT id, name, email, avatar, revision FROM users WHERE id = ?')
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
      `SELECT id, name, email, avatar, revision
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
      `INSERT INTO users (id, name, email, password, avatar, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(data.id, data.name, data.email, data.passwordHash, null, data.mustChangePassword ? 1 : 0, now, now);
  return findAccountById(data.id)!;
}

export function createAccountWithRoles(data: AccountCreateInput, roleIds?: string[]): AccountRecord {
  const database = getDatabase();
  const account = database.transaction(() => {
    const created = createAccount(data);
    if (roleIds !== undefined) syncUserRoles(created.id, roleIds);
    return created;
  })();
  // Role member counts changed.
  if (roleIds !== undefined && roleIds.length > 0) rolesChanged();
  return account;
}

/**
 * Applies `data` and raises the revision. With `revision`, writes only while
 * the account is still at it, so an edit based on stale data is refused.
 */
export function updateAccount(userId: string, data: AccountUpdateInput, revision?: number): AccountUpdate {
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
  fields.push('revision = revision + 1', 'updated_at = ?');
  values.push(Date.now(), userId);
  const current = revision === undefined ? '' : ' AND revision = ?';
  if (revision !== undefined) values.push(revision);
  const written = getDatabase().prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?${current}`).run(...values).changes;
  const account = findAccountById(userId);
  if (!account) return { status: 'missing' };
  return written === 0 ? { status: 'stale', account } : { status: 'updated', account };
}

export interface AccountManagedUpdateOptions {
  roleIds?: string[];
  /** Apply only while the account is still at this revision. */
  revision?: number;
}

export function updateAccountWithRoles(
  userId: string,
  data: AccountUpdateInput,
  options: AccountManagedUpdateOptions = {},
): AccountUpdate {
  const database = getDatabase();
  const update = database.transaction((): AccountUpdate => {
    const result = updateAccount(userId, data, options.revision);
    if (result.status !== 'updated' || options.roleIds === undefined) return result;
    syncUserRoles(userId, options.roleIds);
    return result;
  })();
  if (update.status === 'updated') {
    accountsChanged([userId]);
    if (options.roleIds !== undefined) rolesChanged();
  }
  return update;
}

export function resetAccountPassword(userId: string, passwordHash: string): AccountRecord | undefined {
  const database = getDatabase();
  const account = database.transaction(() => {
    const result = database
      .prepare('UPDATE users SET password = ?, must_change_password = 1, updated_at = ? WHERE id = ?')
      .run(passwordHash, Date.now(), userId);
    if (result.changes === 0) return undefined;
    database.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    return findAccountById(userId);
  })();
  if (account) sessionsChanged([userId]);
  return account;
}

export function deleteAccounts(userIds: string[]): number {
  if (userIds.length === 0) return 0;
  const placeholders = userIds.map(() => '?').join(', ');
  const deleted = getDatabase().prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...userIds).changes;
  sessionsChanged(userIds);
  if (deleted > 0) rolesChanged();
  return deleted;
}
