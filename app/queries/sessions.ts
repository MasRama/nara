import SQLite from '@services/SQLite';
import type { Session, User, Role } from '@types';

const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000;

export const findSessionById = (id: string): Session | undefined =>
  SQLite.one<Session>`SELECT * FROM sessions WHERE id = ${id}`;

export const createSession = (data: { id: string; user_id: string; user_agent?: string | null }): Session => {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  SQLite.exec`
    INSERT INTO sessions (id, user_id, user_agent, expires_at) 
    VALUES (${data.id}, ${data.user_id}, ${data.user_agent ?? null}, ${expiresAt})
  `;
  return findSessionById(data.id)!;
};

export const deleteSession = (id: string): void => {
  SQLite.exec`DELETE FROM sessions WHERE id = ${id}`;
};

export const deleteSessionsByUserId = (userId: string): number => {
  const result = SQLite.run('DELETE FROM sessions WHERE user_id = ?', [userId]);
  return result.changes;
};

export const cleanupExpiredSessions = (): number => {
  const result = SQLite.run('DELETE FROM sessions WHERE expires_at IS NOT NULL AND expires_at <= ?', [Date.now()]);
  return result.changes;
};

export const getUserBySessionId = (sessionId: string): (User & { roles: string[] }) | undefined => {
  const user = SQLite.one<User>`
    SELECT u.* FROM users u
    INNER JOIN sessions s ON u.id = s.user_id
    WHERE s.id = ${sessionId}
    AND (s.expires_at IS NULL OR s.expires_at > ${Date.now()})
  `;
  
  if (!user) return undefined;
  
  const roles = SQLite.many<{ slug: string }>`
    SELECT r.slug FROM roles r
    INNER JOIN user_roles ur ON r.id = ur.role_id
    WHERE ur.user_id = ${user.id}
  `;
  
  return { ...user, roles: roles.map(r => r.slug) };
};
