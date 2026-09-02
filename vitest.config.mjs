import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const r = (p) => path.resolve(fileURLToPath(new URL('.', import.meta.url)), p);

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/v3/setup.ts'],
    include: ['tests/v3/**/*.test.ts', 'src/**/*.test.ts', 'official-features/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'official-features/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'official-features/**/*.test.ts'],
    },
  },
  resolve: {
    alias: [
      { find: /^@app\/(.+)$/, replacement: r('src/app/$1') },
      { find: /^@features\/(.+)$/, replacement: r('src/features/$1') },
      { find: /^@shared\/(.+)$/, replacement: r('src/shared/$1') },
      { find: /^@\/(.+)$/, replacement: r('src/$1') },
    ],
  },
});
