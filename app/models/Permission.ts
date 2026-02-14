/**
 * Permission Model
 *
 * Handles all permission-related database operations.
 */
import { BaseModel, BaseRecord } from "./BaseModel";
import DB from "@services/DB";

/**
 * Permission record interface
 */
export interface PermissionRecord extends BaseRecord {
  id: string;
  name: string;
  slug: string;
  resource: string;
  action: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Data for creating a new permission
 */
export interface CreatePermissionData {
  id: string;
  name: string;
  slug: string;
  resource: string;
  action: string;
  description?: string | null;
}

/**
 * Data for updating a permission
 */
export interface UpdatePermissionData {
  name?: string;
  slug?: string;
  resource?: string;
  action?: string;
  description?: string | null;
}

/**
 * Role record interface (for relationship)
 */
interface RoleRecord {
  id: string;
  name: string;
  slug: string;
}

class PermissionModel extends BaseModel<PermissionRecord> {
  protected tableName = "permissions";

  /**
   * Find permission by slug
   */
  async findBySlug(slug: string): Promise<PermissionRecord | undefined> {
    return this.query().where("slug", slug).first();
  }

  /**
   * Find permissions by resource
   */
  async findByResource(resource: string): Promise<PermissionRecord[]> {
    return this.query().where("resource", resource);
  }

  /**
   * Get roles with this permission
   */
  async roles(permissionId: string): Promise<RoleRecord[]> {
    return DB.table("roles")
      .join("role_permissions", "roles.id", "role_permissions.role_id")
      .where("role_permissions.permission_id", permissionId)
      .select("roles.id", "roles.name", "roles.slug");
  }

  /**
   * Get or create permission by slug
   */
  async firstOrCreate(data: CreatePermissionData): Promise<PermissionRecord> {
    const existing = await this.findBySlug(data.slug);
    if (existing) {
      return existing;
    }
    return this.create(data);
  }
}

export const Permission = new PermissionModel();
export default Permission;
