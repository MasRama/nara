/**
 * Session Model
 * 
 * Handles session-related database operations.
 */
import { BaseModel, BaseRecord } from "./BaseModel.js";

/**
 * Session record interface
 */
export interface SessionRecord extends BaseRecord {
  id: string;
  user_id: string;
  user_agent: string | null;
}

/**
 * Data for creating a new session
 */
export interface CreateSessionData {
  id: string;
  user_id: string;
  user_agent?: string | null;
}

class SessionModel extends BaseModel<SessionRecord> {
  protected tableName = "sessions";
  protected timestampOptions = {
    useTimestamps: false,
    timestampFormat: 'bigint' as const
  };

  /**
   * Find sessions by user ID
   */
  async findByUserId(userId: string): Promise<SessionRecord[]> {
    return this.query().where("user_id", userId);
  }

  /**
   * Delete all sessions for a user
   */
  async deleteByUserId(userId: string): Promise<number> {
    return this.query().where("user_id", userId).delete();
  }

  /**
   * Create a new session
   */
  async createSession(data: CreateSessionData): Promise<SessionRecord> {
    await this.query().insert(data);
    return this.findById(data.id) as Promise<SessionRecord>;
  }

  /**
   * Get user by session ID (optimized JOIN query)
   * Returns user data if session is valid, undefined otherwise
   */
  async getUserBySessionId(sessionId: string): Promise<{
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    avatar: string | null;
    is_admin: boolean;
    is_verified: boolean;
  } | undefined> {
    const DB = (await import("../services/DB.js")).default;
    return DB.from("sessions")
      .join("users", "sessions.user_id", "users.id")
      .where("sessions.id", sessionId)
      .select([
        "users.id",
        "users.name",
        "users.email",
        "users.phone",
        "users.avatar",
        "users.is_admin",
        "users.is_verified"
      ])
      .first();
  }
}

export const Session = new SessionModel();
export default Session;
