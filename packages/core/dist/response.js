"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonSuccess = jsonSuccess;
exports.jsonError = jsonError;
exports.jsonPaginated = jsonPaginated;
exports.jsonCreated = jsonCreated;
exports.jsonNoContent = jsonNoContent;
exports.jsonUnauthorized = jsonUnauthorized;
exports.jsonForbidden = jsonForbidden;
exports.jsonNotFound = jsonNotFound;
exports.jsonValidationError = jsonValidationError;
exports.jsonServerError = jsonServerError;
function jsonSuccess(res, message, data, meta, statusCode = 200) {
    const response = {
        success: true,
        message,
    };
    if (data !== undefined) {
        response.data = data;
    }
    if (meta !== undefined) {
        response.meta = meta;
    }
    res.status(statusCode).json(response);
    return res;
}
function jsonError(res, message, statusCode = 400, code, errors) {
    const response = {
        success: false,
        message,
    };
    if (code !== undefined) {
        response.code = code;
    }
    if (errors !== undefined) {
        response.errors = errors;
    }
    res.status(statusCode).json(response);
    return res;
}
function jsonPaginated(res, message, data, meta) {
    const paginationMeta = {
        ...meta,
        totalPages: meta.totalPages ?? Math.ceil(meta.total / meta.limit),
    };
    return jsonSuccess(res, message, data, paginationMeta);
}
function jsonCreated(res, message, data) {
    return jsonSuccess(res, message, data, undefined, 201);
}
function jsonNoContent(res) {
    res.status(204).send('');
    return res;
}
function jsonUnauthorized(res, message = 'Unauthorized') {
    return jsonError(res, message, 401, 'UNAUTHORIZED');
}
function jsonForbidden(res, message = 'Forbidden') {
    return jsonError(res, message, 403, 'FORBIDDEN');
}
function jsonNotFound(res, message = 'Not Found') {
    return jsonError(res, message, 404, 'NOT_FOUND');
}
function jsonValidationError(res, message = 'Validation failed', errors) {
    return jsonError(res, message, 422, 'VALIDATION_ERROR', errors);
}
function jsonServerError(res, message = 'Internal Server Error') {
    return jsonError(res, message, 500, 'INTERNAL_ERROR');
}
//# sourceMappingURL=response.js.map