---
authority: canon
---

# Middlewares

> **Authority:** canon — current source of truth for middleware layer conventions.

Request middlewares — run before handlers. Each is a function `(req, res, next) => void`. Wired in `App.ts` (global) or per-route in `routes/web.ts`.

## Structure

| File | Purpose | Default |
|------|---------|---------|
| `auth.ts` | `Auth` — session check, loads `req.user` (id, roles, permissions) | per-route `[Auth]` |
| `csrf.ts` | `csrf` — double-submit cookie CSRF protection; `csrfToken` — exposes token | global |
| `rateLimit.ts` | `rateLimit()`, `strictRateLimit()` (10/min), `apiRateLimit()` | global + per-route |
| `securityHeaders.ts` | `securityHeaders()` — HSTS, CSP, X-Frame-Options, X-Content-Type-Options | global |
| `inputSanitize.ts` | `inputSanitize()` — XSS protection, strips HTML via `stripTags` | global |
| `requestId.ts` | `requestId()` — adds `req.requestId` for tracing | global |
| `requestLogger.ts` | `requestLogger()` — logs requests via Logger | global |
| `renderer.ts` | `renderer` — Inertia.js HTML shell renderer (used by adapter) | global |
| `index.ts` | Barrel export — `@middlewares/*` aliases resolve here | — |

## Wiring Order (in App.ts — order matters for security)

```
securityHeaders  →  requestLogger  →  requestId  →  rateLimit
  →  csrf  →  inputSanitize  →  [routes with per-route Auth]
```

- `securityHeaders` first — set headers before anything else
- `requestLogger` + `requestId` early — trace every request
- `rateLimit` before csrf — throttle brute force on token endpoint
- `csrf` + `inputSanitize` — validate request before it reaches handler
- `Auth` is per-route, not global — public routes (landing, login) skip it

## Per-Route Middleware (in routes/web.ts)

```typescript
import Auth from '@middlewares/auth';
import { strictRateLimit } from '@middlewares/rateLimit';

Route.get('/users', [Auth], users.usersPage);
Route.post('/login', strictRateLimit(), auth.submitLogin);
Route.post('/assets/avatar', [Auth, strictRateLimit(), assets.avatarMiddleware], assets.uploadAsset);
```

- `Auth` = require session → loads `req.user`
- `strictRateLimit()` = 10 req/min per IP (for auth endpoints, uploads)
- Multiple middlewares: `[Auth, strictRateLimit(), ...]` — run in order

## Auth Middleware (most common)

```typescript
import Auth from '@middlewares/auth';

Route.get('/dashboard', [Auth], users.dashboardPage);
// In handler: req.user is guaranteed to exist (Auth loaded it)
// Still check: if (!req.user) return jsonError(res, 'Unauthorized', 401);
// — defensive, in case route is misconfigured
```

`Auth` loads `req.user` with: `id`, `name`, `email`, `avatar`, `roles` (string[]), `permissions` (string[]).

## Rate Limit Variants

| Function | Limit | Use for |
|----------|-------|---------|
| `rateLimit()` | configurable (default in constants) | General API |
| `strictRateLimit()` | 10 req/min per IP | Auth endpoints, uploads |
| `apiRateLimit()` | Higher limit | Data endpoints |

All backed by `CacheStore` (in-memory). Reset via `resetRateLimit(key)`.

## Conventions

- **Layer position** — middlewares may import `@core`, `@queries`, `@config`, `@services` — never `@handlers`, `@validators` (L17, enforced)
- **No `console.log`** — use `Logger` (L9, enforced). Exception: none in this layer
- **Functions, not classes** — each middleware is a function or factory
- **Factory pattern** for configurable middlewares: `rateLimit(options)` returns a middleware function
- **Add new middleware** → update `index.ts` with `export * from './name'` or `export { name } from './name'`
- **Test pattern** — use `runMiddleware(middleware, req, res)` from `tests/helpers/mocks.ts`. See [`.agents/skills/testing-pattern.md`](../../.agents/skills/testing-pattern.md)

## Security Notes

- `csrf.ts` uses `timingSafeEqual` for token comparison — never use `===` for security tokens
- `inputSanitize.ts` strips HTML tags via `stripTags` — this is **not** a full sanitizer, it prevents basic XSS. For rich text, use DOMPurify
- `securityHeaders.ts` CSP defaults are strict — loosening them is a security decision, document in an ADR
- `rateLimit.ts` is in-memory only — does not survive restarts. For multi-instance deployment, use a shared store (future ADR)

See [`.agents/skills/pentest-pattern.md`](../../.agents/skills/pentest-pattern.md) for OWASP Top 10 mapping of each middleware.
