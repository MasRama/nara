/**
 * UserController
 * 
 * Handles user management operations:
 * - User listing with search/filter/pagination (admin)
 * - User CRUD operations (admin)
 * - Profile management (authenticated user)
 */
import Authenticate from "@services/Authenticate";
import { User } from "@models";
import { paginate, parsePaginationQuery } from "@services/Paginator";
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
import {
  ChangeProfileSchema,
} from "@validators";
import { CreateUserRequest, UpdateUserRequest, DeleteUsersRequest } from "@requests";
import { event } from "@helpers/events";
import { UserCreated, UserUpdated, UsersDeleted } from "@events/examples";
import { UserResource, userCollection } from "@/http/resources/UserResource";
import { ResourceCollection } from "@core";

/**
 * Query parameters for user listing
 */
interface UserQueryParams {
  page: number;
  limit: number;
  search: string;
  filter: string;
}

class UserController extends BaseController {
  /**
   * Parse and return user query parameters
   * Shared logic for homePage and usersPage
   */
  private parseUserQueryParams(request: NaraRequest): UserQueryParams {
    const { page, limit } = parsePaginationQuery(request.query);
    const search = request.query.search as string || "";
    const filter = request.query.filter as string || "all";
    return { page, limit, search, filter };
  }

  /**
   * Build user query with search and filter
   * Shared logic for homePage and usersPage
   */
  private buildUserQuery(params: UserQueryParams) {
    return User.buildSearchQuery(params.search, params.filter as 'all' | 'verified' | 'unverified');
  }

  /**
   * Dashboard page with user listing
   */
  public async homePage(request: NaraRequest, response: NaraResponse) {
    const params = this.parseUserQueryParams(request);
    const query = this.buildUserQuery(params);
    const result = await paginate(query, { page: params.page, limit: params.limit });

    // Get current user for admin check
    const isAdmin = request.user ? await User.isAdmin(request.user.id) : false;

    // Attach roles to each user using UserResource
    const usersWithRoles = await Promise.all(
      result.data.map(async (user: unknown) => {
        const userRecord = user as { id: string };
        const roles = await User.roles(userRecord.id);
        const resource = new UserResource(userRecord as { id: string; name: string | null; email: string; phone: string | null; avatar: string | null; is_verified: boolean; membership_date: string | null; password: string; remember_me_token: string | null; created_at: number; updated_at: number; })
          .withEmail(isAdmin)
          .withRoles(roles);
        return {
          ...resource.toJson(),
          roles: roles.map((r) => r.slug),
        };
      })
    );

    this.requireInertia(response);
    return response.inertia("dashboard", {
      users: usersWithRoles,
      ...result.meta,
      search: params.search,
      filter: params.filter
    });
  }

  /**
   * Users management page
   */
  public async usersPage(request: NaraRequest, response: NaraResponse) {
    const params = this.parseUserQueryParams(request);
    const query = this.buildUserQuery(params);
    const result = await paginate(query, { page: params.page, limit: params.limit });

    // Get current user for admin check
    const isAdmin = request.user ? await User.isAdmin(request.user.id) : false;

    // Attach roles to each user using UserResource
    const usersWithRoles = await Promise.all(
      result.data.map(async (user: unknown) => {
        const userRecord = user as { id: string; name: string | null; email: string; phone: string | null; avatar: string | null; is_verified: boolean; membership_date: string | null; password: string; remember_me_token: string | null; created_at: number; updated_at: number; };
        const roles = await User.roles(userRecord.id);
        const resource = new UserResource(userRecord)
          .withEmail(isAdmin)
          .withPhone(isAdmin)
          .withRoles(roles);
        return {
          ...resource.toJson(),
          roles: roles.map((r) => r.slug),
        };
      })
    );

    this.requireInertia(response);
    return response.inertia("users", {
      users: usersWithRoles,
      ...result.meta,
      search: params.search,
      filter: params.filter,
    });
  }

  /**
   * Create a new user (admin only)
   */
  public async createUser(request: NaraRequest, response: NaraResponse) {
    const req = await CreateUserRequest.from(request);
    const data = req.validated();

    try {
      const user = await User.create({
        id: randomUUID(),
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        is_verified: data.is_verified,
        password: await Authenticate.hash(data.password || data.email),
      });

      // Assign roles if provided
      if (data.roles && data.roles.length > 0) {
        for (const roleSlug of data.roles) {
          await User.assignRole(user.id, roleSlug);
        }
      }

      // Get roles for the response
      const roles = await User.roles(user.id);

      // Dispatch user created event
      await event(new UserCreated({
        user,
        createdBy: request.user!.id
      }));

      // Wrap user with UserResource to hide password and format response
      const userResource = new UserResource(user)
        .withEmail(true) // Admin created, so include email
        .withRoles(roles);

      return jsonCreated(response, "User created", { user: userResource.toJson() });
    } catch (error: any) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return jsonError(response, "Email sudah digunakan", 400, "DUPLICATE_EMAIL");
      }
      Logger.error('Failed to create user', error);
      return jsonServerError(response, "Gagal membuat user");
    }
  }

  /**
   * Update an existing user (admin only)
   */
  public async updateUser(request: NaraRequest, response: NaraResponse) {
    const req = await UpdateUserRequest.from(request);
    const data = req.validated();
    const id = this.getRequiredParam(request, 'id');

    const payload: Record<string, unknown> = {};

    if (data.name !== undefined) payload.name = data.name;
    if (data.email !== undefined) payload.email = data.email;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.is_verified !== undefined) payload.is_verified = data.is_verified;
    if (data.password) payload.password = await Authenticate.hash(data.password);

    try {
      const user = await User.update(id, payload);

      // Sync roles if provided
      if (data.roles !== undefined) {
        await User.syncRoles(id, data.roles);
      }

      // Get updated roles for the response
      const roles = await User.roles(id);

      // Dispatch user updated event
      await event(new UserUpdated({
        user: user as unknown as { id: string; name: string | null; email: string; phone: string | null; avatar: string | null; is_verified: boolean; },
        updatedBy: request.user!.id,
        changes: payload as Partial<{ id: string; name: string | null; email: string; phone: string | null; avatar: string | null; is_verified: boolean; }>
      }));

      // Wrap user with UserResource to hide password and format response
      const userResource = new UserResource(user as { id: string; name: string | null; email: string; phone: string | null; avatar: string | null; is_verified: boolean; membership_date: string | null; password: string; remember_me_token: string | null; created_at: number; updated_at: number; })
        .withEmail(true) // Admin updated, so include email
        .withPhone(true) // Admin updated, so include phone
        .withRoles(roles);

      return jsonSuccess(response, "User berhasil diupdate", { user: userResource.toJson() });
    } catch (error: any) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return jsonError(response, "Email sudah digunakan", 400, "DUPLICATE_EMAIL");
      }
      Logger.error('Failed to update user', error);
      return jsonServerError(response, "Gagal mengupdate user");
    }
  }

  /**
   * Delete multiple users (admin only)
   */
  public async deleteUsers(request: NaraRequest, response: NaraResponse) {
    const req = await DeleteUsersRequest.from(request);
    const data = req.validated();

    const deleted = await User.deleteMany(data.ids);

    Logger.warn('Users deleted by admin', {
      adminId: request.user!.id,
      deletedIds: data.ids,
      count: deleted,
      ip: request.ip
    });

    // Dispatch users deleted event
    await event(new UsersDeleted({
      ids: data.ids,
      deletedBy: request.user!.id,
      count: deleted
    }));

    return jsonSuccess(response, "Users berhasil dihapus", { deleted });
  }

  /**
   * Profile page
   */
  public async profilePage(request: NaraRequest, response: NaraResponse) {
    this.requireInertia(response);
    return response.inertia("profile");
  }

  /**
   * Update current user's profile
   */
  public async changeProfile(request: NaraRequest, response: NaraResponse) {
    this.requireAuth(request);
    const data = await this.getBody(request, ChangeProfileSchema);

    await User.update(request.user.id, {
      name: data.name,
      email: data.email,
      phone: data.phone,
    });

    return jsonSuccess(response, "Profil berhasil diupdate");
  }
}

export default new UserController();
