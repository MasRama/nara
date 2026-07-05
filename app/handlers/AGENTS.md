---
description: "Request handlers — functions that receive NaraRequest/NaraResponse and return a response. Two route types: page (inertia) vs data (json)"
tags: [handlers, api, routes, mutations, inertia, json, crud]
---

# Handlers


Request handlers — functions that receive `NaraRequest` / `NaraResponse` and return a response. Never classes, never raw SQL.

## Structure

| File | Purpose |
|------|---------|
| `auth.ts` | login/register/logout/change-password (session + throttle) |
| `users.ts` | dashboard/users/profile pages + user CRUD |
| `roles.ts` | roles page + role CRUD + permissions data |
| `assets.ts` | avatar upload + static asset serving |
| `home.ts` | landing page |
| `index.ts` | barrel export (`export * as X from './X'`) |

## The Two Route Types (critical)

| Route | Returns | Frontend calls |
|------|---------|----------------|
| **Page** | `res.inertia('pageName', { data })` | browser navigation |
| **Data** | `jsonSuccess()` / `jsonError()` / `jsonCreated()` | `api(() => axios.method())` |

Never mix — page route returning `jsonSuccess` shows raw JSON in the browser; data route returning `inertia()` breaks axios.

## Naming (L11 + L12 — enforced by lint:layers)

- **Descriptive**: `createUser`, `addRole`, `editProduct`, `removeUsers` — never generic `index`, `store`, `create`, `update`, `destroy`
- **Include resource**: `createUser` not `create`; `addRole` not `add`
- **Page handlers**: end in `Page` — `usersPage`, `rolesPage`, `landingPage`
- **Middleware in handlers**: end in `Middleware` — `avatarMiddleware`

## Standard Mutation Pattern

```typescript
import type { NaraRequest, NaraResponse } from '@core';
import { jsonCreated, jsonError, jsonServerError, jsonValidationError } from '@core';
import { randomUUID } from 'crypto';
import Logger from '@services/Logger';
import { createProduct } from '@queries';
import { CreateProductSchema, zodToErrors } from '@validators';

export const addProduct = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);

  const parsed = CreateProductSchema.safeParse(req.body);
  if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));

  try {
    const product = createProduct({ id: randomUUID(), ...parsed.data });
    return jsonCreated(res, 'Product created', { product });
  } catch (error: unknown) {
    Logger.error('Failed to create product', error as Error);
    return jsonServerError(res, 'Failed to create product');
  }
};
```

## Auth Guard Order

1. `if (!req.user) return jsonError(res, 'Unauthorized', 401)` — not logged in
2. `if (!isAdmin(req.user.id)) return jsonForbidden(res)` — admin-only
3. `if (!hasPermission(req.user.id, 'resource.action')) return jsonForbidden(res)` — specific permission

See [`.agents/skills/auth-rbac.md`](../../.agents/skills/auth-rbac.md) and [`.agents/skills/api-contract.md`](../../.agents/skills/api-contract.md) for full patterns.

## Conventions

- **No SQLite import** — go through `@queries` (L1, enforced)
- **Allowed service imports**: `Authenticate`, `Logger`, `Storage`, `LoginThrottle`, `CacheStore` (L2, enforced)
- **try/catch only in mutations** — queries bubble errors, handlers catch
- **English for user-facing messages** (ADR 0010) — `'Product created'`, not `'Produk berhasil dibuat'`
- **No `console.log`** — use `Logger.info/warn/error` (L9, enforced)
- **No `bcrypt` direct** — use `hashPassword`/`comparePassword` from `@services/Authenticate` (L10, enforced)
- Add new handler file → update `index.ts` with `export * as name from './name'`
- Pagination: `queryInt(req, 'page')` and `queryInt(req, 'limit', 10)` — never manual `parseInt`

## Anti-Patterns (enforced by lint:layers)

- Generic export names (`index`, `show`, `store`, `create`, `update`, `destroy`) — L11
- Verb-only names (`create`, `update`, `delete`) without resource — L12
- Vague function names (`handle`, `process`, `run`, `do`, `execute`) — L13
