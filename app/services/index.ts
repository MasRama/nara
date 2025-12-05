/**
 * Services Module
 * 
 * Barrel export for all application services.
 * Import services from this module for cleaner imports.
 * 
 * @example
 * import { DB, Logger, Mailer } from "@services";
 */

// Database
export { default as DB } from './DB';

// Logging
export { default as Logger } from './Logger';

// Authentication
export { default as Authenticate } from './Authenticate';
export { default as LoginThrottle } from './LoginThrottle';
export { redirectParamsURL as GoogleAuthRedirectParams } from './GoogleAuth';

// Email
export { default as Mailer } from './Mailer';

// Pagination
export { paginate, parsePaginationQuery } from './Paginator';
export type { PaginatedMeta, PaginatedResult, PaginateOptions } from './Paginator';

// SQLite utilities
export { default as SQLite } from './SQLite';

// View rendering
export { view } from './View';
