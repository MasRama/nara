---
authority: canon
---

# Core

> **Authority:** canon — current source of truth for core layer conventions.

The framework foundation: app bootstrap, router, request/response types, error helpers, and response helpers. Everything else builds on this layer.

## Structure

| File | Purpose |
|------|---------|
| `App.ts` | `createApp`, `createWebApp`, `createApiApp` — bootstrap, middleware wiring, auto-migrate, error handler |
| `Router.ts` | `createRouter` — route registration with middleware arrays |
| `response.ts` | `jsonSuccess`, `jsonError`, `jsonCreated`, `jsonPaginated`, `jsonValidationError`, `queryInt`, `queryString` |
| `errors.ts` | `httpError`, `validationError`, `authError`, `notFoundError`, `forbiddenError`, `isNaraError`, `isUniqueConstraintError` |
| `types.ts` | `NaraRequest`, `NaraResponse`, `AuthUser`, `NaraMiddleware`, `NaraHandler`, `RouteMiddlewares` |
| `index.ts` | Barrel export — `@core` alias resolves here |
| `adapters/svelte.ts` | Inertia.js adapter (renderer + page glob) |
| `adapters/types.ts` | `FrontendAdapter` interface |

## Mental Model

```
createApp() / createWebApp()
  │  wires: securityHeaders → requestLogger → requestId → rateLimit → csrf → inputSanitize
  │  mounts: routes (via adapter) → errorHandler
  ▼
Router (Route.get/post/put/delete)
  │  each route: [middleware..., handler]
  ▼
Handler (from app/handlers/)
  │  uses: jsonSuccess/jsonError from response.ts
  │  uses: errors from errors.ts (rarely — helpers cover most cases)
```

## Response Helpers (handlers use these — never construct response objects manually)

| Helper | Status | When |
|--------|--------|------|
| `jsonSuccess(res, msg, data?, meta?)` | 200 | Generic success |
| `jsonCreated(res, msg, data?)` | 201 | After create mutation |
| `jsonPaginated(res, msg, data[], meta)` | 200 | List endpoints |
| `jsonNoContent(res)` | 204 | Empty success |
| `jsonError(res, msg, status, code?, errors?)` | custom | Generic error |
| `jsonUnauthorized(res)` | 401 | No session |
| `jsonForbidden(res)` | 403 | No permission |
| `jsonNotFound(res)` | 404 | Resource missing |
| `jsonValidationError(res, msg, errors)` | 422 | Zod validation failed |
| `jsonServerError(res)` | 500 | Unexpected failure |

See [`.agents/skills/api-contract.md`](../../.agents/skills/api-contract.md) for full response shape contract.

## Query Helpers (pagination)

```typescript
import { queryInt, queryString } from '@core';

const page = queryInt(req, 'page');           // default 1
const limit = queryInt(req, 'limit', 10);     // default 10
const search = queryString(req, 'search');    // default ''
```

Never use `parseInt(req.query.x as string) || 1` — `queryInt` handles parsing + defaults.

## Error Helpers (rarely needed — response helpers cover most cases)

```typescript
import { httpError, isNaraError, isUniqueConstraintError } from '@core';

// Throw a typed error — caught by App error handler, converted to jsonError
throw httpError(404, 'Product not found');

// In a catch block — distinguish SQLite unique constraint from other errors
try { createProduct(...) }
catch (error) {
  if (isUniqueConstraintError(error)) return jsonError(res, 'Name already exists', 409, 'DUPLICATE');
  Logger.error('Failed', error as Error);
  return jsonServerError(res, 'Failed to create product');
}
```

## Conventions

- **Bottom layer** — core may import `@config`, `@services`, `@middlewares`, `@types`, but never `@handlers`, `@queries`, `@validators`
- **No business logic here** — core is infrastructure. Logic lives in handlers/services/queries
- **Bootstrap files** (`App.ts`, `env.ts`, `server.ts`) may use `console.log` — Logger not yet initialized. All other backend files must use Logger (L9, enforced)
- **Error handler** in `App.ts` catches thrown errors and converts to `jsonError` — handlers can `throw httpError(...)` instead of returning, but returning is preferred
- `index.ts` is the `@core` alias target — add new exports here

## When to modify core

- Adding a new response helper (e.g. `jsonAccepted`) → `response.ts` + `index.ts`
- Adding a new error type → `errors.ts` + `index.ts`
- Changing middleware wiring order → `App.ts` (rare — be careful, order matters for security)
- Adding a new adapter (e.g. React) → `adapters/` (rare — ADR 0003 mandates Svelte)

If you find yourself adding business logic here, stop — it belongs in a handler or service.
