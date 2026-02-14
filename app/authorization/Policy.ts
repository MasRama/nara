/**
 * Policy - Base class for authorization policies
 *
 * Policies encapsulate authorization logic for specific models.
 * Extend this class to create custom policies.
 *
 * @example
 * class PostPolicy extends Policy {
 *   async before(user: User, ability: string): Promise<boolean | null> {
 *     // Allow admins to do everything
 *     if (await user.isAdmin()) {
 *       return true;
 *     }
 *     return null; // Continue to specific ability check
 *   }
 *
 *   async view(user: User, post: Post): Promise<boolean> {
 *     return true; // Anyone can view posts
 *   }
 *
 *   async create(user: User): Promise<boolean> {
 *     return user.is_verified;
 *   }
 *
 *   async update(user: User, post: Post): Promise<boolean> {
 *     return user.id === post.user_id;
 *   }
 *
 *   async delete(user: User, post: Post): Promise<boolean> {
 *     return user.id === post.user_id;
 *   }
 * }
 *
 * // Register the policy
 * gate.policy('Post', PostPolicy);
 *
 * // Use the policy
 * await gate.authorize(user, 'Post:update', post);
 */
import type { User } from "@core/types";

/**
 * Abstract base class for authorization policies
 */
export abstract class Policy {
  /**
   * Before hook - runs before any ability check
   *
   * Use this to handle special cases like admin users
   * who should have all permissions.
   *
   * @param user - User being authorized
   * @param ability - Ability being checked
   * @returns boolean to allow/deny, or null to continue to specific ability check
   *
   * @example
   * async before(user: User, ability: string): Promise<boolean | null> {
   *   // Allow admins to do everything
   *   if (await user.isAdmin()) {
   *     return true;
   *   }
   *   return null; // Continue to specific ability check
   * }
   */
  before?(user: User, ability: string): boolean | null | Promise<boolean | null>;

  /**
   * View ability - view a single resource
   *
   * @param user - User being authorized
   * @param resource - Resource being accessed
   * @returns boolean or Promise<boolean>
   */
  view?(user: User, resource: unknown): boolean | Promise<boolean>;

  /**
   * Create ability - create a new resource
   *
   * @param user - User being authorized
   * @returns boolean or Promise<boolean>
   */
  create?(user: User): boolean | Promise<boolean>;

  /**
   * Update ability - update an existing resource
   *
   * @param user - User being authorized
   * @param resource - Resource being updated
   * @returns boolean or Promise<boolean>
   */
  update?(user: User, resource: unknown): boolean | Promise<boolean>;

  /**
   * Delete ability - delete a resource
   *
   * @param user - User being authorized
   * @param resource - Resource being deleted
   * @returns boolean or Promise<boolean>
   */
  delete?(user: User, resource: unknown): boolean | Promise<boolean>;

  /**
   * List/Index ability - view a list of resources
   *
   * @param user - User being authorized
   * @returns boolean or Promise<boolean>
   */
  list?(user: User): boolean | Promise<boolean>;
}

export default Policy;
