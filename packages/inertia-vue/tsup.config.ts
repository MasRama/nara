import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client/app.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['vue', '@inertiajs/vue3', '@nara-web/core', 'vite', '@vitejs/plugin-vue'],
  esbuildOptions(options) {
    options.loader = {
      ...options.loader,
      '.vue': 'empty',
    };
  },
});
