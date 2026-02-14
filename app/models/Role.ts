/**
 * Role Model
 *
 * Handles all role-related database operations.
 */
import { BaseModel, BaseRecord } from "./BaseModel";
import DB from "@services/DB";

/**
 * Role record interface
 */
export interface RoleRecord extends BaseRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Data for creating a new role
 */
export interface CreateRoleData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

/**
 * Data for updating a role
 */
export interface UpdateRoleData {
  name?: string;
  slug?: string;
  description?: string | null;
}

/**
 * Permission record interface (for relationship)
 */
interface PermissionRecord {
  id: string;
  slug: string;
}

class RoleModel extends BaseModel<RoleRecord> {
  protected tableName = "roles";

  /**
   * Find role by slug
   */
  async findBySlug(slug: string): Promise<RoleRecord | undefined> {
    return this.query().where("slug", slug).first();
  }

  /**
   * Get permissions for this role
   */
  async permissions(roleId: string): Promise<PermissionRecord[]> {
    return DB.table("permissions")
      .join("role_permissions", "permissions.id", "role_permissions.permission_id")
      .where("role_permissions.role_id", roleId)
      .select("permissions.id", "permissions.slug");
  }

  /**
   * Get users with this role
   */
  async users(roleId: string): Promise<{ id: string; name: string | null; email: string }[]> {
    return DB.table("users")
      .join("user_roles", "users.id", "user_roles.user_id")
      .where("user_roles.role_id", roleId)
      .select("users.id", "users.name", "users.email");
  }

  /**
   * Check if role has a specific permission
   */
  async hasPermission(roleId: string, permissionSlug: string): Promise<boolean> {
    const result = await DB.table("role_permissions")
      .join("permissions", "role_permissions.permission_id", "permissions.id")
      .where("role_permissions.role_id", roleId)
      .where("permissions.slug", permissionSlug)
      .first();
    return !!result;
  }

  /**
   * Add permission to role
   */
  async givePermission(roleId: string, permissionSlug: string): Promise<void> {
    const permission = await DB.table("permissions").where("slug", permissionSlug).first();
    if (!permission) {
      throw new Error(`Permission '${permissionSlug}' not found`);
    }

    const exists = await DB.table("role_permissions")
      .where({ role_id: roleId, permission_id: permission.id })
      .first();

    if (!exists) {
      await DB.table("role_permissions").insert({
        id: crypto.randomUUID(),
        role_id: roleId,
        permission_id: permission.id,
        created_at: Date.now(),
      });
    }
  }

  /**
   * Remove permission from role
   */
  async revokePermission(roleId: string, permissionSlug: string): Promise<void> {
    const permission = await DB.table("permissions").where("slug", permissionSlug).first();
    if (!permission) return;

    await DB.table("role_permissions")
      .where({ role_id: roleId, permission_id: permission.id })
      .delete();
  }

  /**
   * Sync permissions - remove all existing and add new ones
   */
  async syncPermissions(roleId: string, permissionSlugs: string[]): Promise<void> {
    // Get all permission IDs
    const permissions = await DB.table("permissions")
      .whereIn("slug", permissionSlugs)
      .select("id", "slug");

    // Delete existing permissions
    await DB.table("role_permissions").where("role_id", roleId).delete();

    // Insert new permissions
    if (permissions.length > 0) {
      const now = Date.now();
      const inserts = permissions.map((permission) => ({
        id: crypto.randomUUID(),
        role_id: roleId,
        permission_id: permission.id,
        created_at: now,
      }));

      await DB.table("role_permissions").insert(inserts);
    }
  }
}

export const Role = new RoleModel();
export default Role;
