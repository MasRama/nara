import { getDatabase } from '../../../shared/database';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  password: string;
  avatar: string | null;
  created_at: number;
  updated_at: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

export function findUserByEmail(email: string): StoredUser | undefined {
  return getDatabase()
    .prepare('SELECT id, name, email, password, avatar, created_at, updated_at FROM users WHERE email = ?')
    .get(email) as StoredUser | undefined;
}

export function findUserById(userId: string): StoredUser | undefined {
  return getDatabase()
    .prepare('SELECT id, name, email, password, avatar, created_at, updated_at FROM users WHERE id = ?')
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
    .prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?')
    .run(password, Date.now(), userId);
}

export function deleteSessionsByUserId(userId: string): void {
  getDatabase().prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function createSession(data: {
  id: string;
  userId: string;
  userAgent: string | undefined;
  expiresAt: number;
}): void {
  getDatabase()
    .prepare(
      `INSERT INTO sessions (id, user_id, user_agent, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(data.id, data.userId, data.userAgent ?? null, data.expiresAt, Date.now());
}

export function findUserBySessionId(sessionId: string): SessionUser | undefined {
  return getDatabase()
    .prepare(
      `SELECT u.id, u.name, u.email, u.avatar
       FROM users u
       INNER JOIN sessions s ON s.user_id = u.id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .get(sessionId, Date.now()) as SessionUser | undefined;
}

export function deleteSession(sessionId: string): void {
  getDatabase().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

/**
 * Auth-owned expired-session cleanup. Deletes rows whose expiry has passed
 * and returns the removed count. Scheduling lives with the App lifecycle;
 * this function never creates timers.
 */
export function cleanupExpiredSessions(now: number = Date.now()): number {
  const result = getDatabase()
    .prepare('DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at <= ?')
    .run(now);
  return Number(result.changes);
}
