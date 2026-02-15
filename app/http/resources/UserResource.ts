/**
 * UserResource
 *
 * Transforms UserRecord to JSON API response format.
 * Demonstrates conditional field inclusion and relationship embedding.
 *
 * @example
 * // Basic usage
 * return jsonSuccess(res, 'User found', new UserResource(user).toJson());
 *
 * @example
 * // With admin-only fields
 * const isAdmin = await User.isAdmin(currentUser.id);
 * const resource = new UserResource(user)
 *   .when(isAdmin, { email: user.email });
 * return jsonSuccess(res, 'User found', resource.toJson());
 *
 * @example
 * // With relationships
 * const resource = new UserResource(user)
 *   .when(includeProfile, { profile: userProfile })
 *   .when(includeRoles, { roles: userRoles });
 * return jsonSuccess(res, 'User found', resource.toJson());
 *
 * @example
 * // Collection
 * const users = await User.all();
 * const collection = ResourceCollection.of(UserResource, users);
 * return jsonSuccess(res, 'Users found', collection.toArray());
 *
 * @example
 * // With pagination
 * const result = await paginate<UserRecord>(query, { page, limit });
 * const collection = ResourceCollection.of(UserResource, result.data, result.meta);
 * return jsonPaginated(res, 'Users found', collection.toArray(), result.meta);
 */

import { Resource } from '../Resource';
import { ResourceCollection } from '../ResourceCollection';
import type { UserRecord } from '@models';
import type { PaginatedMeta } from '@services/Paginator';

/**
 * Profile data structure (example relationship)
 */
interface UserProfile {
  id: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatar_url: string | null;
}

/**
 * Role data structure (from RBAC)
 */
interface UserRole {
  id: string;
  name: string;
  slug: string;
}

/**
 * Resource class for transforming UserRecord to JSON
 */
export class UserResource extends Resource<UserRecord> {
  /**
   * Transform the user resource to an array
   *
   * @returns Object containing the transformed user data
   */
  toArray(): Record<string, unknown> {
    const user = this.resource;

    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      is_verified: user.is_verified,
      membership_date: user.membership_date,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  /**
   * Include email field (typically for admin only)
   *
   * @param isAdmin - Whether the requesting user is an admin
   * @returns this for method chaining
   *
   * @example
   * const resource = new UserResource(user).withEmail(isAdmin);
   */
  withEmail(isAdmin: boolean): this {
    return this.when(isAdmin, {
      email: this.resource.email,
    });
  }

  /**
   * Include phone field (typically for admin or owner only)
   *
   * @param condition - Whether to include the phone
   * @returns this for method chaining
   *
   * @example
   * const resource = new UserResource(user).withPhone(isAdmin || isOwner);
   */
  withPhone(condition: boolean): this {
    return this.when(condition, {
      phone: this.resource.phone,
    });
  }

  /**
   * Include profile relationship
   *
   * @param profile - User profile data
   * @returns this for method chaining
   *
   * @example
   * const profile = await Profile.findByUserId(user.id);
   * const resource = new UserResource(user).withProfile(profile);
   */
  withProfile(profile: UserProfile | null): this {
    if (profile) {
      return this.with('profile', {
        id: profile.id,
        bio: profile.bio,
        location: profile.location,
        website: profile.website,
        avatar_url: profile.avatar_url,
      });
    }
    return this;
  }

  /**
   * Include roles relationship
   *
   * @param roles - Array of user roles
   * @returns this for method chaining
   *
   * @example
   * const roles = await User.roles(user.id);
   * const resource = new UserResource(user).withRoles(roles);
   */
  withRoles(roles: UserRole[]): this {
    if (roles && roles.length > 0) {
      return this.with('roles', roles.map(role => ({
        id: role.id,
        name: role.name,
        slug: role.slug,
      })));
    }
    return this;
  }

  /**
   * Include permissions (flattened from roles)
   *
   * @param permissions - Array of user permissions
   * @returns this for method chaining
   *
   * @example
   * const permissions = await User.permissions(user.id);
   * const resource = new UserResource(user).withPermissions(permissions);
   */
  withPermissions(permissions: { id: string; slug: string; name: string }[]): this {
    if (permissions && permissions.length > 0) {
      return this.with('permissions', permissions.map(p => p.slug));
    }
    return this;
  }

}

/**
 * Create a collection of user resources
 *
 * @param users - Array of user records
 * @param meta - Optional pagination metadata
 * @returns ResourceCollection instance
 *
 * @example
 * const users = await User.all();
 * return jsonSuccess(res, 'Users found', userCollection(users).toArray());
 *
 * @example
 * // With pagination
 * const result = await paginate<UserRecord>(query, { page, limit });
 * const collection = userCollection(result.data, result.meta);
 * return jsonPaginated(res, 'Users found', collection.toArray(), result.meta);
 */
export function userCollection(users: UserRecord[], meta?: PaginatedMeta): ResourceCollection<UserRecord> {
  return ResourceCollection.of(UserResource, users, meta);
}

export default UserResource;
