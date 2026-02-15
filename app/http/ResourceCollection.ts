/**
 * ResourceCollection
 *
 * Handles transformation of multiple resources with optional pagination metadata.
 * Works in conjunction with Resource classes for consistent API list responses.
 *
 * @example
 * // Basic usage
 * const collection = new ResourceCollection(users);
 * return jsonSuccess(res, 'Users found', collection.toArray());
 *
 * @example
 * // With pagination metadata
 * const collection = new ResourceCollection(users, {
 *   total: 100,
 *   page: 1,
 *   limit: 10,
 *   totalPages: 10,
 *   hasNext: true,
 *   hasPrev: false
 * });
 * return jsonPaginated(res, 'Users found', collection.toArray(), meta);
 *
 * @example
 * // Using Resource.collection() static method
 * const collection = UserResource.collection(users, meta);
 * return jsonSuccess(res, 'Users found', collection.toArray());
 */

import type { PaginatedMeta } from '@services/Paginator';
import type { Resource } from './Resource';

/**
 * Type for a Resource class constructor
 */
type ResourceConstructor<R extends object> = new (resource: R) => Resource<R>;

/**
 * Collection of resources for batch transformation
 */
export class ResourceCollection<R extends object> {
  /** Array of resources to transform */
  private resources: R[];

  /** Optional pagination metadata */
  private meta?: PaginatedMeta;

  /** Optional resource class to use for transformation */
  private resourceClass?: ResourceConstructor<R>;

  /**
   * Create a new resource collection
   *
   * @param resources - Array of resources to transform
   * @param meta - Optional pagination metadata
   */
  constructor(resources: R[], meta?: PaginatedMeta) {
    this.resources = resources ?? [];
    this.meta = meta;
  }

  /**
   * Set the resource class to use for transformation.
   * When set, each item will be transformed using an instance of this class.
   *
   * @param resourceClass - Resource class constructor
   * @returns this for method chaining
   *
   * @example
   * const collection = new ResourceCollection(users, meta)
   *   .using(UserResource);
   * return jsonSuccess(res, 'Users found', collection.toArray());
   */
  using(resourceClass: ResourceConstructor<R>): this {
    this.resourceClass = resourceClass;
    return this;
  }

  /**
   * Transform all resources in the collection.
   * If a resource class is set via using(), each item will be transformed
   * through that class. Otherwise, items are returned as-is.
   *
   * @returns Array of transformed resources
   */
  toArray(): Record<string, unknown>[] {
    if (!this.resources || this.resources.length === 0) {
      return [];
    }

    return this.resources.map((resource) => {
      // If we have a resource class, use it for transformation
      if (this.resourceClass) {
        const instance = new this.resourceClass(resource);
        return instance.toJson();
      }

      // Otherwise, return the resource as-is (assuming it's already an object)
      return resource as Record<string, unknown>;
    });
  }

  /**
   * Get the pagination metadata
   *
   * @returns Pagination metadata or undefined
   */
  getMeta(): PaginatedMeta | undefined {
    return this.meta;
  }

  /**
   * Get the raw resources array
   *
   * @returns Original resources array
   */
  getResources(): R[] {
    return this.resources;
  }

  /**
   * Check if collection is empty
   *
   * @returns True if no resources
   */
  isEmpty(): boolean {
    return this.resources.length === 0;
  }

  /**
   * Get the number of resources in the collection
   *
   * @returns Resource count
   */
  count(): number {
    return this.resources.length;
  }

  /**
   * Create a collection with a resource class for transformation.
   * Convenience static method for fluent API.
   *
   * @param resourceClass - Resource class to use for transformation
   * @param resources - Array of resources
   * @param meta - Optional pagination metadata
   * @returns ResourceCollection instance configured with the resource class
   *
   * @example
   * const collection = ResourceCollection.of(UserResource, users, meta);
   * return jsonSuccess(res, 'Users found', collection.toArray());
   */
  static of<R extends object>(
    resourceClass: ResourceConstructor<R>,
    resources: R[],
    meta?: PaginatedMeta
  ): ResourceCollection<R> {
    return new ResourceCollection<R>(resources, meta).using(resourceClass);
  }
}

export default ResourceCollection;
