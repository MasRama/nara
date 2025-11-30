/**
 * Nara Core Error Classes
 * 
 * Standardized error classes for consistent error handling across the application.
 * All errors extend HttpError which provides statusCode and code properties.
 */

/**
 * Base HTTP Error class
 * 
 * All custom errors should extend this class.
 * The global error handler in server.ts uses statusCode to set the response status.
 * 
 * @example
 * throw new HttpError('Something went wrong', 500, 'INTERNAL_ERROR');
 */
export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 500, code: string = 'HTTP_ERROR') {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
    };
  }
}

/**
 * Validation Error (422 Unprocessable Entity)
 * 
 * Thrown when request validation fails.
 * Contains field-level error messages.
 * 
 * @example
 * throw new ValidationError('Validation failed', {
 *   email: ['Email is required', 'Email format is invalid'],
 *   password: ['Password must be at least 8 characters']
 * });
 */
export class ValidationError extends HttpError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string = 'Validation failed', errors: Record<string, string[]> = {}) {
    super(message, 422, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    this.errors = errors;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      errors: this.errors,
    };
  }
}

/**
 * Authentication Error (401 Unauthorized)
 * 
 * Thrown when authentication is required but not provided or invalid.
 * 
 * @example
 * throw new AuthError('Invalid credentials');
 * throw new AuthError('Session expired');
 */
export class AuthError extends HttpError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

/**
 * Not Found Error (404 Not Found)
 * 
 * Thrown when a requested resource does not exist.
 * 
 * @example
 * throw new NotFoundError('User not found');
 * throw new NotFoundError('Page not found');
 */
export class NotFoundError extends HttpError {
  constructor(message: string = 'Not Found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Forbidden Error (403 Forbidden)
 * 
 * Thrown when user is authenticated but not authorized to access a resource.
 * 
 * @example
 * throw new ForbiddenError('You do not have permission to access this resource');
 * throw new ForbiddenError('Admin access required');
 */
export class ForbiddenError extends HttpError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/**
 * Bad Request Error (400 Bad Request)
 * 
 * Thrown when the request is malformed or contains invalid data.
 * 
 * @example
 * throw new BadRequestError('Invalid JSON body');
 * throw new BadRequestError('Missing required parameter: id');
 */
export class BadRequestError extends HttpError {
  constructor(message: string = 'Bad Request') {
    super(message, 400, 'BAD_REQUEST');
    this.name = 'BadRequestError';
  }
}

/**
 * Conflict Error (409 Conflict)
 * 
 * Thrown when there's a conflict with the current state of the resource.
 * 
 * @example
 * throw new ConflictError('Email already exists');
 * throw new ConflictError('Resource already exists');
 */
export class ConflictError extends HttpError {
  constructor(message: string = 'Conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

/**
 * Too Many Requests Error (429 Too Many Requests)
 * 
 * Thrown when rate limit is exceeded.
 * 
 * @example
 * throw new TooManyRequestsError('Rate limit exceeded. Try again in 60 seconds.');
 */
export class TooManyRequestsError extends HttpError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Too Many Requests', retryAfter?: number) {
    super(message, 429, 'TOO_MANY_REQUESTS');
    this.name = 'TooManyRequestsError';
    this.retryAfter = retryAfter;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      ...(this.retryAfter && { retryAfter: this.retryAfter }),
    };
  }
}

/**
 * Internal Server Error (500 Internal Server Error)
 * 
 * Thrown for unexpected server errors.
 * 
 * @example
 * throw new InternalError('Database connection failed');
 */
export class InternalError extends HttpError {
  constructor(message: string = 'Internal Server Error') {
    super(message, 500, 'INTERNAL_ERROR');
    this.name = 'InternalError';
  }
}

/**
 * Type guard to check if an error is an HttpError
 */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

/**
 * Type guard to check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
