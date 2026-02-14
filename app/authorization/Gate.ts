/**
 * Gate - Authorization System
 *
 * Provides a flexible authorization system for defining abilities and policies.
 * Supports both closure-based abilities and class-based policies.
 *
 * @example
 * // Define an ability
 * gate.define('edit-post', async (user, post) => {
 *   return user.id === post.user_id;
 * });
 *
 * // Define multiple abilities
 * gate.define({
 *   'view-posts': async (user) => true,
 *   'create-posts': async (user) => user.is_verified
 * });
 *
 * // Register a policy
 * gate.policy('Post', PostPolicy);
 *
 * // Check authorization
 * if (await gate.allows(user, 'edit-post', post)) {
 *   // User can edit the post
 * }
 *
 * // Authorize (throws if not allowed)
 * await gate.authorize(user, 'edit-post', post);
 */
import type { User } from "@core/types";
import { ForbiddenError } from "@core/errors";
import { Policy } from "./Policy";

/**
 * Callback function for defining abilities
 */
export type AbilityCallback = (user: User, ...args: unknown[]) => boolean | Promise<boolean>;

/**
 * Gate class for managing authorization
 */
class Gate {
  private abilities: Map<string, AbilityCallback> = new Map();
  private policies: Map<string, new () => Policy> = new Map();

  /**
   * Define a single ability
   *
   * @param ability - Name of the ability
   * @param callback - Function that returns boolean or Promise<boolean>
   *
   * @example
   * gate.define('edit-post', async (user, post) => {
   *   return user.id === post.user_id;
   * });
   */
  define(ability: string, callback: AbilityCallback): void;

  /**
   * Define multiple abilities at once
   *
   * @param abilities - Object with ability names as keys and callbacks as values
   *
   * @example
   * gate.define({
   *   'view-posts': async (user) => true,
   *   'create-posts': async (user) => user.is_verified
   * });
   */
  define(abilities: Record<string, AbilityCallback>): void;

  define(
    abilityOrAbilities: string | Record<string, AbilityCallback>,
    callback?: AbilityCallback
  ): void {
    if (typeof abilityOrAbilities === "string") {
      // Single ability definition
      if (!callback) {
        throw new Error("Callback is required when defining a single ability");
      }
      this.abilities.set(abilityOrAbilities, callback);
    } else {
      // Multiple abilities definition
      for (const [ability, cb] of Object.entries(abilityOrAbilities)) {
        this.abilities.set(ability, cb);
      }
    }
  }

  /**
   * Register a policy class for a model
   *
   * @param modelClass - Name of the model (e.g., 'Post', 'User')
   * @param policyClass - Policy class constructor
   *
   * @example
   * gate.policy('Post', PostPolicy);
   */
  policy(modelClass: string, policyClass: new () => Policy): void {
    this.policies.set(modelClass, policyClass);
  }

  /**
   * Check if user has the given ability
   *
   * @param user - User to check
   * @param ability - Name of the ability
   * @param args - Additional arguments to pass to the ability callback
   * @returns true if allowed, false otherwise
   */
  async allows(user: User, ability: string, ...args: unknown[]): Promise<boolean> {
    return this.check(user, ability, ...args);
  }

  /**
   * Check if user does NOT have the given ability
   *
   * @param user - User to check
   * @param ability - Name of the ability
   * @param args - Additional arguments to pass to the ability callback
   * @returns true if denied, false otherwise
   */
  async denies(user: User, ability: string, ...args: unknown[]): Promise<boolean> {
    return !(await this.check(user, ability, ...args));
  }

  /**
   * Check if user has the given ability (alias for allows)
   *
   * @param user - User to check
   * @param ability - Name of the ability
   * @param args - Additional arguments to pass to the ability callback
   * @returns true if allowed, false otherwise
   */
  async check(user: User, ability: string, ...args: unknown[]): Promise<boolean> {
    // First, check for a policy-based ability
    const policyAbility = this.parsePolicyAbility(ability);
    if (policyAbility) {
      return this.checkPolicy(user, policyAbility, ...args);
    }

    // Otherwise, check for a closure-based ability
    const callback = this.abilities.get(ability);
    if (!callback) {
      // If no ability is defined, deny by default
      return false;
    }

    try {
      const result = await callback(user, ...args);
      return result;
    } catch (error) {
      // If the callback throws, deny access
      return false;
    }
  }

  /**
   * Authorize user for the given ability
   *
   * Throws ForbiddenError if not authorized
   *
   * @param user - User to authorize
   * @param ability - Name of the ability
   * @param args - Additional arguments to pass to the ability callback
   * @throws ForbiddenError if not authorized
   *
   * @example
   * await gate.authorize(user, 'edit-post', post);
   * // If not authorized, throws ForbiddenError
   */
  async authorize(user: User, ability: string, ...args: unknown[]): Promise<void> {
    const allowed = await this.check(user, ability, ...args);
    if (!allowed) {
      throw new ForbiddenError(`Unauthorized: ${ability}`);
    }
  }

  /**
   * Parse policy ability string (e.g., "Post:view" -> { model: "Post", ability: "view" })
   */
  private parsePolicyAbility(ability: string): { model: string; ability: string } | null {
    const parts = ability.split(":");
    if (parts.length === 2) {
      return { model: parts[0], ability: parts[1] };
    }
    return null;
  }

  /**
   * Check policy-based ability
   */
  private async checkPolicy(
    user: User,
    policyAbility: { model: string; ability: string },
    ...args: unknown[]
  ): Promise<boolean> {
    const PolicyClass = this.policies.get(policyAbility.model);
    if (!PolicyClass) {
      return false;
    }

    const policy = new PolicyClass();

    // Check before method if exists
    if (policy.before) {
      const beforeResult = await policy.before(user, policyAbility.ability);
      if (beforeResult !== null) {
        return beforeResult;
      }
    }

    // Check the specific ability method
    const methodName = policyAbility.ability as keyof Policy;
    const method = policy[methodName] as
      | ((user: User, ...args: unknown[]) => boolean | Promise<boolean>)
      | undefined;

    if (!method) {
      return false;
    }

    try {
      const result = await method.call(policy, user, ...args);
      return result;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all registered abilities (for debugging)
   */
  getAbilities(): string[] {
    return Array.from(this.abilities.keys());
  }

  /**
   * Get all registered policies (for debugging)
   */
  getPolicies(): string[] {
    return Array.from(this.policies.keys());
  }
}

// Export singleton instance
export const gate = new Gate();
export default gate;

// Export class type for type annotations
export type { Gate };
