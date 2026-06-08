# Tests

Unit tests using **Vitest**. Mirror `app/` structure.

## Structure

```
tests/
├── core/          # Router, response helpers, errors
├── events/        # Event system
├── middlewares/   # csrf, rateLimit, requestId, securityHeaders
├── services/      # CacheStore, etc.
├── validators/    # Zod schemas
└── helpers/       # Mock factories (mocks.ts)
```

## Running Tests

```bash
npm run test           # Run all
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage
```

## Test Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { someFunction } from '../../app/module/someFunction';

describe('someFunction', () => {
  it('returns expected result', () => {
    const result = someFunction(input);
    expect(result).toBe(expected);
  });

  it('handles edge case', () => {
    expect(() => someFunction(badInput)).toThrow();
  });
});
```

## Testing Response Helpers

```typescript
import { jsonSuccess, jsonError, jsonNotFound } from '../../app/core/response';

describe('jsonSuccess', () => {
  it('returns success response', () => {
    const res = mockResponse();
    jsonSuccess(res as any, 'OK', { id: '1' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'OK', data: { id: '1' } });
  });
});
```

## Testing Middleware

```typescript
import { requestId } from '../../app/middlewares/requestId';

describe('requestId', () => {
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

## Testing Validators

```typescript
import { CreateUserSchema } from '../../app/validators/schemas';
import { zodToErrors } from '../../app/validators';

describe('CreateUserSchema', () => {
  it('validates correct data', () => {
    const result = CreateUserSchema.safeParse({ name: 'John', email: 'john@test.com' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = CreateUserSchema.safeParse({ name: 'John', email: 'invalid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = zodToErrors(result.error);
      expect(errors).toHaveProperty('email');
    }
  });
});
```

## Mock Helpers

Use centralized factories from `tests/helpers/mocks.ts`:

```typescript
import { mockRequest, mockResponse, mockUser } from '../helpers/mocks';

const req = mockRequest({ user: mockUser(), params: { id: '123' }, body: { name: 'Test' } });
const res = mockResponse();
const user = mockUser({ id: 'custom-id', email: 'custom@test.com' });
```

## Conventions

- **File naming**: `{name}.test.ts` — matches the source file
- **Directory**: Mirror `app/` structure in `tests/`
- **Imports**: Use relative paths in tests for clarity
- **Mocks**: Use `tests/helpers/mocks.ts` factories
- **No real database**: Tests should NOT hit SQLite — mock queries
- **Async**: Use `async/await` for async code
- **Frontend tests**: Located in `resources/js/lib/__tests__/`
