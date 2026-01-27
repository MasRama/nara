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

      let rendered = html
        .replace("{{it.title}}", escapeHtml(title))
        .replace("{{it.page}}", escapeHtml(pageJson));

      // Handle Vite dev server asset rewriting if needed
      if (process.env.NODE_ENV === "development") {
        const vitePort = process.env.VITE_PORT || 3000;
        rendered = rendered.replace(
          /\/js\//g,
          `http://localhost:${vitePort}/js/`
        );
      }

      return res.type("html").send(rendered);
    };

    next();
  };
};

export default inertiaMiddleware;
