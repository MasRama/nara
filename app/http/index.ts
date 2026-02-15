/**
 * HTTP Resources
 *
 * Laravel-like resource classes for transforming models to JSON responses.
 * Provides a clean, fluent API for API resource transformation with support
 * for conditional fields, relationships, and pagination.
 *
 * @example
 * // Single resource
 * return jsonSuccess(res, 'User found', new UserResource(user).toJson());
 *
 * @example
 * // With conditional fields
 * const resource = new UserResource(user)
 *   .when(isAdmin, { email: user.email })
 *   .with('meta', { timestamp: Date.now() });
 * return jsonSuccess(res, 'User found', resource.toJson());
 *
 * @example
 * // Collection
 * const collection = ResourceCollection.of(UserResource, users, meta);
 * return jsonPaginated(res, 'Users found', collection.toArray(), meta);
 */

// Resource Classes
export { Resource } from './Resource';
export { ResourceCollection } from './ResourceCollection';

// Re-export types for convenience
export type { PaginatedMeta } from '@services/Paginator';
