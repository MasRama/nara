/**
 * Form Request Base Class
 *
 * Provides a Laravel-like Form Request validation system with authorization.
 * Extend this class to create type-safe form requests with validation rules.
 *
 * @example
 * // Create a form request class
 * class CreatePostRequest extends FormRequest<CreatePostData> {
 *   async authorize(): Promise<boolean> {
 *     return this.user?.is_admin ?? false;
 *   }
 *
 *   rules(): Validator<CreatePostData> {
 *     return CreatePostSchema;
 *   }
 * }
 *
 * @example
 * // Use in controller
 * async store(req: NaraRequest, res: NaraResponse) {
 *   const formRequest = await CreatePostRequest.from(req);
 *   const data = formRequest.validated();
 *   // data is typed as CreatePostData
 * }
 *
 * @example
 * // Use with BaseController helper
 * async store(req: NaraRequest, res: NaraResponse) {
 *   const formRequest = await this.getValidated(req, CreatePostRequest);
 *   const data = formRequest.validated();
 * }
 */

import type { NaraRequest, User } from './types';
import { ValidationError, ForbiddenError, AuthError } from './errors';
import type { Validator, ValidationResult } from '@validators/validate';

/**
 * Constructor type for FormRequest classes
 */
export interface FormRequestConstructor<T, R extends FormRequest<T>> {
  new (
    req: NaraRequest,
    validatedData?: T,
    validationErrors?: Record<string, string[]>
  ): R;
  from(req: NaraRequest): Promise<R>;
}

/**
 * Abstract base class for Form Requests
 *
 * Provides validation and authorization capabilities similar to Laravel's FormRequest.
 *
 * @typeParam T - The type of validated data returned by validated()
 */
export abstract class FormRequest<T = unknown> {
  /**
   * The underlying NaraRequest instance
   */
  protected readonly req: NaraRequest;

  /**
   * Validated data (set after successful validation)
   */
  protected validatedData?: T;

  /**
   * Validation errors (set if validation fails)
   */
  protected validationErrors?: Record<string, string[]>;

  /**
   * Whether validation has been performed
   */
  protected hasValidated: boolean = false;

  /**
   * Create a new FormRequest instance
   *
   * @param req - The NaraRequest instance
   * @param validatedData - Optional pre-validated data (used internally)
   * @param validationErrors - Optional validation errors (used internally)
   */
  constructor(
    req: NaraRequest,
    validatedData?: T,
    validationErrors?: Record<string, string[]>
  ) {
    this.req = req;
    this.validatedData = validatedData;
    this.validationErrors = validationErrors;
    this.hasValidated = validatedData !== undefined || validationErrors !== undefined;
  }

  /**
   * Determine if the user is authorized to make this request
   *
   * Override this method to implement authorization logic.
   * Return true to allow the request, false to deny.
   *
   * @returns Promise<boolean> | boolean
   *
   * @example
   * async authorize(): Promise<boolean> {
   *   return this.user?.is_admin ?? false;
   * }
   *
   * @example
   * async authorize(): Promise<boolean> {
   *   const post = await Post.find(this.param('id'));
   *   return post?.user_id === this.user?.id;
   * }
   */
  abstract authorize(): Promise<boolean> | boolean;

  /**
   * Get the validation rules for this request
   *
   * Override this method to return a validator function.
   *
   * @returns Validator<T>
   *
   * @example
   * rules(): Validator<CreateUserData> {
   *   return CreateUserSchema;
   * }
   */
  abstract rules(): Validator<T>;

  /**
   * Create and validate a FormRequest from a NaraRequest
   *
   * This factory method:
   * 1. Checks authorization (throws ForbiddenError if denied)
   * 2. Validates the request body (throws ValidationError if invalid)
   * 3. Returns a FormRequest instance with validated data
   *
   * @param req - The NaraRequest instance
   * @returns Promise<FormRequest<T>>
   * @throws ForbiddenError if authorization fails
   * @throws ValidationError if validation fails
   *
   * @example
   * const formRequest = await CreateUserRequest.from(req);
   * const data = formRequest.validated();
   */
  static async from<T, R extends FormRequest<T>>(
    this: new (req: NaraRequest, validatedData?: T, validationErrors?: Record<string, string[]>) => R,
    req: NaraRequest
  ): Promise<R> {
    const instance = new this(req);
    return instance.validate() as Promise<R>;
  }

  /**
   * Perform authorization and validation
   *
   * @returns Promise<this>
   * @throws ForbiddenError if authorization fails
   * @throws ValidationError if validation fails
   */
  async validate(): Promise<this> {
    // Check authorization first
    const authorized = await this.authorize();
    if (!authorized) {
      throw new ForbiddenError('This action is unauthorized.');
    }

    // Get request body
    const body = await this.req.json();

    // Validate
    const validator = this.rules();
    const result: ValidationResult<T> = validator(body);

    this.hasValidated = true;

    if (!result.success) {
      this.validationErrors = result.errors;
      throw new ValidationError(result.errors, 'The given data was invalid.');
    }

    this.validatedData = result.data;
    return this;
  }

  /**
   * Get the validated data
   *
   * @returns The validated data of type T
   * @throws Error if called before validation
   *
   * @example
   * const data = formRequest.validated();
   * // data is typed as T
   */
  validated(): T {
    if (!this.hasValidated) {
      throw new Error('Cannot retrieve validated data before validation is performed.');
    }

    if (this.validationErrors) {
      throw new Error('Cannot retrieve validated data when validation has failed.');
    }

    if (this.validatedData === undefined) {
      throw new Error('Validated data is undefined.');
    }

    return this.validatedData;
  }

  /**
   * Check if validation fails
   *
   * @returns true if validation failed, false otherwise
   * @throws Error if called before validation
   */
  fails(): boolean {
    if (!this.hasValidated) {
      throw new Error('Cannot check validation status before validation is performed.');
    }

    return this.validationErrors !== undefined;
  }

  /**
   * Check if validation passes
   *
   * @returns true if validation passed, false otherwise
   * @throws Error if called before validation
   */
  passes(): boolean {
    return !this.fails();
  }

  /**
   * Get validation errors
   *
   * @returns Record of field errors, or null if no errors
   * @throws Error if called before validation
   */
  errors(): Record<string, string[]> | null {
    if (!this.hasValidated) {
      throw new Error('Cannot retrieve errors before validation is performed.');
    }

    return this.validationErrors ?? null;
  }

  /**
   * Get a specific field error
   *
   * @param field - The field name
   * @returns Array of error messages for the field, or undefined
   */
  error(field: string): string[] | undefined {
    const errors = this.errors();
    return errors?.[field];
  }

  /**
   * Get the authenticated user
   *
   * @returns The User object, or undefined if not authenticated
   */
  get user(): User | undefined {
    return this.req.user;
  }

  /**
   * Require authenticated user
   *
   * @throws AuthError if user is not authenticated
   * @returns The User object
   */
  requireUser(): User {
    if (!this.req.user) {
      throw new AuthError('Authentication required.');
    }
    return this.req.user;
  }

  /**
   * Get a route parameter
   *
   * @param key - The parameter key
   * @returns The parameter value, or undefined
   */
  param(key: string): string | undefined {
    return this.req.params[key];
  }

  /**
   * Get a query parameter
   *
   * @param key - The query parameter key
   * @param defaultValue - Default value if not present
   * @returns The query parameter value, or defaultValue
   */
  query(key: string, defaultValue?: string): string | undefined {
    const value = this.req.query[key];
    return value !== undefined ? String(value) : defaultValue;
  }

  /**
   * Get the request ID for tracing
   *
   * @returns The request ID, or undefined
   */
  get requestId(): string | undefined {
    return this.req.requestId;
  }

  /**
   * Get the raw request body
   *
   * @returns Promise<unknown>
   */
  async body(): Promise<unknown> {
    return this.req.json();
  }

  /**
   * Get a specific field from the request body
   *
   * @param key - The field key
   * @returns The field value, or undefined
   */
  async input(key: string): Promise<unknown> {
    const body = await this.req.json();
    if (typeof body === 'object' && body !== null) {
      return (body as Record<string, unknown>)[key];
    }
    return undefined;
  }

  /**
   * Check if the request has a specific field
   *
   * @param key - The field key
   * @returns true if the field exists, false otherwise
   */
  async has(key: string): Promise<boolean> {
    const body = await this.req.json();
    if (typeof body === 'object' && body !== null) {
      return key in (body as Record<string, unknown>);
    }
    return false;
  }

  /**
   * Get all input data
   *
   * Combines route params, query params, and body data.
   *
   * @returns Promise<Record<string, unknown>>
   */
  async all(): Promise<Record<string, unknown>> {
    const body = await this.req.json();
    return {
      ...this.req.params,
      ...this.req.query,
      ...(typeof body === 'object' && body !== null ? body : {}),
    };
  }

  /**
   * Get only specified fields from input
   *
   * @param keys - The field keys to retrieve
   * @returns Promise<Record<string, unknown>>
   */
  async only(keys: string[]): Promise<Record<string, unknown>> {
    const all = await this.all();
    const result: Record<string, unknown> = {};

    for (const key of keys) {
      if (key in all) {
        result[key] = all[key];
      }
    }

    return result;
  }

  /**
   * Get all input except specified fields
   *
   * @param keys - The field keys to exclude
   * @returns Promise<Record<string, unknown>>
   */
  async except(keys: string[]): Promise<Record<string, unknown>> {
    const all = await this.all();
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(all)) {
      if (!keys.includes(key)) {
        result[key] = value;
      }
    }

    return result;
  }
}

export default FormRequest;
