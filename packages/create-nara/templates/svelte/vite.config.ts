import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const vitePort = parseInt(env.VITE_PORT || '5173');

  return {
    plugins: [svelte(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './resources/js')
      }
    },
    server: {
      port: vitePort,
      strictPort: false,
    },
    build: {
      manifest: true,
      outDir: 'public/build',
      rollupOptions: {
        input: 'resources/js/app.ts'
      }
    }
  };
});
