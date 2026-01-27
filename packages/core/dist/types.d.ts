import type { Request as HyperRequest, Response as HyperResponse, MiddlewareNext } from "hyper-express";
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
export interface NaraRequest extends HyperRequest {
    user?: User;
    share?: Record<string, unknown>;
}
export interface NaraResponse extends HyperResponse {
    view(template: string, data?: Record<string, unknown>): Promise<unknown>;
    inertia?(component: string, props?: Record<string, unknown>, viewProps?: Record<string, unknown>): Promise<unknown>;
    flash(key: string, value: unknown): NaraResponse;
}
export interface NaraResponseWithInertia extends NaraResponse {
    inertia(component: string, props?: Record<string, unknown>, viewProps?: Record<string, unknown>): Promise<unknown>;
}
export type NaraMiddleware = (req: NaraRequest, res: NaraResponse, next: MiddlewareNext) => unknown | Promise<unknown>;
export type NaraHandler = (req: NaraRequest, res: NaraResponse) => unknown | Promise<unknown>;
//# sourceMappingURL=types.d.ts.map