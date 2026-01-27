export declare class HttpError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string);
}
export declare class NotFoundError extends HttpError {
    constructor(message?: string);
}
export declare class UnauthorizedError extends HttpError {
    constructor(message?: string);
}
export declare class ForbiddenError extends HttpError {
    constructor(message?: string);
}
export declare class BadRequestError extends HttpError {
    constructor(message?: string);
}
export declare class ValidationError extends HttpError {
    errors: Record<string, string[]>;
    constructor(errors: Record<string, string[]>, message?: string);
}
//# sourceMappingURL=errors.d.ts.map