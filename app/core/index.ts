export { createApp, createWebApp, createApiApp } from './App';
export type { AppOptions, NaraApp } from './App';

export type {
  AuthUser,
  NaraRequest,
  NaraResponse,
  NaraMiddleware,
  NaraHandler,
  RouteMiddlewares,
  RouteCallback,
} from './types';

export { createRouter } from './Router';
export type { NaraRouter } from './Router';

export * from './adapters/types';
export { svelteAdapter } from './adapters/svelte';

export {
  httpError,
  validationError,
  authError,
  notFoundError,
  forbiddenError,
  badRequestError,
  conflictError,
  tooManyRequestsError,
  internalError,
  isNaraError,
  isValidationError,
  isUniqueConstraintError,
} from './errors';

export type { NaraError } from './errors';

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
  queryInt,
  queryString,
} from './response';

export type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  PaginationMeta,
  ResponseMeta,
} from './response';
