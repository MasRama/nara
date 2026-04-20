import { defineConfig } from 'vitest/config';
import path from 'path';

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
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
      { find: /^@models\/(.+)$/, replacement: r('app/models/$1') },
      { find: '@models', replacement: r('app/models/index.ts') },
      { find: /^@services\/(.+)$/, replacement: r('app/services/$1') },
      { find: '@services', replacement: r('app/services/index.ts') },
      { find: /^@validators\/(.+)$/, replacement: r('app/validators/$1') },
      { find: '@validators', replacement: r('app/validators/index.ts') },
      { find: /^@middlewares\/(.+)$/, replacement: r('app/middlewares/$1') },
      { find: /^@authorization\/(.+)$/, replacement: r('app/authorization/$1') },
      { find: '@authorization', replacement: r('app/authorization/index.ts') },
      { find: /^@helpers\/(.+)$/, replacement: r('app/helpers/$1') },
      { find: /^@config\/(.+)$/, replacement: r('app/config/$1') },
      { find: '@config', replacement: r('app/config/index.ts') },
      { find: /^@events\/(.+)$/, replacement: r('app/events/$1') },
      { find: '@events', replacement: r('app/events/index.ts') },
      { find: /^@requests\/(.+)$/, replacement: r('app/requests/$1') },
      { find: '@requests', replacement: r('app/requests/index.ts') },
      { find: /^@factories\/(.+)$/, replacement: r('database/factories/$1') },
      { find: '@factories', replacement: r('database/factories/index.ts') },
      { find: '@root/knexfile', replacement: r('knexfile.ts') },
    ],
  },
});
