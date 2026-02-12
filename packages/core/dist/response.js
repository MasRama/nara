"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonSuccess = jsonSuccess;
exports.jsonError = jsonError;
exports.jsonNotFound = jsonNotFound;
exports.jsonUnauthorized = jsonUnauthorized;
exports.jsonForbidden = jsonForbidden;
exports.jsonValidationError = jsonValidationError;
function jsonSuccess(res, data, message = 'Success') {
    return res.json({ success: true, message, data });
}
function jsonError(res, message, status = 400) {
    return res.status(status).json({ success: false, message });
}
function jsonNotFound(res, message = 'Not found') {
    return res.status(404).json({ success: false, message });
}
function jsonUnauthorized(res, message = 'Unauthorized') {
    return res.status(401).json({ success: false, message });
}
function jsonForbidden(res, message = 'Forbidden') {
    return res.status(403).json({ success: false, message });
}
function jsonValidationError(res, errors) {
    return res.status(422).json({ success: false, message: 'Validation failed', errors });
}
//# sourceMappingURL=response.js.map