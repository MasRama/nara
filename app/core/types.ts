import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from "ultimate-express";
import type { User } from "../types/shared";

export type AuthUser = User;

export interface NaraRequest extends ExpressRequest {
  user?: AuthUser;
  share?: Record<string, unknown>;
  requestId?: string;
}

export interface NaraResponse extends ExpressResponse {
  view(template: string, data?: Record<string, unknown>): Promise<unknown>;
  inertia(
    component: string,
    props?: Record<string, unknown>,
    viewProps?: Record<string, unknown>
  ): Promise<unknown>;
  flash(key: string, value: unknown): NaraResponse;
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
