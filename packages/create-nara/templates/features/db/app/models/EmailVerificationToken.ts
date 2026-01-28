/**
 * EmailVerificationToken Model
 *
 * Handles email verification token database operations.
 */
import { db } from '../config/database.js';

/**
 * EmailVerificationToken record interface
 */
export interface EmailVerificationTokenRecord {
  id: number;
  user_id: string;
  token: string;
  created_at: number;
  expires_at: number;
}

/**
 * Data for creating a new email verification token
 */
export interface CreateEmailVerificationTokenData {
  user_id: string;
  token: string;
  expires_at: number;
}

class EmailVerificationTokenModel {
  private tableName = 'email_verification_tokens';

  /**
   * Find valid token for user (not expired)
   */
  async findValidToken(userId: string, token: string): Promise<EmailVerificationTokenRecord | undefined> {
    return db(this.tableName)
      .where('user_id', userId)
      .where('token', token)
      .where('expires_at', '>', Date.now())
      .first();
  }

  /**
   * Find by user ID
   */
  async findByUserId(userId: string): Promise<EmailVerificationTokenRecord | undefined> {
    return db(this.tableName).where('user_id', userId).first();
  }

  /**
   * Create a new email verification token
   */
  async createToken(data: CreateEmailVerificationTokenData): Promise<void> {
    await db(this.tableName).insert({
      user_id: data.user_id,
      token: data.token,
      expires_at: data.expires_at,
      created_at: Date.now(),
    });
  }

  /**
   * Delete all tokens for a user
   */
  async deleteByUserId(userId: string): Promise<number> {
    return db(this.tableName).where('user_id', userId).delete();
  }

  /**
   * Delete expired tokens
   */
  async deleteExpired(): Promise<number> {
    return db(this.tableName).where('expires_at', '<', Date.now()).delete();
  }
}

export const EmailVerificationToken = new EmailVerificationTokenModel();
export default EmailVerificationToken;
