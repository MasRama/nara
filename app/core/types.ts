/**
 * Nara Core Types
 * 
 * Type-safe definitions for Request, Response, Middleware, and Handler.
 * These types extend Express types with Nara-specific features.
 * 
 * Powered by ultimate-express (uWebSockets.js) for maximum performance.
 */

import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from "ultimate-express";

/**
 * User interface for authenticated requests
 */
export interface User {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  avatar: string | null;
  is_verified: boolean;
  roles?: string[];
  permissions?: string[];
  created_at?: number;
  updated_at?: number;
}

/**
 * Extended Request interface with user and shared data
 *
 * @property user - Authenticated user (set by auth middleware)
 * @property share - Shared data passed to Inertia views
 * @property requestId - Unique request ID for tracing (set by requestId middleware)
 */
export interface NaraRequest extends ExpressRequest {
  user?: User;
  share?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Extended Response interface with Nara-specific methods
 * 
 * @method view - Render a view template
 * @method inertia - Render an Inertia component
 * @method flash - Set a flash message cookie
 */
export interface NaraResponse extends ExpressResponse {
  view(template: string, data?: Record<string, unknown>): Promise<unknown>;
  inertia?(
    component: string,
    props?: Record<string, unknown>,
    viewProps?: Record<string, unknown>
  ): Promise<unknown>;
  flash(key: string, value: unknown): NaraResponse;
}

/**
 * NaraResponse with Inertia support explicitly enabled
 */
export interface NaraResponseWithInertia extends NaraResponse {
  inertia(
    component: string,
    props?: Record<string, unknown>,
    viewProps?: Record<string, unknown>
  ): Promise<unknown>;
}

/**
 * Middleware function type
 * 
 * Middlewares can:
 * - Modify request/response
 * - Call next() to continue to the next middleware/handler
 * - Return early (e.g., redirect, error response) without calling next()
 */
export type NaraMiddleware = (
  req: NaraRequest,
  res: NaraResponse,
  next: NextFunction
) => unknown | Promise<unknown>;

/**
 * Route handler function type
 * 
 * Handlers are the final function in the middleware chain.
 * They process the request and send a response.
 */
export type NaraHandler = (
  req: NaraRequest,
  res: NaraResponse
) => unknown | Promise<unknown>;

/**
 * Route definition with optional middleware array
 * 
 * @example
 * Route.get('/users', [AuthMiddleware, AdminMiddleware], UserController.index);
 */
export type RouteMiddlewares = NaraMiddleware | NaraMiddleware[];

/**
 * Generic handler that can be either a middleware or a handler
 * Used internally by the router
 */
export type RouteCallback = NaraMiddleware | NaraHandler;
