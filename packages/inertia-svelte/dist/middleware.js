"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inertiaMiddleware = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
const inertiaMiddleware = (config = {}) => {
    const version = config.version || "1.0.0";
    const rootView = config.rootView || "inertia.html";
    return (req, res, next) => {
        res.inertia = async (component, inertiaProps = {}, viewProps = {}) => {
            const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
            const props = {
                user: req.user || {},
                ...inertiaProps,
                ...viewProps,
                error: req.cookies?.error || null,
            };
            if (req.cookies?.error) {
                res.cookie("error", "", 0);
            }
            const inertiaObject = {
                component,
                props,
                url,
                version,
            };
            if (req.header("X-Inertia")) {
                res.setHeader("Vary", "Accept");
                res.setHeader("X-Inertia", "true");
                res.setHeader("X-Inertia-Version", version);
                return res.json(inertiaObject);
            }
            const viewsDir = process.env.NODE_ENV === "development"
                ? (0, path_1.join)(process.cwd(), "resources/views")
                : (0, path_1.join)(process.cwd(), "dist/views");
            const viewPath = (0, path_1.join)(viewsDir, rootView);
            let html = `<!DOCTYPE html><html><body><div id="app" data-page="{{it.page}}"></div></body></html>`;
            if ((0, fs_1.existsSync)(viewPath)) {
                html = (0, fs_1.readFileSync)(viewPath, "utf8");
            }
            const title = config.title || process.env.TITLE || "NARA App";
            const pageJson = JSON.stringify(inertiaObject);
            let rendered = html
                .replace("{{it.title}}", escapeHtml(title))
                .replace("{{it.page}}", escapeHtml(pageJson));
            if (process.env.NODE_ENV === "development") {
                const vitePort = process.env.VITE_PORT || 3000;
                rendered = rendered.replace(/\/js\//g, `http://localhost:${vitePort}/js/`);
            }
            return res.type("html").send(rendered);
        };
        next();
    };
};
exports.inertiaMiddleware = inertiaMiddleware;
exports.default = exports.inertiaMiddleware;
//# sourceMappingURL=middleware.js.map