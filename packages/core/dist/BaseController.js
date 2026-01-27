"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseController = void 0;
const errors_1 = require("./errors");
const _config_1 = require("@config");
class BaseController {
    constructor() {
        const prototype = Object.getPrototypeOf(this);
        const propertyNames = Object.getOwnPropertyNames(prototype);
        for (const name of propertyNames) {
            const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
            if (name !== 'constructor' && descriptor && typeof descriptor.value === 'function') {
                this[name] = this[name].bind(this);
            }
        }
    }
    requireInertia(res) {
        if (typeof res.inertia !== 'function') {
            throw new Error('Inertia support is not enabled. Please provide a FrontendAdapter (e.g., svelteAdapter) to NaraApp.');
        }
    }
    requireAuth(req) {
        if (!req.user) {
            throw new errors_1.AuthError();
        }
    }
    requireAdmin(req) {
        this.requireAuth(req);
        if (!req.user.is_admin) {
            throw new errors_1.ForbiddenError();
        }
    }
    async getBody(req, schema) {
        const raw = await req.json();
        const result = schema(raw);
        if (!result.success) {
            throw new errors_1.ValidationError('Validation failed', result.errors);
        }
        return result.data;
    }
    getPaginationParams(req) {
        const page = parseInt(req.query.page) || _config_1.PAGINATION.DEFAULT_PAGE;
        const rawLimit = parseInt(req.query.limit) || _config_1.PAGINATION.DEFAULT_PAGE_SIZE;
        const limit = Math.min(rawLimit, _config_1.PAGINATION.MAX_PAGE_SIZE);
        const search = req.query.search || '';
        return { page, limit, search };
    }
    getQueryParam(req, key, defaultValue = '') {
        return req.query[key] || defaultValue;
    }
    getParam(req, key) {
        return req.params[key];
    }
    getRequiredParam(req, key) {
        const value = req.params[key];
        if (!value) {
            throw new errors_1.ValidationError(`Parameter '${key}' is required`, {
                [key]: [`${key} wajib diisi`]
            });
        }
        return value;
    }
}
exports.BaseController = BaseController;
exports.default = BaseController;
//# sourceMappingURL=BaseController.js.map