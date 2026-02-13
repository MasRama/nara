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
export { default as DB } from './DB';

// Logging
export { default as Logger } from './Logger';

// Authentication
export { default as Authenticate } from './Authenticate';
export { default as LoginThrottle } from './LoginThrottle';
export { redirectParamsURL as GoogleAuthRedirectParams } from './GoogleAuth';

// Pagination
export { paginate, parsePaginationQuery } from './Paginator';
export type { PaginatedMeta, PaginatedResult, PaginateOptions } from './Paginator';

// SQLite utilities
export { default as SQLite } from './SQLite';

// Storage
export { default as Storage } from './Storage';
export type { StorageConfig, StoredFile, StoreOptions } from './Storage';

// View rendering
export { view } from './View';
