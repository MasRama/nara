/**
 * PasswordResetToken Model
 * 
 * Handles password reset token database operations.
 */
import { BaseModel, BaseRecord } from "./BaseModel";

/**
 * PasswordResetToken record interface
 */
export interface PasswordResetTokenRecord extends BaseRecord {
  id: number;
  email: string;
  token: string;
  created_at: Date;
  expires_at: Date;
}

/**
 * Data for creating a new password reset token
 */
export interface CreatePasswordResetTokenData {
  email: string;
  token: string;
  expires_at: Date;
}

class PasswordResetTokenModel extends BaseModel<PasswordResetTokenRecord> {
  protected tableName = "password_reset_tokens";
  protected timestampOptions = {
    useTimestamps: false,
    timestampFormat: 'datetime' as const
  };

  /**
   * Find valid token (not expired)
   */
  async findValidToken(token: string): Promise<PasswordResetTokenRecord | undefined> {
    return this.query()
      .where("token", token)
      .where("expires_at", ">", new Date())
      .first();
  }

  /**
   * Find by email
   */
  async findByEmail(email: string): Promise<PasswordResetTokenRecord | undefined> {
    return this.query().where("email", email).first();
  }

  /**
   * Create a new password reset token
   */
  async createToken(data: CreatePasswordResetTokenData): Promise<void> {
    await this.query().insert({
      email: data.email,
      token: data.token,
      expires_at: data.expires_at
    });
  }

  /**
   * Delete token by token string
   */
  async deleteByToken(token: string): Promise<number> {
    return this.query().where("token", token).delete();
  }

  /**
   * Delete all tokens for an email
   */
  async deleteByEmail(email: string): Promise<number> {
    return this.query().where("email", email).delete();
  }

  /**
   * Delete expired tokens
   */
  async deleteExpired(): Promise<number> {
    return this.query().where("expires_at", "<", new Date()).delete();
  }
}

export const PasswordResetToken = new PasswordResetTokenModel();
export default PasswordResetToken;
