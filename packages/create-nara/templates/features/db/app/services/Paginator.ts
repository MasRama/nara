/**
 * Paginator Service
 * 
 * Standardized pagination helper for Knex queries.
 * Eliminates code duplication and ensures consistent pagination across all endpoints.
 * 
 * @example
 * // Basic usage
 * const query = DB.from('users').select('*').where('is_active', true);
 * const result = await paginate<User>(query, { page: 1, limit: 10 });
 * 
 * // With search and filters applied before pagination
 * let query = DB.from('products').select('*');
 * if (search) query = query.where('name', 'like', `%${search}%`);
 * const result = await paginate<Product>(query, { page, limit });
 * 
 * // Use with jsonPaginated response helper
 * return jsonPaginated(res, 'Users retrieved', result.data, result.meta);
 */

import { Knex } from 'knex';
import { PAGINATION } from '@config';

/**
 * Extended pagination metadata with navigation helpers
 */
export interface PaginatedMeta {
  /** Total number of records matching the query */
  total: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Number of records per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNext: boolean;
  /** Whether there is a previous page */
  hasPrev: boolean;
}

/**
 * Paginated result containing data and metadata
 */
export interface PaginatedResult<T> {
  /** Array of records for the current page */
  data: T[];
  /** Pagination metadata */
  meta: PaginatedMeta;
}

/**
 * Options for pagination
 */
export interface PaginateOptions {
  /** Page number (1-indexed). Defaults to PAGINATION.DEFAULT_PAGE (1) */
  page?: number;
  /** Number of records per page. Defaults to PAGINATION.DEFAULT_PAGE_SIZE (10) */
  limit?: number;
}

/**
 * Paginate a Knex query builder
 * 
 * Takes a query builder and applies pagination, returning both the data
 * and comprehensive pagination metadata.
 * 
 * @param query - Knex query builder (will be cloned for counting)
 * @param options - Pagination options (page, limit)
 * @returns Promise with paginated data and metadata
 */
export async function paginate<T = unknown>(
  query: Knex.QueryBuilder,
  options: PaginateOptions = {}
): Promise<PaginatedResult<T>> {
  // Normalize and validate options
  const page = Math.max(1, options.page ?? PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    Math.max(1, options.limit ?? PAGINATION.DEFAULT_PAGE_SIZE),
    PAGINATION.MAX_PAGE_SIZE
  );

  // Clone query for counting (before applying limit/offset)
  const countQuery = query.clone();
  
  // Get total count
  const countResult = await countQuery.count('* as count').first();
  const total = Number((countResult as Record<string, unknown>)?.count) || 0;

  // Calculate pagination values
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;

  // Get paginated data
  const data = await query.limit(limit).offset(offset) as T[];

  // Build metadata
  const meta: PaginatedMeta = {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };

  return { data, meta };
}

/**
 * Parse pagination options from request query parameters
 * 
 * Convenience function to extract and validate pagination params from request.
 * 
 * @param query - Request query object (e.g., request.query)
 * @returns Validated pagination options
 */
export function parsePaginationQuery(
  query: Record<string, unknown>
): Required<PaginateOptions> {
  const page = Math.max(1, parseInt(String(query.page)) || PAGINATION.DEFAULT_PAGE);
  const limit = Math.min(
    Math.max(1, parseInt(String(query.limit)) || PAGINATION.DEFAULT_PAGE_SIZE),
    PAGINATION.MAX_PAGE_SIZE
  );

  return { page, limit };
}

export default { paginate, parsePaginationQuery };
