"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseController = void 0;
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
    json(res, data, status = 200) {
        return res.status(status).json(data);
    }
    success(res, data, message = 'Success') {
        return res.json({ success: true, message, data });
    }
    error(res, message, status = 400) {
        return res.status(status).json({ success: false, message });
    }
    requireInertia(res) {
        if (typeof res.inertia !== 'function') {
            throw new Error('Inertia support is not enabled. Please provide a FrontendAdapter.');
        }
    }
    requireAuth(req) {
        if (!req.user) {
            throw new Error('Unauthorized');
        }
    }
    requireAdmin(req) {
        this.requireAuth(req);
        if (!req.user.is_admin) {
            throw new Error('Forbidden');
        }
    }
    async getBody(req, _schema) {
        return await req.json();
    }
    getPaginationParams(req) {
        const page = parseInt(req.query.page) || 1;
        const rawLimit = parseInt(req.query.limit) || 10;
        const limit = Math.min(rawLimit, 100);
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
            throw new Error(`Parameter '${key}' is required`);
        }
        return value;
    }
}
exports.BaseController = BaseController;
//# sourceMappingURL=BaseController.js.map