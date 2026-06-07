# Tests

**Related docs:**
- [`../AGENTS.md`](../AGENTS.md) - Root project knowledge base
- [`../app/AGENTS.md`](../app/AGENTS.md) - Module overview (what to test)
- [`../app/core/AGENTS.md`](../app/core/AGENTS.md) - Core classes being tested
- [`../vitest.config.ts`](../vitest.config.ts) - Vitest configuration

## Overview

Unit tests using **Vitest** framework. Tests are organized by module, mirroring the `app/` structure.

## Structure

```
tests/
├── core/                    # Core module tests
│   ├── BaseController.test.ts
│   ├── Router.test.ts
│   ├── FormRequest.test.ts
│   ├── response.test.ts
│   └── errors.test.ts
├── events/                  # Event system tests
│   ├── Event.test.ts
│   └── EventDispatcher.test.ts
├── middlewares/             # Middleware tests
│   ├── csrf.test.ts
│   ├── rateLimit.test.ts
│   ├── requestId.test.ts
│   └── securityHeaders.test.ts
├── services/                # Service tests
│   ├── CacheStore.test.ts
│   └── Paginator.test.ts
├── validators/              # Validator tests
│   ├── validate.test.ts
│   └── schemas.test.ts
└── helpers/                 # Test utilities
    └── mocks.ts             # Mock factories
```

## Running Tests

```bash
# Run all tests
npm run test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

## Test Pattern

All tests follow this pattern:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SomeClass } from '../../app/module/SomeClass';
import { mockRequest, mockResponse, mockUser } from '../helpers/mocks';

describe('SomeClass', () => {
  let instance: SomeClass;

  beforeEach(() => {
    instance = new SomeClass();
  });

  describe('methodName', () => {
    it('does something when condition is met', () => {
      const result = instance.methodName(input);
      expect(result).toBe(expected);
    });

    it('throws Error when condition is not met', () => {
      expect(() => instance.methodName(badInput)).toThrow(ErrorType);
    });
  });
});
```

## Mock Helpers

Use the centralized mock factory in `tests/helpers/mocks.ts`:

```typescript
import { mockRequest, mockResponse, mockUser } from '../helpers/mocks';

// Create mock request
const req = mockRequest({
  user: mockUser(),           // Authenticated user
  params: { id: '123' },      // Route params
  query: { page: '1' },       // Query string
  body: { name: 'Test' },     // Request body
});

// Create mock response
const res = mockResponse();

// Create mock user
const user = mockUser({
  id: 'custom-id',
  email: 'custom@test.com',
  is_admin: true,
});
```

## Testing Controllers

Controllers extend `BaseController`. Create a test subclass to expose protected methods:

```typescript
class TestController extends BaseController {
  public testRequireAuth(req: NaraRequest) {
    this.requireAuth(req);
  }

  public async testGetBody<T>(req: NaraRequest, schema: Validator<T>) {
    return this.getBody(req, schema);
  }
}

describe('BaseController', () => {
  let controller: TestController;

  beforeEach(() => {
    controller = new TestController();
  });

  it('requires auth', () => {
    const req = mockRequest(); // no user
    expect(() => controller.testRequireAuth(req as any)).toThrow(AuthError);
  });
});
```

## Testing Validators

Validators are pure functions — test them directly:

```typescript
import { isString, isEmail } from '../../app/validators/validate';
import { CreateUserSchema } from '../../app/validators/schemas';

describe('isEmail', () => {
  it('validates correct emails', () => {
    expect(isEmail('user@example.com')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isEmail('notanemail')).toBe(false);
  });
});

describe('CreateUserSchema', () => {
  it('returns success for valid data', () => {
    const result = CreateUserSchema({ name: 'John', email: 'john@test.com' });
    expect(result.success).toBe(true);
  });

  it('returns errors for invalid data', () => {
    const result = CreateUserSchema({ name: '', email: 'invalid' });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveProperty('name');
  });
});
```

## Testing Middleware

Middleware tests use mock request/response and check side effects:

```typescript
import { requestId } from '../../app/middlewares/requestId';

describe('requestId middleware', () => {
  it('adds requestId to request', () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    const middleware = requestId();
    middleware(req as any, res as any, next);

    expect(req.requestId).toBeDefined();
    expect(next).toHaveBeenCalled();
  });
});
```

## Conventions

- **File naming**: `{ModuleName}.test.ts` — matches the source file
- **Directory structure**: Mirror `app/` structure in `tests/`
- **Imports**: Use relative paths from tests (not aliases) for clarity
- **Mock data**: Always use `tests/helpers/mocks.ts` factories
- **Assertions**: Use `expect()` with descriptive matchers
- **Test isolation**: Use `beforeEach()` to reset state
- **Async tests**: Use `async/await` or `vi.waitFor()` for async code
- **No database**: Tests should NOT hit real database — use mocks
- **Frontend tests**: Located in `resources/js/lib/__tests__/`

## Path Aliases in Tests

Vitest config (`vitest.config.ts`) maps path aliases automatically:

| Alias | Resolves To |
|-------|-------------|
| `@core` | `app/core/index.ts` |
| `@models` | `app/models/index.ts` |
| `@services` | `app/services/index.ts` |
| `@validators` | `app/validators/index.ts` |
| `$lib` | `resources/js/lib` |

However, prefer relative imports in tests for clarity:
```typescript
// ✅ Preferred in tests
import { BaseController } from '../../app/core/BaseController';

// ❌ Works but less clear where it comes from
import { BaseController } from '@core';
```

## Adding New Tests

1. Create test file: `tests/{module}/{Name}.test.ts`
2. Import from source using relative paths
3. Use mock helpers from `tests/helpers/mocks.ts`
4. Follow the describe/it/expect pattern
5. Run with `npm run test` to verify

## Coverage

Coverage is tracked for `app/**/*.ts` files:

```bash
npm run test:coverage
```

Target areas for testing:
- ✅ Core classes (BaseController, Router, errors)
- ✅ Validators (pure functions, easy to test)
- ✅ Middleware (request/response transformations)
- ✅ Services (business logic)
- ⚠️ Models (require database mocking)
- ⚠️ Controllers (require full request mocking)
