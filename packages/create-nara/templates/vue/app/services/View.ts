import { readFileSync } from "fs";
import path from "path";

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

function getViteScripts(): string {
   const isDev = process.env.NODE_ENV !== 'production';
   if (isDev) {
      return `
         <script type="module" src="http://localhost:5173/@vite/client"></script>
         <script type="module" src="http://localhost:5173/resources/js/app.ts"></script>
      `;
   }
   // For production, read manifest and generate script tags
   try {
      const manifest = JSON.parse(readFileSync('public/build/.vite/manifest.json', 'utf8'));
      const entry = manifest['resources/js/app.ts'];
      if (entry) {
         return `<script type="module" src="/build/${entry.file}"></script>`;
      }
   } catch {
      // Fallback
   }
   return '';
}

export function view(filename: string, view_data?: any) {
   const baseTemplate = loadTemplate(filename);
   let html = baseTemplate;

   // Replace @vite placeholder with Vite scripts
   html = html.replace('@vite', getViteScripts());

   // Replace @inertia placeholder with inertia root div
   if (view_data?.page) {
      html = html.replace('@inertia', `<div id="app" data-page='${view_data.page}'></div>`);
   } else {
      html = html.replace('@inertia', '<div id="app"></div>');
   }

   // Handle other template variables
   if (view_data) {
      if (typeof view_data.title === "string") {
         html = html.replace("{{it.title}}", escapeHtml(view_data.title));
      }
   }

   return html;
}
