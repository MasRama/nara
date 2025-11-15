/**
 * Minimal View Service for SPA shell
 * ---------------------------------
 * Loads HTML files from the views directory (mainly inertia.html)
 * and performs simple string replacements instead of using a
 * templating engine like Squirrelly.
 */

import { readFileSync, readdirSync } from "fs";
import path from "path";
require("dotenv").config();

const templateCache: { [key: string]: string } = {};

function getViewsDirectory() {
   return process.env.NODE_ENV === 'development' ? "resources/views" : "dist/views";
}

function loadTemplate(filename: string): string {
   const directory = getViewsDirectory();
   const key = path.join(directory, filename);

   if (!templateCache[key]) {
      templateCache[key] = readFileSync(key, "utf8");
   }

   return templateCache[key];
}

function escapeHtml(value: string): string {
   return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
}

/**
 * Renders a basic HTML file with provided data.
 * Currently used for `inertia.html` as the SPA shell.
 */
export function view(filename: string, view_data?: any) {
   const baseTemplate = loadTemplate(filename);
   let html = baseTemplate;

   // In development, rewrite JS asset URLs to Vite dev server
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
         html = html.replace("{{it.page}}", escapeHtml(view_data.page));
      }
   }

   return html;
}
