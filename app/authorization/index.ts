/**
 * Authorization Module
 *
 * Central export point for all authorization-related classes and utilities.
 *
 * @example
 * import { gate, Policy, authorize } from '@authorization';
 *
 * // Define abilities
 * gate.define('edit-post', async (user, post) => {
 *   return user.id === post.user_id;
 * });
 *
 * // Create a policy
 * class PostPolicy extends Policy {
 *   async update(user, post) {
 *     return user.id === post.user_id;
 *   }
 * }
 *
 * // Use authorization helpers
 * await authorize(req.user, 'edit-post', post);
 */

// Core classes
export { gate, AbilityCallback } from "./Gate";
export type { Gate } from "./Gate";
export { Policy } from "./Policy";

// Helper functions
export { can, cannot, authorize } from "@helpers/authorization";
