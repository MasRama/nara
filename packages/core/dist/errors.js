"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalError = exports.TooManyRequestsError = exports.ConflictError = exports.BadRequestError = exports.ForbiddenError = exports.NotFoundError = exports.AuthError = exports.ValidationError = exports.HttpError = void 0;
exports.isHttpError = isHttpError;
exports.isValidationError = isValidationError;
class HttpError extends Error {
    constructor(message, statusCode = 500, code = 'HTTP_ERROR') {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        this.code = code;
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            code: this.code,
        };
    }
}
exports.HttpError = HttpError;
class ValidationError extends HttpError {
    constructor(message = 'Validation failed', errors = {}) {
        super(message, 422, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        this.errors = errors;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            errors: this.errors,
        };
    }
}
exports.ValidationError = ValidationError;
class AuthError extends HttpError {
    constructor(message = 'Unauthorized') {
        super(message, 401, 'AUTH_ERROR');
        this.name = 'AuthError';
    }
}
exports.AuthError = AuthError;
class NotFoundError extends HttpError {
    constructor(message = 'Not Found') {
        super(message, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class ForbiddenError extends HttpError {
    constructor(message = 'Forbidden') {
        super(message, 403, 'FORBIDDEN');
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
class BadRequestError extends HttpError {
    constructor(message = 'Bad Request') {
        super(message, 400, 'BAD_REQUEST');
        this.name = 'BadRequestError';
    }
}
exports.BadRequestError = BadRequestError;
class ConflictError extends HttpError {
    constructor(message = 'Conflict') {
        super(message, 409, 'CONFLICT');
        this.name = 'ConflictError';
    }
}
exports.ConflictError = ConflictError;
class TooManyRequestsError extends HttpError {
    constructor(message = 'Too Many Requests', retryAfter) {
        super(message, 429, 'TOO_MANY_REQUESTS');
        this.name = 'TooManyRequestsError';
        this.retryAfter = retryAfter;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            ...(this.retryAfter && { retryAfter: this.retryAfter }),
        };
    }
}
exports.TooManyRequestsError = TooManyRequestsError;
class InternalError extends HttpError {
    constructor(message = 'Internal Server Error') {
        super(message, 500, 'INTERNAL_ERROR');
        this.name = 'InternalError';
    }
}
exports.InternalError = InternalError;
function isHttpError(error) {
    return error instanceof HttpError;
}
function isValidationError(error) {
    return error instanceof ValidationError;
}
//# sourceMappingURL=errors.js.map