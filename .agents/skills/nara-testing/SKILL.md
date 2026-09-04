---
name: nara-testing
description: Writing or modifying tests for a feature, Hono route, repository, Vue page, or CLI command
---

# Testing Patterns

## Test layout

Keep tests near the Feature or subsystem they exercise:

```text
src/features/<feature>/tests/   # Feature contracts, repositories, routes, clients
src/app/*.test.ts               # app composition and error handling
src/shared/**/*.test.ts         # shared modules
official-features/<feature>/tests/
tests/v3/                         # cross-cutting frontend, CLI, config, health
```

Use one focused test file per behavior or source module. Add a test when a changed contract or boundary would otherwise be uncovered; do not test incidental implementation details.

## Running tests

During development, run the narrowest affected file:

```bash
npx vitest run src/features/auth/tests/routes.test.ts
npx vitest run tests/v3/frontend.test.ts
npx vitest run tests/v3/
```

Before delivery, run the repository check:

```bash
npm run check
```

The check covers the server typecheck (`lint`), the Vue typecheck (`check:frontend`), the Vitest suite, and `nara doctor` (`architecture:doctor`). Finish with `npm run build` when the change affects production serving.

## Hono route tests

Exercise routes through the app's public HTTP boundary instead of calling private handlers:

```typescript
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { app } from '../../../app/server';

describe('auth route', () => {
  it('rejects malformed input with field diagnostics', async () => {
    const response = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'A',
        email: `${randomUUID()}@example.com`,
        password: 'short',
      }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      errors: { name: expect.any(Array), email: expect.any(Array), password: expect.any(Array) },
    });
  });
});
```

Cover unauthenticated (`401`), unauthorized (`403`), malformed input (`422`), not-found (`404`), conflict, success, and unexpected-error behavior where the route supports them. Assert the public status, response discriminant, stable code, and observable data.

## Repository tests

Repository tests may use the configured in-memory SQLite database. Assert SQL behavior through the public repository function and reset or isolate database state deliberately. Do not mock away the database when the contract is SQL behavior; use a mock only when testing a caller's boundary in isolation.

Test parameter binding, empty collections, pagination boundaries, uniqueness constraints, foreign-key behavior, and transaction rollback when those cases are relevant to the changed repository.

## Vue tests

Mount Vue components with `createApp` in the configured `jsdom` environment. Reset DOM, local storage, browser API stubs, and document classes in `beforeEach`/`afterEach`.

```typescript
import { createApp, nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import App from '../../src/app/App.vue';

it('renders the shell and reacts to a user action', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const application = createApp(App);

  application.mount(container);
  await nextTick();
  expect(container.querySelector('h1')).not.toBeNull();

  application.unmount();
  container.remove();
});
```

Test user-visible output and transitions: loading/disabled state, validation errors, theme persistence, keyboard or click behavior, and cleanup of listeners. Do not assert private Vue internals.

## CLI and architecture tests

CLI tests should invoke the command through its public function or process boundary and assert exit status, stdout/stderr, and filesystem effects. Architecture tests should use real fixture directories and assert the boundary rule they defend.

## Do / Don't

- **Do** test behavior through public Feature, app, or CLI boundaries.
- **Do** keep tests deterministic and isolated from production database files.
- **Do** use Vitest utilities and typed fixtures.
- **Do** assert stable API error codes and response shapes.
- **Do** clean up mounted Vue apps, DOM nodes, and browser globals.
- **Don't** call private route handlers when `app.request()` can exercise the contract.
- **Don't** use production or developer SQLite files in tests.
- **Don't** add assertions for source text or incidental defaults.
- **Don't** rely on test execution order.
