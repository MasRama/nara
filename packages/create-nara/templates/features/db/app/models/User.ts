/**
 * User Model
 * 
 * Handles all user-related database operations.
 */
import { BaseModel, BaseRecord } from "./BaseModel.js";
import DB from "../services/DB.js";

/**
 * User record interface
 */
export interface UserRecord extends BaseRecord {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  avatar: string | null;
  is_verified: boolean;
  membership_date: string | null;
  is_admin: boolean;
  password: string;
  remember_me_token: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Data for creating a new user
 */
export interface CreateUserData {
  id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  is_verified?: boolean;
  membership_date?: string | null;
  is_admin?: boolean;
  password: string;
  remember_me_token?: string | null;
}

/**
 * Data for updating a user
 */
export interface UpdateUserData {
  name?: string | null;
  email?: string;
  phone?: string | null;
  avatar?: string | null;
  is_verified?: boolean;
  membership_date?: string | null;
  is_admin?: boolean;
  password?: string;
  remember_me_token?: string | null;
}

class UserModel extends BaseModel<UserRecord> {
  protected tableName = "users";

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserRecord | undefined> {
    return this.query().where("email", email).first();
  }

  /**
   * Find user by phone
   */
  async findByPhone(phone: string): Promise<UserRecord | undefined> {
    return this.query().where("phone", phone).first();
  }

  /**
   * Find user by email or phone
   */
  async findByEmailOrPhone(email?: string, phone?: string): Promise<UserRecord | undefined> {
    if (email) {
      return this.findByEmail(email);
    }
    if (phone) {
      return this.findByPhone(phone);
    }
    return undefined;
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    let query = this.query().where("email", email);
    if (excludeId) {
      query = query.whereNot("id", excludeId);
    }
    const user = await query.first();
    return !!user;
  }

  /**
   * Get verified users
   */
  async getVerified(): Promise<UserRecord[]> {
    return this.query().where("is_verified", true);
  }

  /**
   * Get unverified users
   */
  async getUnverified(): Promise<UserRecord[]> {
    return this.query().where("is_verified", false);
  }

  /**
   * Get admin users
   */
  async getAdmins(): Promise<UserRecord[]> {
    return this.query().where("is_admin", true);
  }

  /**
   * Update user avatar
   */
  async updateAvatar(id: string, avatarUrl: string): Promise<UserRecord | undefined> {
    return this.update(id, { avatar: avatarUrl });
  }

  /**
   * Verify user email
   */
  async verifyEmail(id: string): Promise<UserRecord | undefined> {
    return this.update(id, { is_verified: true });
  }

  /**
   * Update user password
   */
  async updatePassword(id: string, hashedPassword: string): Promise<UserRecord | undefined> {
    return this.update(id, { password: hashedPassword });
  }

  /**
   * Delete multiple users by IDs
   */
  async deleteMany(ids: string[]): Promise<number> {
    return DB.from(this.tableName).whereIn("id", ids).delete();
  }

  /**
   * Search users by name, email, or phone
   */
  async search(searchTerm: string, filter?: 'all' | 'verified' | 'unverified'): Promise<UserRecord[]> {
    return this.buildSearchQuery(searchTerm, filter);
  }

  /**
   * Build search query for pagination
   * Returns a Knex query builder that can be passed to paginate()
   */
  buildSearchQuery(searchTerm?: string, filter?: 'all' | 'verified' | 'unverified') {
    let query = this.query().select("*");

    if (searchTerm) {
      query = query.where(function() {
        this.where('name', 'like', `%${searchTerm}%`)
          .orWhere('email', 'like', `%${searchTerm}%`)
          .orWhere('phone', 'like', `%${searchTerm}%`);
      });
    }

    if (filter === 'verified') {
      query = query.where('is_verified', true);
    } else if (filter === 'unverified') {
      query = query.where('is_verified', false);
    }

    return query.orderBy('created_at', 'desc');
  }
}

export const User = new UserModel();
export default User;
