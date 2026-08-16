import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import 'dotenv/config'
import { resolve } from 'path'
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

// Default port from environment or fallback to 5173 (matches constants + .env.example)
const PORT = parseInt(process.env.VITE_PORT) || 5173;
 
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    svelte({
      compilerOptions: {
        runes: true,
      },
    }),
  ],
  root: 'resources',
  resolve: {
    alias: {
      '$lib': resolve(__dirname, 'resources/lib'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: PORT,
    strictPort: true // Don't allow Vite to automatically try the next available port
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    minify: 'oxc',
    cssCodeSplit: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: input,
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-svelte', test: /node_modules[\\/]svelte/ },
            { name: 'vendor-inertia', test: /node_modules[\\/]@inertiajs/ },
            { name: 'vendor-bits-ui', test: /node_modules[\\/]bits-ui/ },
            { name: 'vendor-utils', test: /node_modules[\\/]@lucide/ },
          ],
        },
      },
    },
  }
});
