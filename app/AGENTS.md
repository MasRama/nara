# app/ - Backend Modules

> See [../AGENTS.md](../AGENTS.md) for full project knowledge base.

## Structure

```
app/
├── types/           # Interfaces only (User, Session, Role, Permission)
├── queries/         # Raw SQL functions (findUserById, createUser, getUsersPaginated)
├── handlers/        # Request handlers (functions, not classes)
├── services/        # SQLite, Logger, Auth, Storage, CacheStore, LoginThrottle
├── middlewares/     # auth, csrf, rateLimit, securityHeaders, inputSanitize, requestId, requestLogger, inertia
├── validators/      # Zod schemas (schemas.ts) + zodToErrors helper (index.ts)
├── config/          # env.ts (environment variables) + constants.ts (SERVER, AUTH, RATE_LIMIT, UPLOAD, CACHE)
└── core/            # App, Router, errors, response helpers, adapters (Svelte/Inertia)
```

## Services Quick Reference

| Service | Import | Key Methods |
|---|---|---|
| SQLite | `@services/SQLite` | `one`, `many`, `exec` (template) · `get`, `all`, `run` (string) · `transaction`, `raw`, `close` |
| Logger | `@services/Logger` | `info`, `warn`, `error`, `fatal`, `debug`, `child`, `logRequest`, `logQuery` |
| Auth | `@services/Authenticate` | `hashPassword`, `comparePassword`, `processLogin`, `logout` |
| Storage | `@services` (named) | `put`, `putFile`, `get`, `exists`, `delete`, `url`, `path` |
| CacheStore | `@services/CacheStore` | `createCacheStore()` · pre-built: `assetCache`, `templateCache` |
| LoginThrottle | `@services/LoginThrottle` | Login attempt tracking + lockout |
| View | `@services/View` | HTML template rendering (used by Inertia adapter) |
| Migrator | `@services/Migrator` | Raw SQL migration runner (`migrate()`, `migrateFresh()`, `migrateStatus()`) |
| Seeder | `@services/Seeder` | Raw SQL seed runner (`seed()`) |

## Core Quick Reference

### Router

```typescript
import { createRouter } from '@core';

const Route = createRouter();
Route.get('/path', [Auth], handler);
Route.group('/api', [Auth], (r) => { r.get('/items', handler); });
Route.mount('/admin', adminRouter);
export default Route.getRouter();
```

### Error Factories

```typescript
import { notFoundError, forbiddenError, authError, badRequestError, conflictError, tooManyRequestsError, internalError, validationError } from '@core';
import { isNaraError, isValidationError } from '@core';
```

## Rules

1. **No classes** — use functions
2. **No `console.log`** — use `Logger.info/warn/error`
3. **No ORM** — raw SQL via `SQLite`
4. **Zod validation** — schemas in `validators/schemas.ts`, use `Schema.safeParse()` + `zodToErrors()`
5. **Path aliases** — `@core`, `@queries`, `@services`, `@middlewares/*`, `@handlers/*`, `@types`, `@validators`, `@config`
6. **Constants** — use `@config/constants` instead of hardcoding values
7. **IDs** — `crypto.randomUUID()` for all new records
8. **Password** — `hashPassword()` from `@services/Authenticate`, never bcrypt directly
