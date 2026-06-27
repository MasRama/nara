---
authority: canon
trigger: Writing handlers that return JSON, or handling errors in services
---

# API Response Contract & Error Catalog

> **Authority:** canon — current source of truth for response shapes and error codes.

## Response Shapes

Every JSON endpoint returns one of two shapes. No exceptions.

### Success

```typescript
{
  success: true,
  message: string,           // human-readable, Indonesian for user-facing (ADR 0010)
  data?: T,                  // the payload (omit for 204)
  meta?: ResponseMeta        // optional metadata (pagination, counts, etc)
}
```

### Error

```typescript
{
  success: false,
  message: string,           // human-readable, Indonesian for user-facing (ADR 0010)
  code?: string,             // machine-readable error code (see catalog below)
  errors?: Record<string, string[]>  // validation errors: { field: ['message'] }
}
```

## Response Helpers (handlers)

Import from `@core`. Use these — never construct response objects manually.

| Helper | Status | Code | When to use |
|---|---|---|---|
| `jsonSuccess(res, msg, data?, meta?, status=200)` | 200 | — | Generic success |
| `jsonCreated(res, msg, data?)` | 201 | — | After create mutation |
| `jsonPaginated(res, msg, data[], meta)` | 200 | — | List endpoints with pagination |
| `jsonNoContent(res)` | 204 | — | Empty success (delete with no response body) |
| `jsonError(res, msg, status=400, code?, errors?)` | custom | custom | Generic error |
| `jsonUnauthorized(res)` | 401 | `UNAUTHORIZED` | No session / invalid session |
| `jsonForbidden(res)` | 403 | `FORBIDDEN` | Authenticated but no permission |
| `jsonNotFound(res)` | 404 | `NOT_FOUND` | Resource doesn't exist |
| `jsonValidationError(res, msg, errors)` | 422 | `VALIDATION_ERROR` | Zod validation failed |
| `jsonServerError(res)` | 500 | `INTERNAL_ERROR` | Unexpected failure |

### Pagination meta shape

```typescript
interface PaginatedMeta {
  total: number;       // total items across all pages
  page: number;        // current page (1-based)
  limit: number;       // items per page
  totalPages: number;  // Math.ceil(total / limit)
  hasNext: boolean;    // page * limit < total
  hasPrev: boolean;    // page > 1
}
```

## Error Factories (services/deep code)

Import from `@core`. Throw these — they bubble to the global error handler in `App.ts`.

| Factory | Status | Code | When to use |
|---|---|---|---|
| `httpError(msg, status=500, code='HTTP_ERROR')` | custom | custom | Generic |
| `badRequestError(msg='Bad Request')` | 400 | `BAD_REQUEST` | Malformed input |
| `authError(msg='Unauthorized')` | 401 | `AUTH_ERROR` | Auth failure in service |
| `forbiddenError(msg='Forbidden')` | 403 | `FORBIDDEN` | Permission failure in service |
| `notFoundError(msg='Not Found')` | 404 | `NOT_FOUND` | Resource not found in service |
| `conflictError(msg='Conflict')` | 409 | `CONFLICT` | Duplicate / state conflict |
| `validationError(errors, msg='Validation failed')` | 422 | `VALIDATION_ERROR` | Validation in service |
| `tooManyRequestsError(msg, retryAfter?)` | 429 | `TOO_MANY_REQUESTS` | Rate limited |
| `internalError(msg='Internal Server Error')` | 500 | `INTERNAL_ERROR` | Unexpected |

### Type guards

```typescript
isNaraError(error)          // checks __nara === true
isValidationError(error)    // checks code === 'VALIDATION_ERROR'
isUniqueConstraintError(error)  // checks SQLITE_CONSTRAINT_UNIQUE
```

## Error Code Catalog

All codes used across the codebase. Use these — don't invent new ones.

| Code | Status | Meaning | Example |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | No session | `jsonUnauthorized(res)` |
| `AUTH_ERROR` | 401 | Auth failure in service | `throw authError()` |
| `FORBIDDEN` | 403 | No permission | `jsonForbidden(res)` |
| `NOT_FOUND` | 404 | Resource missing | `jsonNotFound(res)` |
| `BAD_REQUEST` | 400 | Malformed input | `throw badRequestError('Invalid JSON')` |
| `VALIDATION_ERROR` | 422 | Zod validation failed | `jsonValidationError(res, msg, errors)` |
| `CONFLICT` | 409 | Duplicate / state conflict | `throw conflictError('Email exists')` |
| `TOO_MANY_REQUESTS` | 429 | Rate limited | `throw tooManyRequestsError('Slow down', 60)` |
| `INTERNAL_ERROR` | 500 | Unexpected failure | `jsonServerError(res)` |
| `DUPLICATE_EMAIL` | 400 | Email already registered | `jsonError(res, 'Email sudah digunakan', 400, 'DUPLICATE_EMAIL')` |
| `DUPLICATE_ROLE` | 400 | Role name/slug already exists | `jsonError(res, 'Role sudah ada', 400, 'DUPLICATE_ROLE')` |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit middleware | Auto-set by rateLimit middleware |

## Two Patterns — When to Use Which

### Pattern A: Return jsonError (handlers)

Use in handlers — explicit control flow, caller sees the error immediately.

```typescript
export const editProduct = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  const product = findProductById(req.params.id);
  if (!product) return jsonNotFound(res, 'Produk tidak ditemukan');
  // ... happy path
  return jsonSuccess(res, 'Produk berhasil diupdate', { product });
};
```

### Pattern B: Throw (services, deep code)

Use in services / code far from handler — bubbles to global error handler.

```typescript
// services/Payment.ts
export const chargeCard = (amount: number) => {
  if (amount <= 0) throw badRequestError('Amount must be positive');
  if (!gateway.connected) throw internalError('Payment gateway down');
  // ...
};
```

The global error handler in `App.ts` catches `NaraError` and converts to `ApiErrorResponse` automatically.

## Frontend Consumption

The `api()` wrapper in `$lib/api` parses these shapes:

```typescript
const result = await api(() => axios.post('/products', payload));
// result.success === true  → result.data is the payload
// result.success === false → result.message is the error, result.errors is validation
```

Toast notifications fire automatically on success/error unless `{ showSuccessToast: false }` is passed.
