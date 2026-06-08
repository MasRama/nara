# Nara - AI Context File

> Optimized for AI assistants (Cursor, Copilot, Claude, etc).
> For human docs, see [README.md](./README.md).

## What is Nara?

AI-first TypeScript full-stack starter kit. Functions over classes, raw SQL over ORM, minimal abstractions.

- **Backend**: ultimate-express (uWebSockets.js) + better-sqlite3
- **Frontend**: Svelte 5 + Inertia.js
- **Auth**: Session-based + Google OAuth + RBAC
- **Validation**: Zod

**IMPORTANT: TypeScript project, NOT PHP.**

## Philosophy

- **No classes** — functions only
- **No comments** — code is self-documenting
- **No abstractions** — inline is fine
- **Raw SQL** — AI writes SQL, we just execute it
- **Minimal code** — less code = less bugs

## Quick Context

```
Nara = AI-first TypeScript starter kit
     = ultimate-express (server) + Svelte 5 (frontend) + Inertia.js (glue)
     = better-sqlite3 with template literal queries
     = Functions, not classes. Raw SQL, not ORM.
     = Auth, RBAC, security included
```

## Entry Points

| File | Purpose |
|------|---------|
| `server.ts` | HTTP server bootstrap |
| `routes/web.ts` | All route definitions |
| `app/core/App.ts` | Server setup, middleware, error handler |
| `knexfile.ts` | DB path config (used by SQLite.ts + migrations) |

## Directory Map

```
nara/
├── app/
│   ├── types/           # Interfaces (User, Session, Role, Permission)
│   ├── queries/         # Raw SQL functions (findUserById, createUser, isAdmin)
│   ├── handlers/        # Request handlers (functions, not controllers)
│   ├── services/        # SQLite, Logger, Auth, Storage, LoginThrottle
│   ├── middlewares/      # auth, csrf, rateLimit, securityHeaders
│   ├── events/          # emit/on/off/once (28 lines total)
│   ├── validators/      # Zod schemas
│   ├── config/          # Environment & constants
│   └── core/            # App, Router, errors, response helpers
├── routes/web.ts        # All routes
├── migrations/          # Knex migrations
├── resources/js/        # Svelte 5 frontend
│   ├── Pages/           # Route pages (.svelte)
│   ├── Components/      # Reusable components
│   └── lib/             # Utilities (api.ts, csrf.ts, toast.ts)
├── tests/               # Vitest tests
└── public/              # Static assets
```

## Two Response Types

| Route Type | Called By | Returns |
|---|---|---|
| **Page** | Browser navigation | `inertia(res).inertia('pageName', { data })` |
| **Data** | `axios` from Svelte | `jsonSuccess()`, `jsonError()`, `jsonCreated()` |

## Path Aliases

| Alias | Resolves To |
|-------|-------------|
| `@core` | `app/core/index.ts` |
| `@handlers/*` | `app/handlers/*` |
| `@queries` | `app/queries/index.ts` |
| `@queries/*` | `app/queries/*` |
| `@services` | `app/services/index.ts` |
| `@services/*` | `app/services/*` |
| `@middlewares/*` | `app/middlewares/*` |
| `@validators` | `app/validators/index.ts` |
| `@config` | `app/config/index.ts` |
| `@types` | `app/types/models.ts` |
| `$lib` | `resources/js/lib` |

## Key Patterns

### Data Flow: Types → Queries → Handlers → Routes

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
import { jsonSuccess } from '@core';
import { findUserById } from '@queries';

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

### SQLite Queries

```typescript
import SQLite from '@services/SQLite';

// Static SQL → template literals (preferred)
const user = SQLite.one<User>`SELECT * FROM users WHERE id = ${id}`;
const users = SQLite.many<User>`SELECT * FROM users WHERE active = 1`;
SQLite.exec`INSERT INTO users (id, email) VALUES (${id}, ${email})`;

// Dynamic SQL → string params
const result = SQLite.all<User>(query, params);
SQLite.run('UPDATE users SET name = ? WHERE id = ?', [name, id]);

// Transactions
SQLite.transaction(() => {
  SQLite.exec`INSERT INTO users ...`;
  SQLite.exec`INSERT INTO profiles ...`;
});
```

### Auth Guards (inline in handlers)

```typescript
import { isAdmin, hasPermission } from '@queries';

if (!req.user) return jsonError(res, 'Unauthorized', 401);
if (!isAdmin(req.user.id)) return jsonError(res, 'Forbidden', 403);
if (!hasPermission(req.user.id, 'users.edit')) return jsonError(res, 'Forbidden', 403);
```

### Validation (Zod)

```typescript
// validators/schemas.ts
import { z } from 'zod';

export const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().transform(v => v.toLowerCase()),
  password: z.string().min(8).optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// In handler
import { CreateUserSchema, zodToErrors } from '@validators';
const parsed = CreateUserSchema.safeParse(req.body);
if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));
const data = parsed.data; // fully typed
```

### Errors

```typescript
// In handlers: return jsonError directly (preferred)
return jsonError(res, 'Not found', 404);
return jsonError(res, 'Forbidden', 403, 'FORBIDDEN');

// In deep service layers: throw (bubbles to global error handler)
import { notFoundError, forbiddenError } from '@core';
throw notFoundError('User not found');
throw forbiddenError();
```

### Events

```typescript
import { emit, on } from '@events';

emit('user.created', { userId: user.id });
on('user.created', async ({ userId }) => { /* ... */ });
```

## CLI Commands

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run test             # Run tests
npm run migrate          # Run migrations
npm run migrate:rollback # Rollback migrations
npm run migrate:fresh    # Fresh DB + seed
npm run seed             # Run seeders
```

## Frontend (Svelte 5)

```svelte
<script lang="ts">
  import axios from 'axios';
  import { api } from '$lib/api';
  
  let users = $state([]);
  
  async function loadUsers() {
    const result = await api(() => axios.get('/users/data'), { showSuccessToast: false });
    if (result.success) users = result.data;
  }
</script>
```

## Anti-Patterns (DO NOT)

1. Use classes → use functions
2. Use ORM/query builder → use raw SQL via `SQLite`
3. Use relative imports → use `@core`, `@queries`, etc.
4. Return JSON from page route → causes Inertia error
5. Use raw `fetch()` → use `api(() => axios.method())`
6. Use bcrypt directly → use `hashPassword()` from `@services/Authenticate`

## Environment

```env
NODE_ENV=development
PORT=5555
DB_FILE=database/dev.sqlite3
LOG_LEVEL=debug
```

See `.env.example` for all variables.
