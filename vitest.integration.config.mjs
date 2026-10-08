import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 300_000,
    // Setup hooks run a full production build (~7-11 s), which the 10 s default cannot absorb.
    hookTimeout: 300_000,
  },
});
