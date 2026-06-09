
import { readFileSync } from "fs";
import path from "path";
import { templateCache } from "@services/CacheStore";
import 'dotenv/config';

function getViewsDirectory() {
   return process.env.NODE_ENV === 'development' ? "resources" : "dist";
}

function loadTemplate(filename: string): string {
   const directory = getViewsDirectory();
   const key = path.join(directory, filename);

   const cached = templateCache.get(key);
   if (cached) return cached;

   const content = readFileSync(key, "utf8");
   templateCache.set(key, content);
   return content;
}

function escapeHtml(value: string): string {
   return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

function escapeJsonForScriptTag(jsonString: string): string {
   // Only escape characters that could break out of <script> tag or cause XSS
   // No need to escape quotes since we're inside a script tag, not an HTML attribute
   return jsonString
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026");
}

export function view(filename: string, view_data?: Record<string, unknown>) {
   const baseTemplate = loadTemplate(filename);
   let html = baseTemplate;

   if (process.env.NODE_ENV === 'development') {
      const viteUrl = `http://localhost:${process.env.VITE_PORT}`;
      html = html.replace(/="(\/[^"]+\.(ts|css))"/g, `="${viteUrl}$1"`);
   }

   if (view_data) {
      if (typeof view_data.title === "string") {
         html = html.replace("{{it.title}}", escapeHtml(view_data.title));
      }

      if (typeof view_data.page === "string") {
          html = html.replace("{{it.page}}", escapeJsonForScriptTag(view_data.page));
      }
   }

   return html;
}
