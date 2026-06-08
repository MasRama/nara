import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from "ultimate-express";

export interface AuthUser {
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

export interface NaraRequest extends ExpressRequest {
  user?: AuthUser;
  share?: Record<string, unknown>;
  requestId?: string;
}

export interface NaraResponse extends ExpressResponse {
  view(template: string, data?: Record<string, unknown>): Promise<unknown>;
  inertia?(
    component: string,
    props?: Record<string, unknown>,
    viewProps?: Record<string, unknown>
  ): Promise<unknown>;
  flash(key: string, value: unknown): NaraResponse;
}

export interface NaraResponseWithInertia extends NaraResponse {
  inertia(
    component: string,
    props?: Record<string, unknown>,
    viewProps?: Record<string, unknown>
  ): Promise<unknown>;
}

export type NaraMiddleware = (
  req: NaraRequest,
  res: NaraResponse,
  next: NextFunction
) => unknown | Promise<unknown>;

export type NaraHandler = (
  req: NaraRequest,
  res: NaraResponse
) => unknown | Promise<unknown>;

export type RouteMiddlewares = NaraMiddleware | NaraMiddleware[];

export type RouteCallback = NaraMiddleware | NaraHandler;
