---
authority: canon
trigger: Writing handlers that return JSON, handling errors, or writing validation
---

# API Contract & Error Handling

> **Authority:** canon — current source of truth for response shapes, error codes, and error handling patterns.

## Response Shapes

Every JSON endpoint returns one of two shapes. No exceptions.

```typescript
// Success
{ success: true, message: string, data?: T, meta?: ResponseMeta }

// Error
{ success: false, message: string, code?: string, errors?: Record<string, string[]> }
```

Messages: Indonesian for user-facing (ADR 0010).

## Response Helpers (handlers)

Import from `@core`. Use these — never construct response objects manually.

| Helper | Status | Code | When to use |
|---|---|---|---|
| `jsonSuccess(res, msg, data?, meta?, status=200)` | 200 | — | Generic success |
| `jsonCreated(res, msg, data?)` | 201 | — | After create mutation |
| `jsonPaginated(res, msg, data[], meta)` | 200 | — | List endpoints with pagination |
| `jsonNoContent(res)` | 204 | — | Empty success (delete) |
| `jsonError(res, msg, status=400, code?, errors?)` | custom | custom | Generic error |
| `jsonUnauthorized(res)` | 401 | `UNAUTHORIZED` | No session |
| `jsonForbidden(res)` | 403 | `FORBIDDEN` | No permission |
| `jsonNotFound(res)` | 404 | `NOT_FOUND` | Resource missing |
| `jsonValidationError(res, msg, errors)` | 422 | `VALIDATION_ERROR` | Zod validation failed |
| `jsonServerError(res)` | 500 | `INTERNAL_ERROR` | Unexpected failure |

### Pagination meta

```typescript
interface PaginatedMeta {
  total: number; totalPages: number;
  page: number; limit: number;
  hasNext: boolean; hasPrev: boolean;
}
```

## Error Factories (services/deep code)

Import from `@core`. Throw these — they bubble to the global error handler in `App.ts`.

| Factory | Status | Code | When to use |
|---|---|---|---|
| `badRequestError(msg)` | 400 | `BAD_REQUEST` | Malformed input |
| `authError(msg)` | 401 | `AUTH_ERROR` | Auth failure in service |
| `forbiddenError(msg)` | 403 | `FORBIDDEN` | Permission failure in service |
| `notFoundError(msg)` | 404 | `NOT_FOUND` | Resource not found in service |
| `conflictError(msg)` | 409 | `CONFLICT` | Duplicate / state conflict |
| `validationError(errors, msg)` | 422 | `VALIDATION_ERROR` | Validation in service |
| `tooManyRequestsError(msg, retryAfter?)` | 429 | `TOO_MANY_REQUESTS` | Rate limited |
| `internalError(msg)` | 500 | `INTERNAL_ERROR` | Unexpected |

## Error Code Catalog

Don't invent new codes — use these.

| Code | Status | Example |
|---|---|---|
| `UNAUTHORIZED` | 401 | `jsonUnauthorized(res)` |
| `AUTH_ERROR` | 401 | `throw authError()` |
| `FORBIDDEN` | 403 | `jsonForbidden(res)` |
| `NOT_FOUND` | 404 | `jsonNotFound(res)` |
| `BAD_REQUEST` | 400 | `throw badRequestError('Invalid')` |
| `VALIDATION_ERROR` | 422 | `jsonValidationError(res, msg, errors)` |
| `CONFLICT` | 409 | `throw conflictError('Email exists')` |
| `TOO_MANY_REQUESTS` | 429 | `throw tooManyRequestsError('Slow down', 60)` |
| `INTERNAL_ERROR` | 500 | `jsonServerError(res)` |
| `DUPLICATE_EMAIL` | 400 | `jsonError(res, 'Email sudah digunakan', 400, 'DUPLICATE_EMAIL')` |
| `DUPLICATE_ROLE` | 400 | `jsonError(res, 'Role sudah ada', 400, 'DUPLICATE_ROLE')` |
| `RATE_LIMIT_EXCEEDED` | 429 | Auto-set by rateLimit middleware |

## Type Guards

```typescript
isNaraError(error)              // checks __nara === true
isValidationError(error)        // checks code === 'VALIDATION_ERROR'
isUniqueConstraintError(error)  // checks SQLITE_CONSTRAINT_UNIQUE
```

## Two Patterns — When to Use Which

### Pattern A: Return jsonError (handlers)

```typescript
export const editProduct = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  const product = findProductById(req.params.id);
  if (!product) return jsonNotFound(res, 'Produk tidak ditemukan');
  return jsonSuccess(res, 'Produk berhasil diupdate', { product });
};
```

### Pattern B: Throw (services, deep code)

```typescript
export const chargeCard = (amount: number) => {
  if (amount <= 0) throw badRequestError('Amount must be positive');
  if (!gateway.connected) throw internalError('Payment gateway down');
};
```

Global error handler in `App.ts` catches `NaraError` and converts to `ApiErrorResponse`.

## Handler Mutation Pattern (create/update with constraint handling)

```typescript
export const addProduct = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);

  const parsed = CreateProductSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  try {
    const product = createProduct({ id: randomUUID(), ...parsed.data });
    return jsonCreated(res, 'Produk berhasil dibuat', { product });
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return jsonError(res, 'Produk sudah ada', 400, 'DUPLICATE_PRODUCT');
    }
    Logger.error('Failed to create product', error as Error);
    return jsonServerError(res, 'Gagal membuat produk');
  }
};
```

## Validation (Zod)

```typescript
// validators/schemas.ts
export const CreateProductSchema = z.object({
  name: z.string().min(2).max(100),
  price: z.number().positive(),
});

// In JSON handler
const parsed = CreateProductSchema.safeParse(req.body);
if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));
const data = parsed.data; // fully typed

// In Inertia form handler (redirect with error cookie)
const parsed = LoginSchema.safeParse(req.body);
if (!parsed.success) {
  const msg = Object.values(zodToErrors(parsed.error)).flat().join(', ');
  return res.cookie('error', msg, { maxAge: 5000 }).redirect('/login');
}
```

## Frontend Consumption

The `api()` wrapper in `$lib/api` parses these shapes:

```typescript
const result = await api(() => axios.post('/products', payload));
// result.success === true  → result.data is the payload
// result.success === false → result.message is the error, result.errors is validation
```

Toast notifications fire automatically unless `{ showSuccessToast: false }` is passed.

## Do / Don't

- **Do** use `return jsonError()` in handlers for explicit control flow
- **Do** use `throw notFoundError()` in deep services without `res`
- **Do** wrap mutations in `try/catch` for SQLite constraint handling
- **Do** use Zod schemas for all input validation
- **Don't** catch errors in queries — let them bubble to handlers
- **Don't** use `console.log` — use `Logger`
- **Don't** mix languages — Indonesian for user-facing messages
- **Don't** expose internal error details (stack traces, SQL) in responses
