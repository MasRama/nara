import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const r = (p) => path.resolve(fileURLToPath(new URL('.', import.meta.url)), p);

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'tooling',
          environment: 'node',
          include: ['src/cli/**/*.test.ts'],
          exclude: [
            'src/cli/evolution/transition-executable.test.ts',
            'src/cli/evolution/transition.test.ts',
            'src/cli/tests/diff.test.ts',
            'src/cli/tests/guard.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'pure',
          environment: 'node',
          include: [
            'tests/v3/cli-failure-paths.test.ts',
            'tests/v3/config.test.ts',
            'tests/v3/errors.test.ts',
            'tests/v3/official-users-parity.test.ts',
            'tests/v3/removed-stack.test.ts',
            'src/features/auth/tests/migrations.test.ts',
            'official-features/audit/tests/audit.test.ts',
            'official-features/health/tests/health.test.ts',
            'official-features/users/tests/host.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'node',
          setupFiles: ['tests/v3/setup.ts'],
          include: [
            'tests/v3/**/*.test.ts',
            'src/app/**/*.test.ts',
            'src/features/**/*.test.ts',
            'src/shared/**/*.test.ts',
            'official-features/**/*.test.ts',
          ],
          exclude: [
            'tests/v3/bootstrap-admin.test.ts',
            'tests/v3/build-artifacts.test.ts',
            'tests/v3/cli-failure-paths.test.ts',
            'tests/v3/config.test.ts',
            'tests/v3/database-lifecycle.test.ts',
            'tests/v3/errors.test.ts',
            'tests/v3/frontend-build.test.ts',
            'tests/v3/frontend.test.ts',
            'tests/v3/official-users-parity.test.ts',
            'tests/v3/removed-stack.test.ts',
            'tests/v3/vite-topology.test.ts',
            'src/app/router.test.ts',
            'src/shared/i18n/tests/runtime.test.ts',
            'src/features/activity/tests/browser.test.ts',
            'src/features/auth/tests/browser.test.ts',
            'src/features/auth/tests/client.test.ts',
            'src/features/auth/tests/migrations.test.ts',
            'src/features/auth/tests/rbac-browser.test.ts',
            'src/features/users/tests/browser.test.ts',
            'official-features/audit/tests/audit.test.ts',
            'official-features/health/tests/health.test.ts',
            'official-features/users/tests/host.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          environment: 'jsdom',
          setupFiles: ['tests/v3/setup.ts'],
          include: [
            'tests/v3/frontend.test.ts',
            'src/app/router.test.ts',
            'src/features/auth/tests/browser.test.ts',
            'src/features/auth/tests/client.test.ts',
            'src/features/auth/tests/rbac-browser.test.ts',
            'src/features/activity/tests/browser.test.ts',
            'src/shared/i18n/tests/runtime.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration-node',
          environment: 'node',
          include: [
            'src/cli/evolution/transition.test.ts',
            'src/cli/tests/diff.test.ts',
            'src/cli/tests/guard.test.ts',
            'tests/v3/frontend-build.test.ts',
            'tests/v3/vite-topology.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration-browser',
          environment: 'jsdom',
          setupFiles: ['tests/v3/setup.ts'],
          include: ['src/features/users/tests/browser.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'heavy',
          environment: 'node',
          setupFiles: ['tests/v3/setup.ts'],
          include: [
            'tests/v3/bootstrap-admin.test.ts',
            'tests/v3/build-artifacts.test.ts',
            'tests/v3/database-lifecycle.test.ts',
            'src/cli/evolution/transition-executable.test.ts',
          ],
        },
      },
    ],
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
