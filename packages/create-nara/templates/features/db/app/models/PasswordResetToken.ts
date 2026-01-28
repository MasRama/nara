/**
 * PasswordResetToken Model
 *
 * Handles password reset token database operations.
 */
import { db } from '../config/database.js';

/**
 * PasswordResetToken record interface
 */
export interface PasswordResetTokenRecord {
  id: number;
  email: string;
  token: string;
  created_at: number;
  expires_at: number;
}

/**
 * Data for creating a new password reset token
 */
export interface CreatePasswordResetTokenData {
  email: string;
  token: string;
  expires_at: number;
}

class PasswordResetTokenModel {
  private tableName = 'password_reset_tokens';

  /**
   * Find valid token (not expired)
   */
  async findValidToken(token: string): Promise<PasswordResetTokenRecord | undefined> {
    return db(this.tableName)
      .where('token', token)
      .where('expires_at', '>', Date.now())
      .first();
  }

  /**
   * Find by email
   */
  async findByEmail(email: string): Promise<PasswordResetTokenRecord | undefined> {
    return db(this.tableName).where('email', email).first();
  }

  /**
   * Create a new password reset token
   */
  async createToken(data: CreatePasswordResetTokenData): Promise<void> {
    await db(this.tableName).insert({
      email: data.email,
      token: data.token,
      expires_at: data.expires_at,
      created_at: Date.now(),
    });
  }

  /**
   * Delete token by token string
   */
  async deleteByToken(token: string): Promise<number> {
    return db(this.tableName).where('token', token).delete();
  }

  /**
   * Delete all tokens for an email
   */
  async deleteByEmail(email: string): Promise<number> {
    return db(this.tableName).where('email', email).delete();
  }

  /**
   * Delete expired tokens
   */
  async deleteExpired(): Promise<number> {
    return db(this.tableName).where('expires_at', '<', Date.now()).delete();
  }
}

export const PasswordResetToken = new PasswordResetTokenModel();
export default PasswordResetToken;
