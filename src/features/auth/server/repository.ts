import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../../shared/database';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  password: string;
  avatar: string | null;
  must_change_password: number;
  created_at: number;
  updated_at: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  must_change_password: number;
}

export function findUserByEmail(email: string): StoredUser | undefined {
  return getDatabase()
    .prepare('SELECT id, name, email, password, avatar, must_change_password, created_at, updated_at FROM users WHERE email = ?')
    .get(email) as StoredUser | undefined;
}

export function findUserById(userId: string): StoredUser | undefined {
  return getDatabase()
    .prepare('SELECT id, name, email, password, avatar, must_change_password, created_at, updated_at FROM users WHERE id = ?')
    .get(userId) as StoredUser | undefined;
}

export function createUser(data: {
  id: string;
  name: string;
  email: string;
  password: string;
}): StoredUser {
  const now = Date.now();
  getDatabase()
    .prepare(
      `INSERT INTO users (id, name, email, password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(data.id, data.name, data.email, data.password, now, now);

  return findUserByEmail(data.email)!;
}

export function updatePassword(userId: string, password: string): void {
  getDatabase()
    .prepare('UPDATE users SET password = ?, must_change_password = 0, updated_at = ? WHERE id = ?')
    .run(password, Date.now(), userId);
}

export function deleteSessionsByUserId(userId: string): void {
  getDatabase().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export interface StoredSession {
  id: string;
  handle: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: number;
  last_seen_at: number | null;
}

export function createSession(data: {
  id: string;
  handle: string;
  userId: string;
  userAgent: string | undefined;
  ipAddress: string | undefined;
  expiresAt: number;
  maxPerUser: number;
}): void {
  const database = getDatabase();
  const now = Date.now();
  database.transaction(() => {
    database
      .prepare(
        `INSERT INTO sessions (id, handle, user_id, user_agent, ip_address, expires_at, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(data.id, data.handle, data.userId, data.userAgent ?? null, data.ipAddress ?? null, data.expiresAt, now, now);
    // Bound per-account session growth: the oldest devices fall off first.
    database
      .prepare(
        `DELETE FROM sessions
         WHERE user_id = ?
           AND id NOT IN (
             SELECT id FROM sessions WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?
           )`,
      )
      .run(data.userId, data.userId, data.maxPerUser);
  })();
}

export function findUserBySessionId(sessionId: string): (SessionUser & { session_last_seen_at: number | null }) | undefined {
  return getDatabase()
    .prepare(
      `SELECT u.id, u.name, u.email, u.avatar, u.must_change_password, s.last_seen_at AS session_last_seen_at
       FROM users u
       INNER JOIN sessions s ON s.user_id = u.id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .get(sessionId, Date.now()) as (SessionUser & { session_last_seen_at: number | null }) | undefined;
}

export function touchSession(sessionId: string, now: number): void {
  getDatabase().prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(now, sessionId);
}

export function listActiveSessions(userId: string, now: number = Date.now()): StoredSession[] {
  return getDatabase()
    .prepare(
      `SELECT id, handle, user_agent, ip_address, created_at, last_seen_at
       FROM sessions
       WHERE user_id = ? AND expires_at > ?
       ORDER BY COALESCE(last_seen_at, created_at) DESC, created_at DESC`,
    )
    .all(userId, now) as StoredSession[];
}

/** Revokes one of the account's own sessions by its public handle. */
export function deleteSessionByHandle(userId: string, handle: string): boolean {
  const result = getDatabase()
    .prepare('DELETE FROM sessions WHERE user_id = ? AND handle = ?')
    .run(userId, handle);
  return result.changes > 0;
}

export function deleteOtherSessions(userId: string, keepSessionId: string): number {
  const result = getDatabase()
    .prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?')
    .run(userId, keepSessionId);
  return Number(result.changes);
}

export function deleteSession(sessionId: string): void {
  getDatabase().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

/**
 * Auth-owned expired-session cleanup. Deletes session rows and pending
 * two-factor challenges whose expiry has passed and returns the removed
 * count. Scheduling lives with the App lifecycle; this function never
 * creates timers.
 */
export function cleanupExpiredSessions(now: number = Date.now()): number {
  const database = getDatabase();
  const sessions = database
    .prepare('DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at <= ?')
    .run(now);
  const challenges = database.prepare('DELETE FROM two_factor_challenges WHERE expires_at <= ?').run(now);
  return Number(sessions.changes) + Number(challenges.changes);
}

export interface TwoFactorState {
  two_factor_secret: string | null;
  two_factor_pending_secret: string | null;
  two_factor_enabled_at: number | null;
  two_factor_last_step: number | null;
}

export function findTwoFactorState(userId: string): TwoFactorState | undefined {
  return getDatabase()
    .prepare(
      `SELECT two_factor_secret, two_factor_pending_secret, two_factor_enabled_at, two_factor_last_step
       FROM users WHERE id = ?`,
    )
    .get(userId) as TwoFactorState | undefined;
}

export function setPendingTwoFactorSecret(userId: string, secret: string): void {
  getDatabase()
    .prepare('UPDATE users SET two_factor_pending_secret = ?, updated_at = ? WHERE id = ?')
    .run(secret, Date.now(), userId);
}

function insertRecoveryCodes(userId: string, codeHashes: readonly string[], now: number): void {
  const database = getDatabase();
  database.prepare('DELETE FROM two_factor_recovery_codes WHERE user_id = ?').run(userId);
  const insert = database.prepare(
    'INSERT INTO two_factor_recovery_codes (id, user_id, code_hash, used_at, created_at) VALUES (?, ?, ?, NULL, ?)',
  );
  for (const codeHash of codeHashes) insert.run(randomUUID(), userId, codeHash, now);
}

/** Promotes the pending secret, records the accepted step, and replaces recovery codes atomically. */
export function enableTwoFactor(userId: string, secret: string, acceptedStep: number, codeHashes: readonly string[]): void {
  const database = getDatabase();
  const now = Date.now();
  database.transaction(() => {
    database
      .prepare(
        `UPDATE users
         SET two_factor_secret = ?, two_factor_pending_secret = NULL, two_factor_enabled_at = ?,
             two_factor_last_step = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(secret, now, acceptedStep, now, userId);
    insertRecoveryCodes(userId, codeHashes, now);
  })();
}

export function disableTwoFactor(userId: string): void {
  const database = getDatabase();
  database.transaction(() => {
    database
      .prepare(
        `UPDATE users
         SET two_factor_secret = NULL, two_factor_pending_secret = NULL, two_factor_enabled_at = NULL,
             two_factor_last_step = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .run(Date.now(), userId);
    database.prepare('DELETE FROM two_factor_recovery_codes WHERE user_id = ?').run(userId);
    database.prepare('DELETE FROM two_factor_challenges WHERE user_id = ?').run(userId);
  })();
}

export function replaceRecoveryCodes(userId: string, codeHashes: readonly string[]): void {
  getDatabase().transaction(() => insertRecoveryCodes(userId, codeHashes, Date.now()))();
}

export function countUnusedRecoveryCodes(userId: string): number {
  const row = getDatabase()
    .prepare('SELECT COUNT(*) AS count FROM two_factor_recovery_codes WHERE user_id = ? AND used_at IS NULL')
    .get(userId) as { count: number };
  return row.count;
}

/** Marks a matching unused recovery code as used; false when none matched. */
export function consumeRecoveryCode(userId: string, codeHash: string): boolean {
  const result = getDatabase()
    .prepare(
      'UPDATE two_factor_recovery_codes SET used_at = ? WHERE user_id = ? AND code_hash = ? AND used_at IS NULL',
    )
    .run(Date.now(), userId, codeHash);
  return result.changes > 0;
}

/** Advances the replay guard only forward; false when the step was already used. */
export function recordTwoFactorStep(userId: string, step: number): boolean {
  const result = getDatabase()
    .prepare(
      `UPDATE users SET two_factor_last_step = ?
       WHERE id = ? AND (two_factor_last_step IS NULL OR two_factor_last_step < ?)`,
    )
    .run(step, userId, step);
  return result.changes > 0;
}

export interface StoredChallenge {
  id: string;
  user_id: string;
  user_agent: string | null;
  ip_address: string | null;
  attempts: number;
  expires_at: number;
}

export function createTwoFactorChallenge(data: {
  id: string;
  userId: string;
  userAgent: string | undefined;
  ipAddress: string | undefined;
  expiresAt: number;
}): void {
  const database = getDatabase();
  database.transaction(() => {
    // One outstanding challenge per account keeps attempt budgets meaningful.
    database.prepare('DELETE FROM two_factor_challenges WHERE user_id = ?').run(data.userId);
    database
      .prepare(
        `INSERT INTO two_factor_challenges (id, user_id, user_agent, ip_address, attempts, expires_at, created_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(data.id, data.userId, data.userAgent ?? null, data.ipAddress ?? null, data.expiresAt, Date.now());
  })();
}

export function findTwoFactorChallenge(id: string, now: number = Date.now()): StoredChallenge | undefined {
  return getDatabase()
    .prepare(
      `SELECT id, user_id, user_agent, ip_address, attempts, expires_at
       FROM two_factor_challenges WHERE id = ? AND expires_at > ?`,
    )
    .get(id, now) as StoredChallenge | undefined;
}

/** Records a failed attempt and returns the new attempt count. */
export function recordChallengeFailure(id: string): number {
  const row = getDatabase()
    .prepare('UPDATE two_factor_challenges SET attempts = attempts + 1 WHERE id = ? RETURNING attempts')
    .get(id) as { attempts: number } | undefined;
  return row?.attempts ?? Number.POSITIVE_INFINITY;
}

export function deleteTwoFactorChallenge(id: string): void {
  getDatabase().prepare('DELETE FROM two_factor_challenges WHERE id = ?').run(id);
}
