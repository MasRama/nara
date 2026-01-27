import vue from '@vitejs/plugin-vue';
import type { UserConfig } from 'vite';

export interface ViteOptions {
  /**
   * Options for the Vue plugin
   */
  vueOptions?: any;
}

/**
 * Creates a Vite configuration for NARA + Vue 3
 */
export function createViteConfig(options: ViteOptions = {}): UserConfig {
  return {
    plugins: [
      vue(options.vueOptions)
    ],
    resolve: {
      alias: {
        '@': '/resources/js',
      },
    },
    build: {
      outDir: 'public/build',
      manifest: true,
      rollupOptions: {
        input: 'resources/js/app.ts',
      },
    },
  };
}
