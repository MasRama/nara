/**
 * Nara Core
 * 
 * Core framework components for building type-safe web applications.
 * 
 * @example
 * // Bootstrap application
 * import { createApp } from '@core';
 * import routes from '@routes/web';
 * 
 * const app = createApp({ routes });
 * app.start();
 * 
 * @example
 * // Use router and errors
 * import { createRouter, HttpError, NotFoundError } from '@core';
 * import type { NaraRequest, NaraResponse, NaraMiddleware, NaraHandler } from '@core';
 */

// App
export { NaraApp, createApp } from './App';
export type { AppOptions } from './App';

// Base Controller
export { BaseController } from './BaseController';
export type { AuthenticatedRequest, AdminRequest, PaginationParams } from './BaseController';

// Form Request
export { FormRequest } from './FormRequest';
export type { FormRequestConstructor } from './FormRequest';

// Types
export type {
  User,
  NaraRequest,
  NaraResponse,
  NaraMiddleware,
  NaraHandler,
  RouteMiddlewares,
  RouteCallback,
} from './types';

// Router
export { NaraRouter, createRouter } from './Router';

// Adapters
export * from './adapters/types';
export { svelteAdapter } from './adapters/svelte';

// Errors
export {
  HttpError,
  ValidationError,
  AuthError,
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
  TooManyRequestsError,
  InternalError,
  isHttpError,
  isValidationError,
} from './errors';

// Response Helpers
export {
  jsonSuccess,
  jsonError,
  jsonPaginated,
  jsonCreated,
  jsonNoContent,
  jsonUnauthorized,
  jsonForbidden,
  jsonNotFound,
  jsonValidationError,
  jsonServerError,
} from './response';

export type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  PaginationMeta,
  ResponseMeta,
} from './response';
