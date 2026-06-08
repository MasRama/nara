import { defineConfig } from 'vitest/config';
import path from 'path';

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'resources/js/lib/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['app/**/*.ts'],
      exclude: ['app/**/*.d.ts'],
    },
  },
  resolve: {
    alias: [
      { find: /^@core\/(.+)$/, replacement: r('app/core/$1') },
      { find: '@core', replacement: r('app/core/index.ts') },
      { find: /^@handlers\/(.+)$/, replacement: r('app/handlers/$1') },
      { find: '@handlers', replacement: r('app/handlers/index.ts') },
      { find: /^@queries\/(.+)$/, replacement: r('app/queries/$1') },
      { find: '@queries', replacement: r('app/queries/index.ts') },
      { find: /^@services\/(.+)$/, replacement: r('app/services/$1') },
      { find: '@services', replacement: r('app/services/index.ts') },
      { find: /^@validators\/(.+)$/, replacement: r('app/validators/$1') },
      { find: '@validators', replacement: r('app/validators/index.ts') },
      { find: /^@middlewares\/(.+)$/, replacement: r('app/middlewares/$1') },
      { find: /^@config\/(.+)$/, replacement: r('app/config/$1') },
      { find: '@config', replacement: r('app/config/index.ts') },
      { find: /^@events\/(.+)$/, replacement: r('app/events/$1') },
      { find: '@events', replacement: r('app/events/index.ts') },
      { find: '@types', replacement: r('app/types/models.ts') },
      { find: /^@types\/(.+)$/, replacement: r('app/types/$1') },
      { find: '@root/knexfile', replacement: r('knexfile.ts') },
      { find: /^@\/(.+)$/, replacement: r('app/$1') },
      { find: /^\$lib\/(.+)$/, replacement: r('resources/js/lib/$1') },
      { find: '$lib', replacement: r('resources/js/lib') },
    ],
  },
});
