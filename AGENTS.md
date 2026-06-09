# Nara - Project Knowledge Base

## Overview

AI-first TypeScript full-stack starter kit. Functions over classes, raw SQL over ORM, minimal abstractions.

- **Backend**: ultimate-express (uWebSockets.js) + better-sqlite3
- **Frontend**: Svelte 5 + Inertia.js + Zag JS (headless UI)
- **Auth**: Session-based + Google OAuth + RBAC
- **Validation**: Zod

## Philosophy

- **No classes** — functions only
- **No unnecessary comments** — code is self-documenting
- **No abstractions** — inline is fine
- **Raw SQL** — AI writes SQL, we just execute it
- **Minimal code** — less code = less bugs

## Mental Model

```
Browser (Svelte 5 + Inertia)
  │  router.visit() for pages · axios for data
  ▼
Server (ultimate-express)
  │  Request → Middleware → Router → Handler → Response
  │
  ├── handlers/   (request handlers — functions)
  ├── queries/    (raw SQL functions)
  ├── services/   (SQLite, Auth, Logger, Storage, CacheStore)
  ├── middlewares/ (auth, csrf, rateLimit, securityHeaders)
  ├── validators/ (Zod schemas)
  ├── events/     (emit/on/off)
  ├── config/     (env + constants)
  └── types/      (interfaces)
```

### Two Response Types

| Route Type | Called By | Returns |
|---|---|---|
| **Page** | Browser navigation | `inertia(res).inertia('pageName', { data })` |
| **Data** | `axios` from Svelte | `jsonSuccess()`, `jsonError()`, `jsonCreated()` |

## Structure

```
./
├── app/
│   ├── types/           # Interfaces (User, Session, Role, Permission)
│   ├── queries/         # Raw SQL functions (findUserById, createUser, isAdmin)
│   ├── handlers/        # Request handlers (functions, not classes)
│   ├── services/        # SQLite, Logger, Auth, Storage, CacheStore, LoginThrottle
│   ├── middlewares/      # auth, csrf, rateLimit, securityHeaders, inputSanitize, requestId
│   ├── events/          # emit/on/off/once
│   ├── validators/      # Zod schemas + zodToErrors helper
│   ├── config/          # Environment (env.ts) & constants (constants.ts)
│   └── core/            # App, Router, errors, response helpers
├── routes/web.ts        # All route definitions
├── migrations/          # Knex migrations
├── seeds/               # Knex seeders
├── resources/js/        # Svelte 5 frontend
│   ├── Pages/           # Route pages (.svelte)
│   ├── Components/      # Reusable components (Header, Button, Switch, Modal, etc — Zag JS for interactive UI)
│   ├── lib/             # api.ts, csrf.ts, toast.ts, utils.ts, hooks/, utils/
│   └── types/           # generated.ts + index.ts (manually synced with backend)
├── tests/               # Vitest tests
├── server.ts            # Entry point
└── knexfile.ts          # DB config (used by SQLite.ts + migrations)
```

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
import { jsonSuccess } from '@core';
import { findUserById } from '@queries';

export const show = (req: NaraRequest, res: NaraResponse) => {
  const user = findUserById(req.params.id);
  if (!user) return jsonNotFound(res, 'User not found');
  return jsonSuccess(res, 'OK', user);
};

// routes/web.ts
import { createRouter } from '@core';
import * as users from '@handlers/users';
import Auth from '@middlewares/auth';

const Route = createRouter();
Route.get('/users/:id', [Auth], users.show);
export default Route.getRouter();
```

### Router API

```typescript
import { createRouter } from '@core';

const Route = createRouter();

// HTTP methods: get, post, put, patch, delete, any
Route.get('/path', handler);
Route.post('/path', [middleware], handler);
Route.put('/path/:id', [Auth], handler);

// Route groups with shared prefix + middleware
Route.group('/api', [Auth], (r) => {
  r.get('/users', users.index);
  r.post('/users', users.create);
});

// Mount sub-router
Route.mount('/admin', adminRouter);

export default Route.getRouter();
```

### Inertia Page Handler

```typescript
import { inertia } from '@core';

export const usersPage = (req: NaraRequest, res: NaraResponse) => {
  // Pass ALL page data via inertia — lists, permissions, metadata
  const result = getUsersPaginated(page, limit, search);
  return inertia(res).inertia('users', {
    users: result.data,
    permissions: { canCreate: true, canEdit: true },
    total: result.total, page, limit,
  });
};
```

### Pagination

```typescript
// queries/users.ts
export const getUsersPaginated = (page: number, limit: number, search = ''): { data: User[]; total: number } => {
  const offset = (page - 1) * limit;
  const pattern = `%${search}%`;
  const countRow = SQLite.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM users WHERE name LIKE ?', [pattern]
  );
  const data = SQLite.all<User>(
    'SELECT * FROM users WHERE name LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [pattern, limit, offset]
  );
  return { data, total: countRow?.count ?? 0 };
};

// handlers/users.ts
export const index = (req: NaraRequest, res: NaraResponse) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = (req.query.search as string) || '';
  const result = getUsersPaginated(page, limit, search);
  return jsonPaginated(res, 'OK', result.data, {
    total: result.total, page, limit,
    totalPages: Math.ceil(result.total / limit),
    hasNext: page * limit < result.total,
    hasPrev: page > 1,
  });
};
```

### Dynamic Update Query

```typescript
export const updateUser = (id: string, data: Partial<User>): User | undefined => {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && key !== 'id' && key !== 'created_at') {
      fields.push(`${key} = ?`);
      values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
    }
  }

  if (fields.length === 0) return findUserById(id);
  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  SQLite.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  return findUserById(id);
};
```

## SQLite Usage

```typescript
import SQLite from '@services/SQLite';

// Static SQL → template literals (preferred)
const user = SQLite.one<User>`SELECT * FROM users WHERE id = ${id}`;       // single row or undefined
const users = SQLite.many<User>`SELECT * FROM users WHERE active = 1`;     // array (never undefined)
SQLite.exec`INSERT INTO users (id, email) VALUES (${id}, ${email})`;       // run (returns RunResult)

// Dynamic SQL (variable columns, IN clauses) → string params
const row = SQLite.get<User>('SELECT * FROM users WHERE id = ?', [id]);    // single row
const rows = SQLite.all<User>('SELECT * FROM users WHERE id IN (?)', ids); // array
SQLite.run('UPDATE users SET name = ? WHERE id = ?', [name, id]);          // run

// Transactions
SQLite.transaction(() => {
  SQLite.exec`INSERT INTO users ...`;
  SQLite.exec`INSERT INTO profiles ...`;
});

// Access native better-sqlite3 database (rare)
const db = SQLite.raw();
```

## Response Helpers

```typescript
jsonSuccess(res, 'OK', data);
jsonSuccess(res, 'OK', data, meta, 200);            // with meta + custom status
jsonCreated(res, 'Created', data);                    // 201
jsonPaginated(res, 'OK', data, { total, page, limit, totalPages, hasNext, hasPrev });
jsonNoContent(res);                                   // 204
jsonError(res, 'Not found', 404);
jsonError(res, 'Forbidden', 403, 'FORBIDDEN');
jsonError(res, 'Bad request', 400, 'BAD_REQUEST', { field: ['error msg'] });
jsonUnauthorized(res);                                // 401
jsonForbidden(res);                                   // 403
jsonNotFound(res);                                    // 404
jsonValidationError(res, 'Failed', errors);           // 422
jsonServerError(res);                                 // 500
```

## Auth Guards

```typescript
if (!req.user) return jsonError(res, 'Unauthorized', 401);

import { isAdmin, hasPermission } from '@queries';
if (!isAdmin(req.user.id)) return jsonError(res, 'Forbidden', 403);
if (!hasPermission(req.user.id, 'users.edit')) return jsonError(res, 'Forbidden', 403);
```

## Validation (Zod)

```typescript
// validators/schemas.ts
import { z } from 'zod';

export const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().transform(v => v.toLowerCase()),
  password: z.string().min(8).optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// In handler (JSON endpoint)
import { CreateUserSchema, zodToErrors } from '@validators';
import { jsonValidationError } from '@core';

const parsed = CreateUserSchema.safeParse(req.body);
if (!parsed.success) return jsonValidationError(res, 'Validation failed', zodToErrors(parsed.error));
const data = parsed.data; // fully typed

// In handler (Inertia form — redirect with error cookie)
const parsed = LoginSchema.safeParse(req.body);
if (!parsed.success) {
  const msg = Object.values(zodToErrors(parsed.error)).flat().join(', ');
  return res.cookie('error', msg, { maxAge: 5000 }).redirect('/login');
}
```

## Error Handling

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
import { notFoundError, forbiddenError, validationError, badRequestError, conflictError, authError, tooManyRequestsError, internalError } from '@core';

throw notFoundError('User not found');       // 404
throw forbiddenError();                       // 403
throw authError();                            // 401
throw badRequestError('Invalid input');       // 400
throw conflictError('Email exists');          // 409
throw tooManyRequestsError('Slow down', 60);  // 429 + retryAfter
throw internalError('Something broke');       // 500
throw validationError({ email: ['Email already exists'] }); // 422

// Type guards
import { isNaraError, isValidationError } from '@core';
if (isNaraError(error)) { /* error.statusCode, error.code, error.message */ }
if (isValidationError(error)) { /* error.errors */ }
```

## File Upload & Storage

```typescript
import { Storage } from '@services';

const stored = await Storage.put(buffer, { directory: 'avatars', name: id, extension: 'webp' });
// → { path, fullPath, url, size, name }

const stored = await Storage.putFile('/tmp/upload.jpg', { directory: 'photos' });

const buffer = await Storage.get('avatars/abc.webp');
const exists = await Storage.exists('avatars/abc.webp');
await Storage.delete('avatars/abc.webp');
const publicUrl = Storage.url('avatars/abc.webp'); // → /storage/avatars/abc.webp
```

### Upload handler pattern (multer + sharp)

```typescript
import multer from 'multer';
import sharp from 'sharp';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
export const uploadMiddleware = upload.single('file');

export const uploadAsset = async (req: NaraRequest, res: NaraResponse) => {
  const file = (req as any).file as { buffer: Buffer; mimetype: string };
  const processed = await sharp(file.buffer).webp({ quality: 80 }).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).toBuffer();
  const stored = await Storage.put(processed, { directory: 'avatars', name: randomUUID(), extension: 'webp' });
  return jsonSuccess(res, 'Uploaded', { url: stored.url });
};
```

## Logger

```typescript
import Logger from '@services/Logger';

Logger.info('Server started', { port: 5555 });
Logger.warn('Deprecated endpoint', { path: '/old' });
Logger.error('Failed to process', error);
Logger.fatal('Database unreachable', error);
Logger.debug('Query result', { count: 42 });

// Specialized loggers
Logger.logRequest({ method: 'GET', url: '/users', statusCode: 200, responseTime: 12 });
Logger.logQuery('SELECT * FROM users', 5);
Logger.logAuth('login success', { userId: '123' });
Logger.logSecurity('brute force detected', { ip: '1.2.3.4' });

// Child logger (add context to all subsequent logs)
const reqLogger = Logger.child({ requestId: req.requestId });
```

## CacheStore

```typescript
import { createCacheStore } from '@services/CacheStore';

const cache = createCacheStore<string>({
  maxEntries: 100,
  maxBytes: 5 * 1024 * 1024,
  defaultTtlMs: 60 * 60 * 1000,
});

cache.set('key', 'value');
cache.set('key', 'value', 5000); // custom TTL
const val = cache.get('key');
cache.delete('key');
const stats = cache.stats(); // { entries, totalBytes, hits, misses, evictions, hitRate }

// Pre-configured instances
import { assetCache, templateCache } from '@services/CacheStore';
```

## Events

```typescript
import { emit, on } from '@events';

emit('user.created', { userId: user.id });
on('user.created', async ({ userId }) => { Logger.info('User created', { userId }); });
```

## Middleware

| Middleware | Import | Effect |
|---|---|---|
| `Auth` | `@middlewares/auth` | Requires session, loads user + roles + permissions |
| `strictRateLimit()` | `@middlewares/rateLimit` | 10 req/min per IP |
| `csrf()` | `@middlewares/csrf` | Double Submit Cookie CSRF protection |
| `securityHeaders()` | `@middlewares/securityHeaders` | HSTS, CSP, X-Frame-Options |
| `inputSanitize()` | `@middlewares/inputSanitize` | XSS protection via DOMPurify |
| `requestId()` | `@middlewares/requestId` | Adds `req.requestId` for tracing |
| `requestLogger()` | `@middlewares/requestLogger` | Logs requests via Logger |

## Frontend (Svelte 5 + Inertia)

```svelte
<script lang="ts">
  import { page as inertiaPage, router } from '@inertiajs/svelte';
  import axios from 'axios';
  import { api } from '$lib/api';
  import Header from '../Components/Header.svelte';

  // Inertia props from server
  let { permissions, total } = $props();

  // Current user from shared Inertia props
  const currentUser = $derived(inertiaPage.props.user as User | undefined);

  // Local state
  let items = $state([]);

  // Fetch data — NEVER pass CRUD lists from res.inertia()
  async function loadData(): Promise<void> {
    const result = await api(() => axios.get('/items/data'), { showSuccessToast: false });
    if (result.success) items = result.data;
  }

  // Mutations
  async function createItem(payload: object): Promise<void> {
    const result = await api(() => axios.post('/items', payload));
    if (result.success) await loadData();
  }

  // Navigation
  function goTo(path: string): void {
    router.visit(path, { preserveScroll: true });
  }

  $effect(() => { loadData(); });
</script>

<Header group="items" />
```

### Frontend rules

- **HTTP**: Always `api(() => axios.method(...))` — never raw `fetch()`
- **State**: `$state()`, `$derived()`, `$effect()`, `$props()` — never `onMount`, `$:`, `export let`
- **Navigation**: `router.visit()` for page transitions
- **Page data**: Pass all data via `res.inertia()` props — lists, permissions, metadata
- **Mutations**: Use `api(() => axios.post/put/delete())` for create/update/delete, then `router.visit()` to refresh
- **CSRF**: Auto-handled by `configureAxiosCSRF(axios)` in `app.js`
- **Toast**: Auto-shown by `api()` — suppress with `{ showSuccessToast: false }`
- **Store access**: Use `$storeName` (Svelte store subscription) inside `$derived()` — e.g. `$derived($inertiaPage.props.user)`
- **UI components**: Use Zag JS (`@zag-js/*`) for interactive primitives (dialog, menu, switch, tabs) — `useMachine` + `normalizeProps` + spread props pattern

## Database Schema

| Table | Key Columns | Relations |
|---|---|---|
| `users` | id (uuid), email, name, phone, password, avatar, is_verified | has many roles via `user_roles` |
| `sessions` | id (uuid), user_id, user_agent, expires_at | belongs to `users` |
| `roles` | id (uuid), name, slug, description | has many permissions via `role_permissions` |
| `permissions` | id (uuid), name, slug, resource, action, description | belongs to roles via `role_permissions` |
| `user_roles` | id (uuid), user_id, role_id, created_at | junction: `users` ↔ `roles` |
| `role_permissions` | id (uuid), role_id, permission_id, created_at | junction: `roles` ↔ `permissions` |
| `assets` | id (uuid), name, type, url, mime_type, size, s3_key, user_id | belongs to `users` |
| `password_reset_tokens` | id (auto), email, token, expires_at, used | standalone |

- All IDs: `crypto.randomUUID()` (except auto-increment tables)
- All timestamps: `biginteger` unix milliseconds via `Date.now()`
- Foreign keys: `.onDelete('CASCADE')`

## Adapter Pattern

`app/core/adapters/` contains frontend adapter for Inertia.js:

```typescript
import { svelteAdapter } from '@core';

const app = createApp({
  adapter: svelteAdapter(),  // enables res.inertia() on NaraResponse
});
```

- `adapters/types.ts` — `FrontendAdapter` interface (middleware, extendResponse)
- `adapters/svelte.ts` — Svelte/Inertia adapter (shares user/props, renders HTML template)
- Custom adapters can implement `FrontendAdapter` for other frontend frameworks

## Conventions

- **2-space indent** (.editorconfig)
- **Strict TypeScript** (strict: true)
- **Path aliases** — `@core`, `@queries`, `@services`, `@middlewares/*`, `@handlers/*`, `@types`, `@validators`, `@config`, `@events`
- **Password hashing** — `hashPassword()` / `comparePassword()` from `@services/Authenticate`
- **Constants** — use `@config/constants` (SERVER, AUTH, RATE_LIMIT, UPLOAD, CACHE, LOGGING)
- **IDs** — `crypto.randomUUID()` for all new records

## Anti-Patterns

1. **Don't** use classes — use functions
2. **Don't** use ORM/query builder — write raw SQL in `queries/`
3. **Don't** return `jsonSuccess` from a page route — use `inertia(res).inertia()`
4. **Don't** return `inertia()` from a data route — use `jsonSuccess/jsonError`
5. **Don't** use relative imports for core modules — use path aliases
6. **Don't** use `console.log` — use `Logger.info/warn/error`
7. **Don't** use `fetch()` on frontend — use `api(() => axios.method(...))`
8. **Don't** use bcrypt directly — use `hashPassword()` from `@services/Authenticate`
9. **Don't** mix languages in error messages — use Indonesian for user-facing messages

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
| Add Zod schema | `app/validators/schemas.ts` + export from `index.ts` |
| Auth logic | `app/services/Authenticate.ts` |
| Permission checks | `app/queries/users.ts` (isAdmin, hasPermission) |
| File upload | `app/handlers/assets.ts` (multer + sharp + Storage) |
| Frontend page | `resources/js/Pages/` |
| Frontend component | `resources/js/Components/` |
| Constants | `app/config/constants.ts` |
| Adapters | `app/core/adapters/` (Svelte/Inertia integration) |
