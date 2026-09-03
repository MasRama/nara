import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import 'dotenv/config';
import { resolve } from 'path';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const files = readdirSync("resources").filter(f => f.endsWith('.html'));

let input = {};

for (const filename of files) {
  input[filename.replace(".html", "")] = resolve(__dirname, `resources/${filename}`);
}

const vitePort = Number.parseInt(process.env.VITE_PORT ?? '', 10) || 5173;
const serverPort = Number.parseInt(process.env.PORT ?? '', 10) || 5555;
const serverOrigin = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  plugins: [
    tailwindcss(),
    vue(),
  ],
  root: 'resources',
  publicDir: '../public',
  server: {
    host: '0.0.0.0',
    port: vitePort,
    strictPort: true,
    // Dev HTML is served by Vite, not Hono: Hono security headers cover only
    // proxied /api, /health, and /ready responses here. Production
    // (npm run build && npm start) is authoritative for page headers; adding
    // Vite CSP here would duplicate policy machinery and risk breaking HMR.
    proxy: {
      '/api': { target: serverOrigin },
      '/health': { target: serverOrigin },
      '/ready': { target: serverOrigin },
    },
  },
  build: {
    outDir: '../build/client',
    emptyOutDir: true,
    minify: 'oxc',
    cssCodeSplit: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input,
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-vue', test: /node_modules[\\/]vue/ },
          ],
        },
      },
    },
  },
});
