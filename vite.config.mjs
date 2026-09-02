import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
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
    vue(),
  ],
  root: 'resources',
  publicDir: '../public',
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
            { name: 'vendor-vue', test: /node_modules[\\/]vue/ },
          ],
        },
      },
    },
  }
});
