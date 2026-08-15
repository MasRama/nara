---
trigger: Writing or modifying tests — handler tests, query tests, middleware tests, validator tests
---

# Testing Pattern


## When to use

When adding a new handler/query/middleware/validator and you need to write tests that match the existing pattern. Also when fixing a failing test or extending coverage.

## File layout (mirrors app/)

```
tests/
├── conventions.test.ts     # Structural conventions (AGENTS.md presence, skills index)
├── core/                   # Router, response helpers, errors
├── handlers/{name}.test.ts # Mock @queries + assert response shape
├── queries/{name}.test.ts  # Mock @services/SQLite + assert SQL called
├── middlewares/            # csrf, rateLimit, requestId, securityHeaders
├── services/               # CacheStore, Logger, LoginThrottle, etc
├── validators/             # Zod schemas + zodToErrors
└── helpers/mocks.ts        # mockRequest, mockResponse, mockUser, runMiddleware
```

Rule: one test file per source file. Name `{name}.test.ts` matching the source.

## Running tests (smart, not brute)

```bash
# During development — run ONLY the file for the layer you touched
npx vitest run tests/handlers/products.test.ts
npx vitest run tests/queries/products.test.ts
npx vitest run tests/core/
npx vitest run tests/middlewares/

# Before commit — full suite
npm run check    # lint + layer lint + tests
```

Do NOT run `npm test` on every change — it runs the full suite and burns context budget parsing irrelevant results.

## Mock helpers (always use these)

```typescript
import { mockRequest, mockResponse, mockUser, runMiddleware } from '../helpers/mocks';

const req = mockRequest({ user: mockUser(), params: { id: '123' }, body: { name: 'Test' } });
const res = mockResponse();
const user = mockUser({ id: 'custom-id', email: 'custom@test.com' });
```

Never construct mock req/res inline — use the factories so test shape stays consistent.

## Handler test pattern (mock @queries, NOT SQLite)

Handlers depend on queries, not the database. Mock `@queries` and any `@services/*` the handler imports. Assert on `_status` and `_body`.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockRequest, mockResponse, mockUser } from '../helpers/mocks';

// 1. Mock @queries — handlers never touch SQLite directly
vi.mock('@queries', () => ({
  getProductsPaginated: vi.fn(() => ({ data: [], total: 0 })),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProducts: vi.fn(),
  isAdmin: vi.fn(() => false),
  hasPermission: vi.fn(() => false),
}));

// 2. Mock @services/* the handler imports (Logger, Authenticate, etc)
vi.mock('@services/Logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// 3. IMPORTS MUST COME AFTER vi.mock — Vitest hoists mocks, but keep this order for clarity
import { addProduct, editProduct, removeProducts } from '../../app/handlers/products';
import { createProduct, isAdmin, hasPermission } from '@queries';

describe('products handler', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('addProduct', () => {
    it('returns 401 if no user', () => {
      const req = mockRequest({ body: { name: 'Widget', price: 100 } });
      const res = mockResponse();
      addProduct(req as any, res as any);
      expect(res._status).toBe(401);
      expect(res._body).toMatchObject({ success: false, message: 'Unauthorized' });
    });

    it('returns 403 if user lacks permission and is not admin', () => {
      const req = mockRequest({ user: mockUser(), body: { name: 'Widget', price: 100 } });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(false);
      (hasPermission as any).mockReturnValue(false);
      addProduct(req as any, res as any);
      expect(res._status).toBe(403);
    });

    it('creates product on happy path', () => {
      const req = mockRequest({ user: mockUser(), body: { name: 'Widget', price: 100 } });
      const res = mockResponse();
      (isAdmin as any).mockReturnValue(true);
      (createProduct as any).mockReturnValue({ id: 'p1', name: 'Widget', price: 100 });
      addProduct(req as any, res as any);
      expect(res._status).toBe(201);
      expect(res._body).toMatchObject({ success: true, message: 'Product created' });
    });
  });
});
```

### Coverage checklist for a handler

1. **Auth guard** — no `req.user` → 401
2. **Permission guard** — non-admin without permission → 403
3. **Validation** — invalid body → 422 with `errors` object
4. **Happy path** — valid input → 200/201 with `data`
5. **Self-protection** (users only) — user A editing user B without admin → 403
6. **Error path** — query throws → 500 (mock the query to throw)

## Query test pattern (mock SQLite, assert SQL called)

Queries are the only layer that touches SQLite. Mock `@services/SQLite` and assert the right method was called with the right SQL/params. Do NOT test business logic here — that lives in handlers.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@services/SQLite', () => ({
  default: {
    one: vi.fn(),
    many: vi.fn(),
    exec: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn((fn) => fn()),
    raw: vi.fn(),
  },
}));

import SQLite from '@services/SQLite';
import { findProductById, createProduct, getProductsPaginated, deleteProducts } from '../../app/queries/products';

describe('products queries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('findProductById calls SQLite.one with SELECT', () => {
    (SQLite.one as any).mockReturnValue({ id: '1', name: 'Widget' });
    findProductById('1');
    expect(SQLite.one).toHaveBeenCalled();
  });

  it('getProductsPaginated uses LIKE with %search% pattern', () => {
    (SQLite.get as any).mockReturnValue({ count: 0 });
    (SQLite.all as any).mockReturnValue([]);
    getProductsPaginated(1, 10, 'wid');
    expect(SQLite.all).toHaveBeenCalled();
    const args = (SQLite.all as any).mock.calls[0];
    expect(args[1]).toEqual(['%wid%', 10, 0]); // pattern, limit, offset
  });

  it('deleteProducts builds IN-clause with one placeholder per id', () => {
    deleteProducts(['a', 'b', 'c']);
    const sql = (SQLite.run as any).mock.calls[0][0];
    expect(sql).toContain('?,?,?');
    expect((SQLite.run as any).mock.calls[0][1]).toEqual(['a', 'b', 'c']);
  });
});
```

## Middleware test pattern (use runMiddleware)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockRequest, mockResponse, runMiddleware } from '../helpers/mocks';
import { requestId } from '../../app/middlewares/requestId';

describe('requestId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds requestId to request and calls next', async () => {
    const req = mockRequest();
    const { nextCalled } = await runMiddleware(requestId(), req);
    expect(nextCalled).toBe(true);
    expect(req.requestId).toBeDefined();
  });
});
```

## Validator test pattern (no mocks — pure functions)

```typescript
import { describe, it, expect } from 'vitest';
import { CreateProductSchema } from '../../app/validators/schemas';
import { zodToErrors } from '../../app/validators';

describe('CreateProductSchema', () => {
  it('accepts valid input', () => {
    const result = CreateProductSchema.safeParse({ name: 'Widget', price: 100 });
    expect(result.success).toBe(true);
  });

  it('rejects negative price', () => {
    const result = CreateProductSchema.safeParse({ name: 'Widget', price: -1 });
    expect(result.success).toBe(false);
  });

  it('zodToErrors maps issues to field-keyed object', () => {
    const result = CreateProductSchema.safeParse({ name: '', price: -1 });
    if (!result.success) {
      const errors = zodToErrors(result.error);
      expect(errors).toHaveProperty('name');
    }
  });
});
```

## Convention test (structural — edit when adding new AGENTS.md or skill)

`tests/conventions.test.ts` asserts structural invariants that `lint:layers` cannot check:
- Every documented directory has an `AGENTS.md`
- Every skill referenced in `.agents/skills/SKILL.md` exists

When you add a new AGENTS.md or skill, add it to the expected list in this file.

## Do / Don't

- **Do** use `mockRequest`/`mockResponse`/`mockUser` from `tests/helpers/mocks.ts`
- **Do** mock `@queries` in handler tests — never `@services/SQLite`
- **Do** mock `@services/SQLite` in query tests — never `@queries`
- **Do** put `vi.mock(...)` calls before imports (Vitest hoists them anyway, but order is convention)
- **Do** use `beforeEach(() => vi.clearAllMocks())` to reset between cases
- **Do** assert on `_status` and `_body` for handler tests, on `SQLite.*.mock.calls` for query tests
- **Don't** hit a real database in any test — every test must be hermetic
- **Don't** write tests that depend on execution order
- **Don't** mock what you don't own (mock `@queries`, not `zod`)
- **Don't** skip the auth-guard test case — it is the most common regression
