import type { NaraResponse } from './types';
export declare function jsonSuccess(res: NaraResponse, data: any, message?: string): boolean;
export declare function jsonError(res: NaraResponse, message: string, status?: number): boolean;
export declare function jsonNotFound(res: NaraResponse, message?: string): boolean;
export declare function jsonUnauthorized(res: NaraResponse, message?: string): boolean;
export declare function jsonForbidden(res: NaraResponse, message?: string): boolean;
export declare function jsonValidationError(res: NaraResponse, errors: Record<string, string[]>): boolean;
//# sourceMappingURL=response.d.ts.map