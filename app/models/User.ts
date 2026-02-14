/**
 * User Model
 *
 * Handles all user-related database operations.
 */
import { BaseModel, BaseRecord } from "./BaseModel";
import DB from "@services/DB";
import { Role } from "./Role";

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
  password: string;
  remember_me_token: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Role record interface (for relationship)
 */
interface RoleRecord {
  id: string;
  name: string;
  slug: string;
}

/**
 * Permission record interface (for relationship)
 */
interface PermissionRecord {
  id: string;
  slug: string;
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
      // Sanitize search term to remove SQL wildcards that could cause unexpected behavior
      const sanitizedSearch = searchTerm.replace(/[%_]/g, '');
      const searchPattern = `%${sanitizedSearch}%`;
      query = query.where(function() {
        this.where('name', 'like', searchPattern)
          .orWhere('email', 'like', searchPattern)
          .orWhere('phone', 'like', searchPattern);
      });
    }

    if (filter === 'verified') {
      query = query.where('is_verified', true);
    } else if (filter === 'unverified') {
      query = query.where('is_verified', false);
    }

    return query.orderBy('created_at', 'desc');
  }

  // ==========================================
  // RBAC Methods
  // ==========================================

  /**
   * Get all roles for a user
   */
  async roles(userId: string): Promise<RoleRecord[]> {
    return DB.table("roles")
      .join("user_roles", "roles.id", "user_roles.role_id")
      .where("user_roles.user_id", userId)
      .select("roles.id", "roles.name", "roles.slug");
  }

  /**
   * Check if user has a specific role
   */
  async hasRole(userId: string, roleSlug: string): Promise<boolean> {
    const result = await DB.table("user_roles")
      .join("roles", "user_roles.role_id", "roles.id")
      .where("user_roles.user_id", userId)
      .where("roles.slug", roleSlug)
      .first();
    return !!result;
  }

  /**
   * Check if user has a specific permission (through their roles)
   */
  async hasPermission(userId: string, permissionSlug: string): Promise<boolean> {
    const result = await DB.table("permissions")
      .join("role_permissions", "permissions.id", "role_permissions.permission_id")
      .join("user_roles", "role_permissions.role_id", "user_roles.role_id")
      .where("user_roles.user_id", userId)
      .where("permissions.slug", permissionSlug)
      .first();
    return !!result;
  }

  /**
   * Get all permissions for a user (through their roles)
   */
  async permissions(userId: string): Promise<PermissionRecord[]> {
    return DB.table("permissions")
      .join("role_permissions", "permissions.id", "role_permissions.permission_id")
      .join("user_roles", "role_permissions.role_id", "user_roles.role_id")
      .where("user_roles.user_id", userId)
      .select("permissions.id", "permissions.slug", "permissions.name")
      .distinct();
  }

  /**
   * Assign a role to a user
   */
  async assignRole(userId: string, roleSlug: string): Promise<void> {
    const role = await Role.findBySlug(roleSlug);
    if (!role) {
      throw new Error(`Role '${roleSlug}' not found`);
    }

    const exists = await DB.table("user_roles")
      .where({ user_id: userId, role_id: role.id })
      .first();

    if (!exists) {
      await DB.table("user_roles").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        role_id: role.id,
        created_at: Date.now(),
      });
    }
  }

  /**
   * Remove a role from a user
   */
  async removeRole(userId: string, roleSlug: string): Promise<void> {
    const role = await Role.findBySlug(roleSlug);
    if (!role) return;

    await DB.table("user_roles")
      .where({ user_id: userId, role_id: role.id })
      .delete();
  }

  /**
   * Sync roles - remove all existing and add new ones
   */
  async syncRoles(userId: string, roleSlugs: string[]): Promise<void> {
    // Get all role IDs
    const roles = await DB.table("roles")
      .whereIn("slug", roleSlugs)
      .select("id", "slug");

    // Delete existing roles
    await DB.table("user_roles").where("user_id", userId).delete();

    // Insert new roles
    if (roles.length > 0) {
      const now = Date.now();
      const inserts = roles.map((role) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        role_id: role.id,
        created_at: now,
      }));

      await DB.table("user_roles").insert(inserts);
    }
  }

  /**
   * Check if user has admin role
   */
  async isAdmin(userId: string): Promise<boolean> {
    return this.hasRole(userId, "admin");
  }
}

export const User = new UserModel();
export default User;
