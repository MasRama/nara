# Nara - Project Knowledge Base

## Overview

AI-first TypeScript full-stack starter kit. Functions over classes, raw SQL over ORM, minimal abstractions.

- **Backend**: ultimate-express (uWebSockets.js) + better-sqlite3
- **Frontend**: Svelte 5 + Inertia.js
- **Auth**: Session-based + Google OAuth + RBAC

## Philosophy

- **No classes** — Functions only
- **No comments** — Code is self-documenting
- **No abstractions** — Inline is fine
- **Raw SQL** — AI writes SQL, we just execute it
- **Minimal code** — Less code = less bugs

## Mental Model

```
Browser (Svelte 5 + Inertia)
  │
  │  router.visit() for pages
  │  axios.get/post for data
  ▼
Server (ultimate-express)
  │
  Request → Middleware → Router → Handler → Response
                                │
                                ├── queries/  (raw SQL)
                                ├── services/ (SQLite, Auth, Logger)
                                └── types/    (interfaces)
```

### Two Response Types

| Route Type | Called By | Returns |
|---|---|---|
| **Page** | Browser navigation | `inertia(res).inertia('pageName', { data })` |
| **Data** | `axios.get/post` from Svelte | `jsonSuccess()`, `jsonError()`, `jsonCreated()` |

## Structure

```
./
├── app/
│   ├── types/           # Interfaces (User, Session, Role, Permission)
│   ├── queries/         # Raw SQL functions (findUserById, createUser, isAdmin)
│   ├── handlers/        # Request handlers (functions, not classes)
│   ├── services/        # SQLite, Logger, Auth, Storage, LoginThrottle
│   ├── middlewares/      # auth, csrf, rateLimit, securityHeaders
│   ├── events/          # emit/on/off/once (28 lines)
│   ├── validators/      # Input validation
│   ├── config/          # Environment & constants
│   └── core/            # App, Router, errors, response helpers
├── routes/web.ts        # All routes
├── migrations/          # Knex migrations
├── seeds/               # Knex seeders
├── resources/js/        # Svelte 5 frontend
├── server.ts            # Entry point
└── knexfile.ts          # DB config (used by SQLite.ts + migrations)
```

## Entry Points

| File | Purpose |
|---|---|
| `server.ts` | Web server entry (`npm run dev`) |
| `knexfile.ts` | DB path config for SQLite + migrations |

## Patterns

### Types → Queries → Handlers → Routes

```typescript
// types/models.ts
export interface User { id: string; email: string; /* ... */ }

// queries/users.ts
import SQLite from '@services/SQLite';
import type { User } from '@types';

export const findUserById = (id: string): User | undefined =>
  SQLite.one<User>`SELECT * FROM users WHERE id = ${id}`;

export const createUser = (data: { id: string; email: string }): User => {
  SQLite.exec`INSERT INTO users (id, email) VALUES (${data.id}, ${data.email})`;
  return findUserById(data.id)!;
};

// handlers/users.ts
import { jsonSuccess, jsonCreated } from '@core';
import { findUserById, createUser } from '@queries';

export const show = (req: NaraRequest, res: NaraResponse) => {
  const user = findUserById(req.params.id);
  return jsonSuccess(res, 'OK', user);
};

// routes/web.ts
import * as users from '@handlers/users';
Route.get('/users/:id', [Auth], users.show);
```

### Inertia Page Handler

```typescript
import { inertia } from '@core';
import type { NaraRequest, NaraResponse } from '@core';

export const usersPage = (req: NaraRequest, res: NaraResponse) => {
  const users = SQLite.many<User>`SELECT * FROM users`;
  return inertia(res).inertia('users', { users });
};
```

### Auth Guards (inline in handlers)

```typescript
if (!req.user) return jsonError(res, 'Unauthorized', 401);

import { isAdmin, hasPermission } from '@queries';
if (!isAdmin(req.user.id)) return jsonError(res, 'Forbidden', 403);
if (!hasPermission(req.user.id, 'users.edit')) return jsonError(res, 'Forbidden', 403);
```

### Events

```typescript
import { emit, on } from '@events';

emit('user.created', { userId: user.id });
on('user.created', async ({ userId }) => { /* ... */ });
```

### Validation (Zod)

```typescript
// validators/schemas.ts
import { z } from 'zod';

export const CreateUserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  email: z.string().email('Format email tidak valid').transform(v => v.toLowerCase()),
  phone: z.string().min(10).max(20).optional().nullable(),
  password: z.string().min(8, 'Password minimal 8 karakter').optional(),
  is_verified: z.boolean().optional().default(false),
  roles: z.array(z.string()).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// In handler (JSON endpoint)
import { CreateUserSchema, zodToErrors } from '@validators';
import { jsonValidationError } from '@core';

const parsed = CreateUserSchema.safeParse(req.body);
if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));
const data = parsed.data; // fully typed!

// In handler (Inertia form - redirect with error cookie)
const parsed = LoginSchema.safeParse(req.body);
if (!parsed.success) {
  const msg = Object.values(zodToErrors(parsed.error)).flat().join(', ');
  return res.cookie('error', msg, { maxAge: 5000 }).redirect('/login');
}
```

### Error Handling

Two patterns — pick based on context:

```typescript
// HANDLERS: return jsonError directly (preferred — explicit control flow)
import { jsonError, jsonForbidden, jsonNotFound } from '@core';

export const show = (req: NaraRequest, res: NaraResponse) => {
  if (!req.user) return jsonError(res, 'Unauthorized', 401);
  const user = findUserById(req.params.id);
  if (!user) return jsonNotFound(res, 'User not found');
  return jsonSuccess(res, 'OK', user);
};

// DEEP SERVICES: throw (bubbles to global error handler in App.ts)
import { notFoundError, forbiddenError, validationError } from '@core';

throw notFoundError('User not found');
throw forbiddenError();
throw validationError({ email: ['Email already exists'] });

// Type guard
import { isNaraError } from '@core';
if (isNaraError(error)) { /* handle */ }
```

## SQLite Usage

```typescript
import SQLite from '@services/SQLite';

// Static SQL → template literals (preferred)
const user = SQLite.one<User>`SELECT * FROM users WHERE id = ${id}`;
const users = SQLite.many<User>`SELECT * FROM users WHERE active = 1`;
SQLite.exec`INSERT INTO users (id, email) VALUES (${id}, ${email})`;

// Dynamic SQL (variable columns, IN clauses) → string params
const fields = ['name = ?', 'email = ?'];
SQLite.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, [name, email, id]);
const result = SQLite.all<User>(`SELECT * FROM users WHERE id IN (${placeholders})`, ids);

// Transactions
SQLite.transaction(() => {
  SQLite.exec`INSERT INTO users ...`;
  SQLite.exec`INSERT INTO profiles ...`;
});
```

## Response Helpers

```typescript
jsonSuccess(res, 'OK', data);
jsonCreated(res, 'Created', data);
jsonError(res, 'Not found', 404);
jsonError(res, 'Forbidden', 403, 'FORBIDDEN');
jsonPaginated(res, 'OK', data, { total, page, limit, totalPages, hasNext, hasPrev });
jsonNoContent(res);                          // 204
jsonUnauthorized(res);                       // 401
jsonForbidden(res);                          // 403
jsonNotFound(res);                           // 404
jsonValidationError(res, 'Failed', errors);  // 422
jsonServerError(res);                        // 500
```

## Middleware

| Middleware | Import | Effect |
|---|---|---|
| `Auth` | `@middlewares/auth` | Requires session, loads user + roles + permissions |
| `strictRateLimit()` | `@middlewares/rateLimit` | 10 req/min per IP |

## Conventions

- **2-space indent** (.editorconfig)
- **Strict TypeScript** (strict: true)
- **Path aliases** — `@core`, `@queries`, `@services`, `@middlewares`, `@handlers/*`, `@types`
- **Validation** — Zod schemas in `app/validators/schemas.ts`, helper `zodToErrors()` from `@validators`
- **Password hashing** — `hashPassword()` / `comparePassword()` from `@services/Authenticate`
- **Inertia pages** — `import { inertia } from '@core'` then `inertia(res).inertia('page', { data })`

## Anti-Patterns

1. **Don't** use classes — use functions
2. **Don't** use ORM/query builder — write raw SQL in `queries/`
3. **Don't** return `jsonSuccess` from a page route — use `inertia(res).inertia()`
4. **Don't** return `inertia()` from a data route — use `jsonSuccess/jsonError`
5. **Don't** use relative imports for core modules — use path aliases

## Build/Test

```bash
npm run dev          # Dev server (Vite + nodemon)
npm run build        # Production build
npm run lint         # tsc --noEmit
npm run test         # vitest run
npm run migrate      # npx knex migrate:latest
npm run seed         # npx knex seed:run
```

## Where to Look

| Task | Location |
|---|---|
| Add new endpoint | `app/handlers/` + `routes/web.ts` |
| Add database query | `app/queries/` |
| Add data model | `app/types/models.ts` + `migrations/` |
| Auth logic | `app/services/Authenticate.ts` |
| Permission checks | `app/queries/users.ts` (isAdmin, hasPermission) |
| Frontend page | `resources/js/Pages/` |
