/**
 * Nara Core Response Helpers
 * 
 * Standardized JSON API response helpers for consistent API responses.
 * All API endpoints should use these helpers to ensure uniform response format.
 * 
 * Response Format:
 * - Success: { success: true, message, data?, meta? }
 * - Error: { success: false, message, code?, errors? }
 * 
 * @example
 * // Success response
 * return jsonSuccess(res, 'User created successfully', { user }, undefined, 201);
 * 
 * // Error response
 * return jsonError(res, 'Validation failed', 422, 'VALIDATION_ERROR', { email: ['Invalid email'] });
 * 
 * // Paginated response
 * return jsonPaginated(res, 'Users retrieved', users, { total: 100, page: 1, limit: 10 });
 */

import type { NaraResponse } from './types';

import { PaginatedMeta } from '@services/Paginator';

/**
 * Pagination metadata for list responses
 * Re-exported from Paginator for consistency
 */
export type PaginationMeta = PaginatedMeta;
export type { PaginatedMeta };

/**
 * Generic metadata type
 */
export type ResponseMeta = PaginationMeta | Record<string, unknown>;

/**
 * Success response structure
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
  meta?: ResponseMeta;
}

/**
 * Error response structure
 */
export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
  errors?: Record<string, string[]>;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Send a success JSON response
 * 
 * @param res - Response object
 * @param message - Success message
 * @param data - Optional response data
 * @param meta - Optional metadata (pagination, etc.)
 * @param statusCode - HTTP status code (default: 200)
 * @returns Response for chaining
 * 
 * @example
 * // Simple success
 * return jsonSuccess(res, 'Operation successful');
 * 
 * // With data
 * return jsonSuccess(res, 'User found', { user });
 * 
 * // With data and meta
 * return jsonSuccess(res, 'Users retrieved', users, { total: 100, page: 1 });
 * 
 * // Created (201)
 * return jsonSuccess(res, 'User created', { user }, undefined, 201);
 */
export function jsonSuccess<T = unknown>(
  res: NaraResponse,
  message: string,
  data?: T,
  meta?: ResponseMeta,
  statusCode: number = 200
): NaraResponse {
  const response: ApiSuccessResponse<T> = {
    success: true,
    message,
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (meta !== undefined) {
    response.meta = meta;
  }

  res.status(statusCode).json(response);
  return res;
}

/**
 * Send an error JSON response
 * 
 * @param res - Response object
 * @param message - Error message
 * @param statusCode - HTTP status code (default: 400)
 * @param code - Optional error code for programmatic handling
 * @param errors - Optional field-level errors (for validation)
 * @returns Response for chaining
 * 
 * @example
 * // Simple error
 * return jsonError(res, 'Something went wrong', 500);
 * 
 * // With error code
 * return jsonError(res, 'User not found', 404, 'NOT_FOUND');
 * 
 * // Validation error with field errors
 * return jsonError(res, 'Validation failed', 422, 'VALIDATION_ERROR', {
 *   email: ['Email is required', 'Invalid email format'],
 *   password: ['Password must be at least 8 characters']
 * });
 */
export function jsonError(
  res: NaraResponse,
  message: string,
  statusCode: number = 400,
  code?: string,
  errors?: Record<string, string[]>
): NaraResponse {
  const response: ApiErrorResponse = {
    success: false,
    message,
  };

  if (code !== undefined) {
    response.code = code;
  }

  if (errors !== undefined) {
    response.errors = errors;
  }

  res.status(statusCode).json(response);
  return res;
}

/**
 * Send a paginated success response
 * 
 * Convenience wrapper for jsonSuccess with pagination metadata.
 * Automatically calculates totalPages if not provided.
 * 
 * @param res - Response object
 * @param message - Success message
 * @param data - Array of items
 * @param meta - Pagination metadata (total, page, limit)
 * @returns Response for chaining
 * 
 * @example
 * const users = await DB.from('users').limit(10).offset(0);
 * const total = await DB.from('users').count('* as count').first();
 * 
 * return jsonPaginated(res, 'Users retrieved', users, {
 *   total: Number(total?.count) || 0,
 *   page: 1,
 *   limit: 10
 * });
 */
export function jsonPaginated<T = unknown>(
  res: NaraResponse,
  message: string,
  data: T[],
  meta: PaginatedMeta
): NaraResponse {
  // PaginatedMeta from Paginator already has all required fields
  const paginationMeta: PaginatedMeta = {
    ...meta,
    totalPages: meta.totalPages ?? Math.ceil(meta.total / meta.limit),
  };

  return jsonSuccess(res, message, data, paginationMeta);
}

/**
 * Send a 201 Created response
 * 
 * Convenience wrapper for resource creation responses.
 * 
 * @example
 * return jsonCreated(res, 'User created successfully', { user });
 */
export function jsonCreated<T = unknown>(
  res: NaraResponse,
  message: string,
  data?: T
): NaraResponse {
  return jsonSuccess(res, message, data, undefined, 201);
}

/**
 * Send a 204 No Content response
 * 
 * Used for successful operations that don't return data (e.g., DELETE).
 * Note: 204 responses should not have a body, but we send minimal JSON
 * for consistency with our API format.
 * 
 * @example
 * return jsonNoContent(res);
 */
export function jsonNoContent(res: NaraResponse): NaraResponse {
  res.status(204).send('');
  return res;
}

/**
 * Send a 401 Unauthorized response
 * 
 * @example
 * return jsonUnauthorized(res, 'Invalid credentials');
 */
export function jsonUnauthorized(
  res: NaraResponse,
  message: string = 'Unauthorized'
): NaraResponse {
  return jsonError(res, message, 401, 'UNAUTHORIZED');
}

/**
 * Send a 403 Forbidden response
 * 
 * @example
 * return jsonForbidden(res, 'Admin access required');
 */
export function jsonForbidden(
  res: NaraResponse,
  message: string = 'Forbidden'
): NaraResponse {
  return jsonError(res, message, 403, 'FORBIDDEN');
}

/**
 * Send a 404 Not Found response
 * 
 * @example
 * return jsonNotFound(res, 'User not found');
 */
export function jsonNotFound(
  res: NaraResponse,
  message: string = 'Not Found'
): NaraResponse {
  return jsonError(res, message, 404, 'NOT_FOUND');
}

/**
 * Send a 422 Validation Error response
 * 
 * @example
 * return jsonValidationError(res, 'Validation failed', {
 *   email: ['Email is required'],
 *   password: ['Password too short']
 * });
 */
export function jsonValidationError(
  res: NaraResponse,
  message: string = 'Validation failed',
  errors?: Record<string, string[]>
): NaraResponse {
  return jsonError(res, message, 422, 'VALIDATION_ERROR', errors);
}

/**
 * Send a 500 Internal Server Error response
 * 
 * @example
 * return jsonServerError(res, 'Database connection failed');
 */
export function jsonServerError(
  res: NaraResponse,
  message: string = 'Internal Server Error'
): NaraResponse {
  return jsonError(res, message, 500, 'INTERNAL_ERROR');
}
