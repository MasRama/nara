/**
 * EmailVerificationToken Model
 * 
 * Handles email verification token database operations.
 */
import { BaseModel, BaseRecord } from "./BaseModel";

/**
 * EmailVerificationToken record interface
 */
export interface EmailVerificationTokenRecord extends BaseRecord {
  id: number;
  user_id: number;
  token: string;
  created_at: Date;
  expires_at: Date;
}

/**
 * Data for creating a new email verification token
 */
export interface CreateEmailVerificationTokenData {
  user_id: number | string;
  token: string;
  expires_at: Date;
}

class EmailVerificationTokenModel extends BaseModel<EmailVerificationTokenRecord> {
  protected tableName = "email_verification_tokens";
  protected timestampOptions = {
    useTimestamps: false,
    timestampFormat: 'datetime' as const
  };

  /**
   * Find valid token for user (not expired)
   */
  async findValidToken(userId: number | string, token: string): Promise<EmailVerificationTokenRecord | undefined> {
    return this.query()
      .where("user_id", userId)
      .where("token", token)
      .where("expires_at", ">", new Date())
      .first();
  }

  /**
   * Find by user ID
   */
  async findByUserId(userId: number | string): Promise<EmailVerificationTokenRecord | undefined> {
    return this.query().where("user_id", userId).first();
  }

  /**
   * Create a new email verification token
   */
  async createToken(data: CreateEmailVerificationTokenData): Promise<void> {
    await this.query().insert({
      user_id: data.user_id,
      token: data.token,
      expires_at: data.expires_at
    });
  }

  /**
   * Delete all tokens for a user
   */
  async deleteByUserId(userId: number | string): Promise<number> {
    return this.query().where("user_id", userId).delete();
  }

  /**
   * Delete expired tokens
   */
  async deleteExpired(): Promise<number> {
    return this.query().where("expires_at", "<", new Date()).delete();
  }
}

export const EmailVerificationToken = new EmailVerificationTokenModel();
export default EmailVerificationToken;
