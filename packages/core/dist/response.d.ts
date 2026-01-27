import type { NaraResponse } from './types';
import { PaginatedMeta } from '@services/Paginator';
export type PaginationMeta = PaginatedMeta;
export type { PaginatedMeta };
export type ResponseMeta = PaginationMeta | Record<string, unknown>;
export interface ApiSuccessResponse<T = unknown> {
    success: true;
    message: string;
    data?: T;
    meta?: ResponseMeta;
}
export interface ApiErrorResponse {
    success: false;
    message: string;
    code?: string;
    errors?: Record<string, string[]>;
}
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
export declare function jsonSuccess<T = unknown>(res: NaraResponse, message: string, data?: T, meta?: ResponseMeta, statusCode?: number): NaraResponse;
export declare function jsonError(res: NaraResponse, message: string, statusCode?: number, code?: string, errors?: Record<string, string[]>): NaraResponse;
export declare function jsonPaginated<T = unknown>(res: NaraResponse, message: string, data: T[], meta: PaginatedMeta): NaraResponse;
export declare function jsonCreated<T = unknown>(res: NaraResponse, message: string, data?: T): NaraResponse;
export declare function jsonNoContent(res: NaraResponse): NaraResponse;
export declare function jsonUnauthorized(res: NaraResponse, message?: string): NaraResponse;
export declare function jsonForbidden(res: NaraResponse, message?: string): NaraResponse;
export declare function jsonNotFound(res: NaraResponse, message?: string): NaraResponse;
export declare function jsonValidationError(res: NaraResponse, message?: string, errors?: Record<string, string[]>): NaraResponse;
export declare function jsonServerError(res: NaraResponse, message?: string): NaraResponse;
//# sourceMappingURL=response.d.ts.map