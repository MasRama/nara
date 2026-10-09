process.env.NODE_ENV = 'test';
process.env.DB_FILE = ':memory:';

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', { configurable: true, value: () => undefined });
}

// Load after test environment assignment so shared config selects :memory:.
const { migrate } = await import('../../src/shared/database');
migrate();
// Isolate rate-limiter buckets and login lockout between tests so suites are
// deterministic. Middleware still runs with production-equivalent logic.
const { resetSecurityState } = await import('../../src/app/server');
// Startup writes the permissions Feature bindings declared; tests do the same.
const { syncDeclaredPermissions } = await import('../../src/features/auth');
syncDeclaredPermissions();
const { beforeEach } = await import('vitest');
beforeEach(() => {
  resetSecurityState();
});
