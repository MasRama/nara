/**
 * Session Model
 * 
 * Handles session-related database operations.
 */
import { db } from '../config/database.js';

export interface Session {
  id: string;
  user_id: string;
  user_agent: string | null;
}

export class SessionModel {
  static tableName = 'sessions';

  static async findById(id: string): Promise<Session | undefined> {
    return db(this.tableName).where({ id }).first();
  }

  static async findByUserId(userId: string): Promise<Session[]> {
    return db(this.tableName).where({ user_id: userId });
  }

  static async create(data: Partial<Session>): Promise<number[]> {
    return db(this.tableName).insert(data);
  }

  static async delete(id: string): Promise<number> {
    return db(this.tableName).where({ id }).delete();
  }

  static async deleteByUserId(userId: string): Promise<number> {
    return db(this.tableName).where({ user_id: userId }).delete();
  }

  /**
   * Get user by session ID (optimized JOIN query)
   */
  static async getUserBySessionId(sessionId: string): Promise<{
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    avatar: string | null;
    is_admin: boolean;
  } | undefined> {
    return db('sessions')
      .join('users', 'sessions.user_id', 'users.id')
      .where('sessions.id', sessionId)
      .select([
        'users.id',
        'users.name',
        'users.email',
        'users.phone',
        'users.avatar',
        db.raw("CASE WHEN users.role = 'admin' THEN 1 ELSE 0 END as is_admin")
      ])
      .first();
  }
}
