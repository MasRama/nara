import { Request as HyperRequest, Response as HyperResponse } from "hyper-express";

/**
 * User interface for authenticated requests
 */
export interface User {
    id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
    is_admin: boolean;
    is_verified: boolean;
    created_at?: number;
    updated_at?: number;
}

/**
 * Extended Response interface with custom methods
 */
export interface Response extends HyperResponse {
    view(view: string, data?: Record<string, any>): void;
    inertia(view: string, data?: Record<string, any>): void;
    flash(message: string, data: any): Response;
}

/**
 * Extended Request interface with user and shared data
 * Note: user is optional because not all routes require authentication
 */
export interface Request extends HyperRequest {
    user?: User;
    share?: Record<string, any>;
}
