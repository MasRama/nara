import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import devServer, { defaultOptions } from '@hono/vite-dev-server';
import 'dotenv/config';
import { resolve } from 'path';
import { readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const files = readdirSync('resources').filter((file) => file.endsWith('.html'));
const input = {};

for (const filename of files) {
  input[filename.replace('.html', '')] = resolve(__dirname, `resources/${filename}`);
}

const port = Number.parseInt(process.env.PORT ?? '', 10) || 5555;
const nonBackendPath = /^(?!\/(?:api(?:\/|\?|$)|health(?:\/|\?|$)|ready(?:\/|\?|$))).*/;

function applicationRuntime() {
  let stopRuntime;
  return {
    name: 'nara-application-runtime',
    async configureServer(server) {
      const runtime = await server.ssrLoadModule('../src/app/server.ts');
      stopRuntime = runtime.initializeApplicationRuntime().stop;
      server.httpServer?.once('close', () => {
        stopRuntime?.();
        stopRuntime = undefined;
      });
    },
  };
}

export default defineConfig({
  plugins: [
    applicationRuntime(),
    devServer({
      entry: '../src/app/server.ts',
      export: 'app',
      injectClientScript: false,
      // Hono owns only backend/reserved paths in development. Vue browser
      // routes, assets, and Vite HMR remain native Vite requests.
      exclude: [nonBackendPath, ...defaultOptions.exclude],
    }),
    tailwindcss(),
    vue(),
  ],
  root: 'resources',
  publicDir: '../public',
  server: {
    host: '0.0.0.0',
    port,
    strictPort: true,
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
