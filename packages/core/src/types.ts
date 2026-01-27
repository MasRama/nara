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
 */
export interface NaraRequest extends HyperRequest {
  user?: User;
  share?: Record<string, unknown>;
}

/**
 * Extended Response interface with Nara-specific methods
 */
export interface NaraResponse extends HyperResponse {
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
 */
export type NaraMiddleware = (
  req: NaraRequest,
  res: NaraResponse,
  next: MiddlewareNext
) => unknown | Promise<unknown>;

/**
 * Route handler function type
 */
export type NaraHandler = (
  req: NaraRequest,
  res: NaraResponse
) => unknown | Promise<unknown>;
