/**
 * Nara Core Types
 * 
 * Type-safe definitions for Request, Response, Middleware, and Handler.
 * These types extend HyperExpress types with Nara-specific features.
 */

import type { Request as HyperRequest, Response as HyperResponse, MiddlewareNext } from "hyper-express";

/**
 * User interface for authenticated requests
 */
export interface User {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  avatar: string | null;
  is_admin: boolean;
  is_verified: boolean;
  created_at?: number;
  updated_at?: number;
}

/**
 * Extended Request interface with user and shared data
 * 
 * @property user - Authenticated user (set by auth middleware)
 * @property share - Shared data passed to Inertia views
 */
export interface NaraRequest extends HyperRequest {
  user?: User;
  share?: Record<string, unknown>;
}

/**
 * Extended Response interface with Nara-specific methods
 * 
 * @method view - Render a view template
 * @method inertia - Render an Inertia component
 * @method flash - Set a flash message cookie
 */
export interface NaraResponse extends HyperResponse {
  view(template: string, data?: Record<string, unknown>): Promise<unknown>;
  inertia(
    component: string,
    props?: Record<string, unknown>,
    viewProps?: Record<string, unknown>
  ): Promise<unknown>;
  flash(key: string, value: unknown): NaraResponse;
}

/**
 * Middleware function type
 * 
 * Middlewares can:
 * - Modify request/response
 * - Call next() to continue to the next middleware/handler
 * - Return early (e.g., redirect, error response) without calling next()
 * 
 * Note: Return type is `unknown` to allow flexibility in what middlewares return.
 * HyperExpress ignores return values, so this is safe.
 * 
 * @example
 * const authMiddleware: NaraMiddleware = async (req, res, next) => {
 *   if (!req.user) {
 *     return res.status(401).json({ error: 'Unauthorized' });
 *   }
 *   next();
 * };
 */
export type NaraMiddleware = (
  req: NaraRequest,
  res: NaraResponse,
  next: MiddlewareNext
) => unknown | Promise<unknown>;

/**
 * Route handler function type
 * 
 * Handlers are the final function in the middleware chain.
 * They process the request and send a response.
 * 
 * Note: Return type is `unknown` to allow flexibility in what handlers return.
 * HyperExpress ignores return values, so this is safe.
 * 
 * @example
 * const getUsers: NaraHandler = async (req, res) => {
 *   const users = await DB.from('users').select('*');
 *   res.json({ success: true, data: users });
 * };
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
