/**
 * RoleController
 *
 * Handles role management operations:
 * - Role listing with permissions (permission-based)
 * - Role CRUD operations (permission-based)
 * - Permission assignment to roles (permission-based)
 */
import { Role, Permission, User } from "@models";
import Logger from "@services/Logger";
import type { NaraRequest, NaraResponse } from "@core";
import {
  BaseController,
  jsonSuccess,
  jsonCreated,
  jsonError,
  jsonServerError
} from "@core";
import { randomUUID } from "crypto";
import { CreateRoleSchema, UpdateRoleSchema } from "@validators";

class RoleController extends BaseController {
  /**
   * Roles management page (Inertia)
   */
  public async rolesPage(request: NaraRequest, response: NaraResponse) {
    await this.requirePermission(request, "roles.view");

    // Check permissions for UI
    const userId = request.user!.id;
    const isAdmin = await User.isAdmin(userId);
    const canCreate = isAdmin || await User.hasPermission(userId, "roles.create");
    const canEdit = isAdmin || await User.hasPermission(userId, "roles.edit");
    const canDelete = isAdmin || await User.hasPermission(userId, "roles.delete");
    const canAssign = isAdmin || await User.hasPermission(userId, "permissions.assign");

    this.requireInertia(response);
    return response.inertia("roles", {
      permissions: { canCreate, canEdit, canDelete, canAssign },
    });
  }

  /**
   * Get all roles with their permissions (JSON endpoint)
   */
  public async index(request: NaraRequest, response: NaraResponse) {
    await this.requirePermission(request, "roles.view");

    try {
      const roles = await Role.findAll();

      // Attach permissions to each role
      const rolesWithPermissions = await Promise.all(
        roles.map(async (role) => {
          const permissions = await Role.permissions(role.id);
          const users = await Role.users(role.id);
          return {
            ...role,
            permissions: permissions.map((p) => p.slug),
            user_count: users.length,
          };
        })
      );

      return jsonSuccess(response, "Roles retrieved", { roles: rolesWithPermissions });
    } catch (error) {
      Logger.error("Failed to fetch roles", error as Error);
      return jsonServerError(response, "Gagal mengambil data roles");
    }
  }

  /**
   * Get all available permissions grouped by resource (JSON endpoint)
   */
  public async permissionsData(request: NaraRequest, response: NaraResponse) {
    await this.requirePermission(request, "roles.view");

    try {
      const permissions = await Permission.findAll();

      // Group permissions by resource
      const grouped: Record<string, Array<{
        id: string;
        name: string;
        slug: string;
        action: string;
        description: string | null;
      }>> = {};

      for (const perm of permissions) {
        if (!grouped[perm.resource]) {
          grouped[perm.resource] = [];
        }
        grouped[perm.resource].push({
          id: perm.id,
          name: perm.name,
          slug: perm.slug,
          action: perm.action,
          description: perm.description,
        });
      }

      return jsonSuccess(response, "Permissions retrieved", { permissions: grouped });
    } catch (error) {
      Logger.error("Failed to fetch permissions", error as Error);
      return jsonServerError(response, "Gagal mengambil data permissions");
    }
  }

  /**
   * Create a new role with permissions (JSON endpoint)
   */
  public async store(request: NaraRequest, response: NaraResponse) {
    await this.requirePermission(request, "roles.create");
    const data = await this.getBody(request, CreateRoleSchema);

    try {
      // Check if slug already exists
      const existing = await Role.findBySlug(data.slug);
      if (existing) {
        return jsonError(response, "Slug role sudah digunakan", 400, "DUPLICATE_SLUG");
      }

      const role = await Role.create({
        id: randomUUID(),
        name: data.name,
        slug: data.slug,
        description: data.description || null,
      });

      // Sync permissions if provided
      if (data.permissions && data.permissions.length > 0) {
        await Role.syncPermissions(role.id, data.permissions);
      }

      // Get permissions for response
      const permissions = await Role.permissions(role.id);

      Logger.info("Role created", {
        roleId: role.id,
        roleName: role.name,
        createdBy: request.user!.id,
      });

      return jsonCreated(response, "Role berhasil dibuat", {
        role: {
          ...role,
          permissions: permissions.map((p) => p.slug),
        },
      });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return jsonError(response, "Slug role sudah digunakan", 400, "DUPLICATE_SLUG");
      }
      Logger.error("Failed to create role", error as Error);
      return jsonServerError(response, "Gagal membuat role");
    }
  }

  /**
   * Update an existing role with permissions (JSON endpoint)
   */
  public async update(request: NaraRequest, response: NaraResponse) {
    await this.requirePermission(request, "roles.edit");
    const data = await this.getBody(request, UpdateRoleSchema);
    const id = this.getRequiredParam(request, "id");

    try {
      const existingRole = await Role.findById(id);
      if (!existingRole) {
        return jsonError(response, "Role tidak ditemukan", 404);
      }

      // Check slug uniqueness if slug is being changed
      if (data.slug && data.slug !== existingRole.slug) {
        const slugExists = await Role.findBySlug(data.slug);
        if (slugExists) {
          return jsonError(response, "Slug role sudah digunakan", 400, "DUPLICATE_SLUG");
        }
      }

      const payload: Record<string, unknown> = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.slug !== undefined) payload.slug = data.slug;
      if (data.description !== undefined) payload.description = data.description;

      const role = await Role.update(id, payload);

      // Sync permissions if provided (requires permissions.assign permission)
      if (data.permissions !== undefined) {
        const userId = request.user!.id;
        const isAdmin = await User.isAdmin(userId);
        const canAssign = isAdmin || await User.hasPermission(userId, "permissions.assign");
        if (canAssign) {
          await Role.syncPermissions(id, data.permissions);
        }
      }

      // Get updated permissions for response
      const permissions = await Role.permissions(id);

      Logger.info("Role updated", {
        roleId: id,
        updatedBy: request.user!.id,
        changes: payload,
      });

      return jsonSuccess(response, "Role berhasil diupdate", {
        role: {
          ...role,
          permissions: permissions.map((p) => p.slug),
        },
      });
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return jsonError(response, "Slug role sudah digunakan", 400, "DUPLICATE_SLUG");
      }
      Logger.error("Failed to update role", error as Error);
      return jsonServerError(response, "Gagal mengupdate role");
    }
  }

  /**
   * Delete a role (JSON endpoint)
   */
  public async destroy(request: NaraRequest, response: NaraResponse) {
    await this.requirePermission(request, "roles.delete");
    const id = this.getRequiredParam(request, "id");

    try {
      const role = await Role.findById(id);
      if (!role) {
        return jsonError(response, "Role tidak ditemukan", 404);
      }

      // Prevent deleting the admin role
      if (role.slug === "admin") {
        return jsonError(response, "Role admin tidak bisa dihapus", 400);
      }

      await Role.delete(id);

      Logger.warn("Role deleted", {
        roleId: id,
        roleName: role.name,
        deletedBy: request.user!.id,
      });

      return jsonSuccess(response, "Role berhasil dihapus");
    } catch (error) {
      Logger.error("Failed to delete role", error as Error);
      return jsonServerError(response, "Gagal menghapus role");
    }
  }
}

export default new RoleController();
