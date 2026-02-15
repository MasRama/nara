/**
 * Resource
 *
 * Base abstract class for transforming models to JSON responses.
 * Laravel-like resource classes for consistent API output formatting.
 *
 * @example
 * // Basic usage
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
 * return jsonSuccess(res, 'Users found', UserResource.collection(users));
 */

import { ResourceCollection } from './ResourceCollection';
import type { PaginatedMeta } from '@services/Paginator';

/**
 * Abstract base resource class for transforming data to JSON
 */
export abstract class Resource<T extends object> {
  /** The underlying resource data */
  protected resource: T;

  /** Conditional fields to include when condition is true */
  private conditionalFields: Record<string, unknown>[] = [];

  /** Additional data to merge into the output */
  private additionalData: Record<string, unknown> = {};

  /**
   * Create a new resource instance
   *
   * @param resource - The resource to transform
   */
  constructor(resource: T) {
    this.resource = resource;
  }

  /**
   * Transform the resource to an array.
   * Subclasses must implement this method.
   *
   * @returns Object containing the transformed resource data
   */
  abstract toArray(): Record<string, unknown>;

  /**
   * Transform the resource to JSON output.
   * Merges toArray() result with conditional fields and additional data.
   *
   * @returns Final JSON object for API response
   */
  toJson(): Record<string, unknown> {
    // Handle null/undefined resource gracefully
    if (!this.resource) {
      return {};
    }

    // Start with base transformation
    let output = this.toArray();

    // Merge conditional fields
    for (const fields of this.conditionalFields) {
      output = { ...output, ...fields };
    }

    // Merge additional data
    output = { ...output, ...this.additionalData };

    return output;
  }

  /**
   * Include fields only when condition is true
   *
   * @param condition - Whether to include the fields
   * @param data - Fields to include when condition is true
   * @returns this for method chaining
   *
   * @example
   * resource.when(isAdmin, { email: user.email, phone: user.phone });
   */
  when(condition: boolean, data: Record<string, unknown>): this {
    if (condition) {
      this.conditionalFields.push(data);
    }
    return this;
  }

  /**
   * Include fields only when condition is false (inverse of when)
   *
   * @param condition - When false, fields will be included
   * @param data - Fields to include when condition is false
   * @returns this for method chaining
   *
   * @example
   * resource.unless(isPublic, { internal_notes: user.notes });
   */
  unless(condition: boolean, data: Record<string, unknown>): this {
    if (!condition) {
      this.conditionalFields.push(data);
    }
    return this;
  }

  /**
   * Add extra fields to the resource output
   *
   * @param key - Field name or object of key-value pairs
   * @param value - Field value (if key is a string)
   * @returns this for method chaining
   *
   * @example
   * // Single field
   * resource.with('meta', { timestamp: Date.now() });
   *
   * @example
   * // Multiple fields
   * resource.with({ meta: {...}, links: {...} });
   */
  with(key: string, value: unknown): this;
  with(data: Record<string, unknown>): this;
  with(keyOrData: string | Record<string, unknown>, value?: unknown): this {
    if (typeof keyOrData === 'string') {
      this.additionalData[keyOrData] = value;
    } else {
      this.additionalData = { ...this.additionalData, ...keyOrData };
    }
    return this;
  }

  /**
   * Create a resource collection from an array of resources
   *
   * @param resources - Array of resources to transform
   * @param meta - Optional pagination metadata
   * @returns ResourceCollection instance
   *
   * @example
   * const collection = UserResource.collection(users);
   * return jsonSuccess(res, 'Users found', collection.toArray());
   *
   * @example
   * // With pagination
   * const collection = UserResource.collection(users, paginationMeta);
   * return jsonPaginated(res, 'Users found', collection.toArray(), meta);
   */
  static collection<R extends object>(resources: R[], meta?: PaginatedMeta): ResourceCollection<R> {
    return new ResourceCollection<R>(resources, meta);
  }

  /**
   * Create a single resource instance (convenience method)
   *
   * @param resource - The resource to transform
   * @returns New resource instance
   *
   * @example
   * const json = UserResource.make(user).toJson();
   */
  static make<R extends object>(
    this: new (resource: R) => Resource<R>,
    resource: R
  ): Resource<R> {
    return new this(resource);
  }
}

export default Resource;
