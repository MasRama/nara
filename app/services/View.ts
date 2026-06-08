
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { templateCache } from "@services/CacheStore";
import 'dotenv/config';

function getViewsDirectory() {
   return process.env.NODE_ENV === 'development' ? "resources/views" : "dist/views";
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

function escapeHtmlForJson(jsonString: string): string {
   return jsonString
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
}

export function view(filename: string, view_data?: Record<string, unknown>) {
   const baseTemplate = loadTemplate(filename);
   let html = baseTemplate;

   if (process.env.NODE_ENV === 'development') {
      const files = readdirSync("resources/js");

      for (const asset of files) {
         html = html.replace(
            `/js/${asset}`,
            `http://localhost:${process.env.VITE_PORT}/js/${asset}`
         );
      }
   }

   if (view_data) {
      if (typeof view_data.title === "string") {
         html = html.replace("{{it.title}}", escapeHtml(view_data.title));
      }

      if (typeof view_data.page === "string") {
         html = html.replace("{{it.page}}", escapeHtmlForJson(view_data.page));
      }
   }

   return html;
}
