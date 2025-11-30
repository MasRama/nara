/**
 * Nara Core
 * 
 * Core framework components for building type-safe web applications.
 * 
 * @example
 * import { createRouter, HttpError, NotFoundError } from '@core';
 * import type { NaraRequest, NaraResponse, NaraMiddleware, NaraHandler } from '@core';
 */

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
