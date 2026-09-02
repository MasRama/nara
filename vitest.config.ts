import { defineConfig } from 'vitest/config';
import path from 'path';

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
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
