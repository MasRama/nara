export declare class HttpError extends Error {
    readonly statusCode: number;
    readonly code: string;
    constructor(message: string, statusCode?: number, code?: string);
    toJSON(): Record<string, unknown>;
}
export declare class ValidationError extends HttpError {
    readonly errors: Record<string, string[]>;
    constructor(message?: string, errors?: Record<string, string[]>);
    toJSON(): Record<string, unknown>;
}
export declare class AuthError extends HttpError {
    constructor(message?: string);
}
export declare class NotFoundError extends HttpError {
    constructor(message?: string);
}
export declare class ForbiddenError extends HttpError {
    constructor(message?: string);
}
export declare class BadRequestError extends HttpError {
    constructor(message?: string);
}
export declare class ConflictError extends HttpError {
    constructor(message?: string);
}
export declare class TooManyRequestsError extends HttpError {
    readonly retryAfter?: number;
    constructor(message?: string, retryAfter?: number);
    toJSON(): Record<string, unknown>;
}
export declare class InternalError extends HttpError {
    constructor(message?: string);
}
export declare function isHttpError(error: unknown): error is HttpError;
export declare function isValidationError(error: unknown): error is ValidationError;
//# sourceMappingURL=errors.d.ts.map