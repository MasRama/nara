import { readFileSync, existsSync } from "fs";
import { join } from "path";
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
export const inertiaMiddleware = (config = {}) => {
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
                ? join(process.cwd(), "resources/views")
                : join(process.cwd(), "dist/views");
            const viewPath = join(viewsDir, rootView);
            let html = `<!DOCTYPE html><html><body><div id="app" data-page="{{it.page}}"></div></body></html>`;
            if (existsSync(viewPath)) {
                html = readFileSync(viewPath, "utf8");
            }
            const title = config.title || process.env.TITLE || "NARA App";
            const pageJson = JSON.stringify(inertiaObject);
            let viteTags = "";
            const isDev = process.env.NODE_ENV === "development";
            const vitePort = process.env.VITE_PORT || 5173;
            if (isDev) {
                viteTags = `
    <script type="module" src="http://localhost:${vitePort}/@vite/client"></script>
    <script type="module" src="http://localhost:${vitePort}/js/app.ts"></script>
        `.trim();
            }
            else {
                const manifestPath = join(process.cwd(), "public/build/.vite/manifest.json");
                if (existsSync(manifestPath)) {
                    try {
                        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
                        const entry = manifest["resources/js/app.ts"];
                        if (entry) {
                            viteTags = `<script type="module" src="/build/${entry.file}"></script>`;
                            if (entry.css) {
                                entry.css.forEach((cssFile) => {
                                    viteTags += `\n    <link rel="stylesheet" href="/build/${cssFile}">`;
                                });
                            }
                        }
                    }
                    catch (e) {
                        console.error("Failed to parse Vite manifest:", e);
                    }
                }
            }
            let rendered = html
                .replace("{{it.title}}", escapeHtml(title))
                .replace("@inertia", `<div id="app" data-page='${pageJson.replace(/'/g, "&#039;")}'></div>`)
                .replace("@vite", viteTags);
            return res.type("html").send(rendered);
        };
        next();
    };
};
export default inertiaMiddleware;
//# sourceMappingURL=middleware.js.map