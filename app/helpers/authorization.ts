/**
 * Authorization Helpers
 *
 * Convenient helper functions for checking authorization throughout the application.
 *
 * @example
 * import { can, cannot, authorize } from '@helpers/authorization';
 *
 * // Check if user can do something
 * if (await can(user, 'edit-post', post)) {
 *   // Show edit button
 * }
 *
 * // Check if user cannot do something
 * if (await cannot(user, 'delete-post', post)) {
 *   // Hide delete button
 * }
 *
 * // Authorize or throw
 * await authorize(user, 'update-post', post);
 * // If not authorized, throws ForbiddenError
 */
import { gate } from "@authorization";
import type { User } from "@core/types";
import { ForbiddenError } from "@core/errors";

/**
 * Check if a user has a specific ability
 *
 * @param user - User to check (null returns false)
 * @param ability - Name of the ability
 * @param args - Additional arguments to pass to the ability callback
 * @returns true if user has the ability, false otherwise
 *
 * @example
 * if (await can(user, 'edit-post', post)) {
 *   // User can edit the post
 * }
 */
export async function can(
  user: User | null | undefined,
  ability: string,
  ...args: unknown[]
): Promise<boolean> {
  if (!user) return false;
  return gate.check(user, ability, ...args);
}

/**
 * Check if a user does NOT have a specific ability
 *
 * @param user - User to check (null returns true)
 * @param ability - Name of the ability
 * @param args - Additional arguments to pass to the ability callback
 * @returns true if user does NOT have the ability, false otherwise
 *
 * @example
 * if (await cannot(user, 'delete-post', post)) {
 *   // Hide delete button
 * }
 */
export async function cannot(
  user: User | null | undefined,
  ability: string,
  ...args: unknown[]
): Promise<boolean> {
  return !(await can(user, ability, ...args));
}

/**
 * Authorize a user for a specific ability
 *
 * Throws ForbiddenError if user is null or does not have the ability
 *
 * @param user - User to authorize (null throws ForbiddenError)
 * @param ability - Name of the ability
 * @param args - Additional arguments to pass to the ability callback
 * @throws ForbiddenError if user is null or not authorized
 *
 * @example
 * try {
 *   await authorize(user, 'update-post', post);
 *   // User is authorized, proceed with update
 * } catch (error) {
 *   // Handle authorization error
 * }
 */
export async function authorize(
  user: User | null | undefined,
  ability: string,
  ...args: unknown[]
): Promise<void> {
  if (!user) {
    throw new ForbiddenError("Unauthorized");
  }
  await gate.authorize(user, ability, ...args);
}

/**
 * Authorize a user and return the user if authorized
 *
 * Useful for type narrowing when you need the user object after authorization
 *
 * @param user - User to authorize (null throws ForbiddenError)
 * @param ability - Name of the ability
 * @param args - Additional arguments to pass to the ability callback
 * @returns The user object if authorized
 * @throws ForbiddenError if user is null or not authorized
 *
 * @example
 * const authorizedUser = await authorizeAndReturn(req.user, 'admin-only');
 * // authorizedUser is guaranteed to be User (not null)
 */
export async function authorizeAndReturn(
  user: User | null | undefined,
  ability: string,
  ...args: unknown[]
): Promise<User> {
  if (!user) {
    throw new ForbiddenError("Unauthorized");
  }
  await gate.authorize(user, ability, ...args);
  return user;
}
