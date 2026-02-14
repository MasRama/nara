/**
 * Session Model
 * 
 * Handles session-related database operations.
 */
import { BaseModel, BaseRecord } from "./BaseModel";

/**
 * Session TTL constant (30 days in milliseconds)
 */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Session record interface
 */
export interface SessionRecord extends BaseRecord {
  id: string;
  user_id: string;
  user_agent: string | null;
  expires_at: number | null;
}

/**
 * Data for creating a new session
 */
export interface CreateSessionData {
  id: string;
  user_id: string;
  user_agent?: string | null;
  expires_at?: number | null;
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
    const sessionData = {
      ...data,
      expires_at: data.expires_at || Date.now() + SESSION_TTL_MS
    };
    await this.query().insert(sessionData);
    return this.findById(data.id) as Promise<SessionRecord>;
  }

  /**
   * Get user by session ID (optimized JOIN query)
   * Returns user data if session is valid and not expired, undefined otherwise
   */
  async getUserBySessionId(sessionId: string): Promise<{
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    avatar: string | null;
    is_verified: boolean;
    roles: string[];
  } | undefined> {
    const DB = (await import("@services/DB")).default;

    // Get basic user data
    const user = await DB.from("sessions")
      .join("users", "sessions.user_id", "users.id")
      .where("sessions.id", sessionId)
      .where(function() {
        this.whereNull("sessions.expires_at")
          .orWhere("sessions.expires_at", ">", Date.now());
      })
      .select([
        "users.id",
        "users.name",
        "users.email",
        "users.phone",
        "users.avatar",
        "users.is_verified"
      ])
      .first();

    if (!user) return undefined;

    // Get user roles
    const roles = await DB.from("user_roles")
      .join("roles", "user_roles.role_id", "roles.id")
      .where("user_roles.user_id", user.id)
      .select("roles.slug as role");

    return {
      ...user,
      roles: roles.map((r: { role: string }) => r.role)
    };
  }

  /**
   * Clean up expired sessions
   * Returns the number of deleted sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    return this.query()
      .whereNotNull("expires_at")
      .where("expires_at", "<=", Date.now())
      .delete();
  }
}

export const Session = new SessionModel();
export default Session;
