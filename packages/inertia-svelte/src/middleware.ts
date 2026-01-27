import type { NaraRequest, NaraResponse } from "@nara-web/core";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface InertiaConfig {
  version?: string;
  rootView?: string;
  title?: string;
}

/**
 * Basic HTML escape function for attributes
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Inertia.js Middleware
 */
export const inertiaMiddleware = (config: InertiaConfig = {}) => {
  const version = config.version || "1.0.0";
  const rootView = config.rootView || "inertia.html";

  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    res.inertia = async (
      component: string,
      inertiaProps: Record<string, unknown> = {},
      viewProps: Record<string, unknown> = {}
    ) => {
      const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

      // Build props object
      const props = {
        user: req.user || {},
        ...inertiaProps,
        ...viewProps,
        error: req.cookies?.error || null,
      };

      // Clear error cookie if it exists
      if (req.cookies?.error) {
        res.cookie("error", "", 0);
      }

      const inertiaObject = {
        component,
        props,
        url,
        version,
      };

      // Handle XHR Inertia request
      if (req.header("X-Inertia")) {
        res.setHeader("Vary", "Accept");
        res.setHeader("X-Inertia", "true");
        res.setHeader("X-Inertia-Version", version);
        return res.json(inertiaObject);
      }

      // Handle full page load
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

      // Handle @vite directive
      let viteTags = "";
      const isDev = process.env.NODE_ENV === "development";
      const vitePort = process.env.VITE_PORT || 5173;

      if (isDev) {
        viteTags = `
    <script type="module" src="http://localhost:${vitePort}/@vite/client"></script>
    <script type="module" src="http://localhost:${vitePort}/resources/js/app.ts"></script>
        `.trim();
      } else {
        const manifestPath = join(process.cwd(), "public/build/.vite/manifest.json");
        if (existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
            const entry = manifest["resources/js/app.ts"];

            if (entry) {
              viteTags = `<script type="module" src="/build/${entry.file}"></script>`;
              if (entry.css) {
                entry.css.forEach((cssFile: string) => {
                  viteTags += `\n    <link rel="stylesheet" href="/build/${cssFile}">`;
                });
              }
            }
          } catch (e) {
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
