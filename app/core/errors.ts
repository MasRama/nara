export interface NaraError {
  readonly __nara: true;
  readonly name: string;
  readonly message: string;
  readonly statusCode: number;
  readonly code: string;
  readonly errors?: Record<string, string[]>;
  readonly retryAfter?: number;
}

export const httpError = (message: string, statusCode = 500, code = 'HTTP_ERROR'): NaraError => ({
  __nara: true,
  name: 'HttpError',
  message,
  statusCode,
  code,
});

export const validationError = (errors: Record<string, string[]> = {}, message = 'Validation failed'): NaraError => ({
  __nara: true,
  name: 'ValidationError',
  message,
  statusCode: 422,
  code: 'VALIDATION_ERROR',
  errors,
});

export const authError = (message = 'Unauthorized'): NaraError =>
  httpError(message, 401, 'AUTH_ERROR');

export const notFoundError = (message = 'Not Found'): NaraError =>
  httpError(message, 404, 'NOT_FOUND');

export const forbiddenError = (message = 'Forbidden'): NaraError =>
  httpError(message, 403, 'FORBIDDEN');

export const badRequestError = (message = 'Bad Request'): NaraError =>
  httpError(message, 400, 'BAD_REQUEST');

export const conflictError = (message = 'Conflict'): NaraError =>
  httpError(message, 409, 'CONFLICT');

export const tooManyRequestsError = (message = 'Too Many Requests', retryAfter?: number): NaraError => ({
  ...httpError(message, 429, 'TOO_MANY_REQUESTS'),
  retryAfter,
});

export const internalError = (message = 'Internal Server Error'): NaraError =>
  httpError(message, 500, 'INTERNAL_ERROR');

export const isNaraError = (error: unknown): error is NaraError =>
  error !== null &&
  typeof error === 'object' &&
  (error as any).__nara === true;

export const isValidationError = (error: unknown): error is NaraError =>
  isNaraError(error) && error.code === 'VALIDATION_ERROR';
