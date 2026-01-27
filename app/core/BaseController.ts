/**
 * Base Controller
 * 
 * Abstract base class for all controllers providing common utilities:
 * - Authentication guards (requireAuth, requireAdmin)
 * - Request body validation (getBody)
 * - Pagination helpers (getPaginationParams)
 * 
 * @example
 * import { BaseController } from '@core';
 * import { CreatePostSchema } from '@validators';
 * 
 * class PostController extends BaseController {
 *   async create(req: NaraRequest, res: NaraResponse) {
 *     this.requireAuth(req);
 *     const data = await this.getBody(req, CreatePostSchema);
 *     // req.user is now typed and guaranteed to exist
 *   }
 * 
 *   async adminOnly(req: NaraRequest, res: NaraResponse) {
 *     this.requireAdmin(req);
 *     // req.user.is_admin is guaranteed to be true
 *   }
 * }
 */

import type { NaraRequest, NaraResponse, NaraResponseWithInertia, User } from './types';
import { AuthError, ForbiddenError, ValidationError } from './errors';
import type { Validator, ValidationResult } from '@validators/validate';
import { PAGINATION } from '@config';

/**
 * Request with authenticated user
 */
export type AuthenticatedRequest = NaraRequest & { user: User };

/**
 * Request with admin user
 */
export type AdminRequest = NaraRequest & { user: User & { is_admin: true } };

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  search: string;
}

/**
 * Abstract base controller class
 *
 * Provides common utilities for authentication, validation, and pagination.
 * All controllers should extend this class to reduce boilerplate.
 */
export abstract class BaseController {
  constructor() {
    // Auto-bind all methods to preserve 'this' context when passed as route callbacks
    const prototype = Object.getPrototypeOf(this);
    const propertyNames = Object.getOwnPropertyNames(prototype);

    for (const name of propertyNames) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (name !== 'constructor' && descriptor && typeof descriptor.value === 'function') {
        (this as any)[name] = (this as any)[name].bind(this);
      }
    }
  }

  /**
   * Require Inertia support on the response
   *
   * Throws Error if Inertia is not enabled (adapter not provided).
   * After calling this, TypeScript knows res.inertia() exists.
   *
   * @param res - Response object
   * @throws Error if Inertia is not supported
   */
  protected requireInertia(res: NaraResponse): asserts res is NaraResponseWithInertia {
    if (typeof res.inertia !== 'function') {
      throw new Error('Inertia support is not enabled. Please provide a FrontendAdapter (e.g., svelteAdapter) to NaraApp.');
    }
  }

  /**
   * Require authenticated user
   * 
   * Throws AuthError if user is not authenticated.
   * After calling this, TypeScript knows req.user exists.
   * 
   * @param req - Request object
   * @throws AuthError if not authenticated
   * 
   * @example
   * async myMethod(req: NaraRequest, res: NaraResponse) {
   *   this.requireAuth(req);
   *   // req.user is now typed as User
   *   console.log(req.user.id);
   * }
   */
  protected requireAuth(req: NaraRequest): asserts req is AuthenticatedRequest {
    if (!req.user) {
      throw new AuthError();
    }
  }

  /**
   * Require admin user
   * 
   * Throws AuthError if not authenticated, ForbiddenError if not admin.
   * After calling this, TypeScript knows req.user exists and is admin.
   * 
   * @param req - Request object
   * @throws AuthError if not authenticated
   * @throws ForbiddenError if not admin
   * 
   * @example
   * async adminMethod(req: NaraRequest, res: NaraResponse) {
   *   this.requireAdmin(req);
   *   // req.user.is_admin is guaranteed true
   * }
   */
  protected requireAdmin(req: NaraRequest): asserts req is AdminRequest {
    this.requireAuth(req);
    if (!req.user.is_admin) {
      throw new ForbiddenError();
    }
  }

  /**
   * Get and validate request body
   * 
   * Parses JSON body and validates against schema.
   * Throws ValidationError if validation fails.
   * 
   * @param req - Request object
   * @param schema - Validator function
   * @returns Validated and typed data
   * @throws ValidationError if validation fails
   * 
   * @example
   * async create(req: NaraRequest, res: NaraResponse) {
   *   const data = await this.getBody(req, CreatePostSchema);
   *   // data is typed based on schema
   * }
   */
  protected async getBody<T>(req: NaraRequest, schema: Validator<T>): Promise<T> {
    const raw = await req.json();
    const result: ValidationResult<T> = schema(raw);
    
    if (!result.success) {
      throw new ValidationError('Validation failed', result.errors);
    }
    
    return result.data;
  }

  /**
   * Get pagination parameters from query string
   * 
   * Extracts page, limit, and search from query params with defaults.
   * Enforces maximum page size from config.
   * 
   * @param req - Request object
   * @returns Pagination parameters
   * 
   * @example
   * async index(req: NaraRequest, res: NaraResponse) {
   *   const { page, limit, search } = this.getPaginationParams(req);
   *   const query = DB.from('posts').select('*');
   *   if (search) {
   *     query.where('title', 'like', `%${search}%`);
   *   }
   *   const result = await paginate(query, { page, limit });
   * }
   */
  protected getPaginationParams(req: NaraRequest): PaginationParams {
    const page = parseInt(req.query.page as string) || PAGINATION.DEFAULT_PAGE;
    const rawLimit = parseInt(req.query.limit as string) || PAGINATION.DEFAULT_PAGE_SIZE;
    const limit = Math.min(rawLimit, PAGINATION.MAX_PAGE_SIZE);
    const search = (req.query.search as string) || '';
    
    return { page, limit, search };
  }

  /**
   * Get a single query parameter with optional default
   * 
   * @param req - Request object
   * @param key - Query parameter key
   * @param defaultValue - Default value if not present
   * @returns Query parameter value or default
   * 
   * @example
   * const filter = this.getQueryParam(req, 'filter', 'all');
   */
  protected getQueryParam(req: NaraRequest, key: string, defaultValue: string = ''): string {
    return (req.query[key] as string) || defaultValue;
  }

  /**
   * Get route parameter
   * 
   * @param req - Request object
   * @param key - Parameter key
   * @returns Parameter value or undefined
   * 
   * @example
   * const id = this.getParam(req, 'id');
   * if (!id) return jsonError(res, 'ID required', 400);
   */
  protected getParam(req: NaraRequest, key: string): string | undefined {
    return req.params[key];
  }

  /**
   * Get required route parameter
   * 
   * Throws BadRequestError if parameter is missing.
   * 
   * @param req - Request object
   * @param key - Parameter key
   * @returns Parameter value
   * @throws BadRequestError if parameter is missing
   * 
   * @example
   * const id = this.getRequiredParam(req, 'id');
   * // id is guaranteed to be a string
   */
  protected getRequiredParam(req: NaraRequest, key: string): string {
    const value = req.params[key];
    if (!value) {
      throw new ValidationError(`Parameter '${key}' is required`, {
        [key]: [`${key} wajib diisi`]
      });
    }
    return value;
  }
}

export default BaseController;
