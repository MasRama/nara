/**
 * Services Module
 * 
 * Barrel export for all application services.
 * Import services from this module for cleaner imports.
 * 
 * @example
 * import { DB, Logger, Storage } from "@services";
 */

// Database
export { default as DB } from './DB.js';

// Logging
export { default as Logger } from './Logger.js';

// Authentication
export { default as Authenticate } from './Authenticate.js';
export { default as LoginThrottle } from './LoginThrottle.js';
export { redirectParamsURL as GoogleAuthRedirectParams } from './GoogleAuth.js';

// Pagination
export { paginate, parsePaginationQuery } from './Paginator.js';
export type { PaginatedMeta, PaginatedResult, PaginateOptions } from './Paginator.js';

// SQLite utilities
export { default as SQLite } from './SQLite.js';

// Storage
export { default as Storage } from './Storage.js';
export type { StorageConfig, StoredFile, StoreOptions } from './Storage.js';

// View rendering
export { view } from './View.js';

