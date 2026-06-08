# Nara - AI-First TypeScript Starter Kit

## Philosophy

- **No classes** - Functions only
- **No comments** - Code is self-documenting
- **No abstractions** - Inline is fine
- **Raw SQL** - AI writes SQL, we just execute it
- **Minimal code** - Less code = less bugs

## Structure

```
app/
├── types/           # Interfaces only (User, Session, Role)
├── queries/         # Raw SQL functions (findUserById, createUser)
├── handlers/        # Request handlers (functions, not classes)
├── services/        # SQLite, Logger, Auth, Storage
├── middlewares/     # HTTP middleware (auth, csrf, rateLimit)
├── events/          # emit/on/off functions
├── validators/      # Input validation
├── config/          # Environment & constants
└── core/            # App, Router, errors, response helpers
```

## Patterns

### Types (types/models.ts)
```typescript
export interface User {
  id: string;
  name: string | null;
  email: string;
  created_at: number;
}
```

### Queries (queries/users.ts)
```typescript
import SQLite from '@services/SQLite';
import type { User } from '@types';

export const findUserById = (id: string): User | undefined =>
  SQLite.one<User>`SELECT * FROM users WHERE id = ${id}`;

export const createUser = (data: { id: string; email: string }): User => {
  SQLite.exec`INSERT INTO users (id, email) VALUES (${data.id}, ${data.email})`;
  return findUserById(data.id)!;
};
```

### Handlers (handlers/users.ts)
```typescript
import type { NaraRequest, NaraResponse } from '@core';
import { jsonSuccess, jsonCreated } from '@core';
import { findUserById, createUser } from '@queries';

export const show = (req: NaraRequest, res: NaraResponse) => {
  const user = findUserById(req.params.id);
  return jsonSuccess(res, 'OK', user);
};

export const create = (req: NaraRequest, res: NaraResponse) => {
  const user = createUser({ id: crypto.randomUUID(), ...req.body });
  return jsonCreated(res, 'Created', user);
};
```

### Routes (routes/web.ts)
```typescript
import * as users from '@handlers/users';
import * as auth from '@handlers/auth';
import Auth from '@middlewares/auth';

const Route = createRouter();

Route.get('/users/:id', [Auth], users.show);
Route.post('/users', [Auth], users.create);
Route.get('/login', auth.loginPage);
Route.post('/login', auth.processLogin);
```

### Events (events/index.ts)
```typescript
import { emit, on } from '@events';

// Emit
await emit('user.created', { userId: user.id });

// Listen
on('user.created', async ({ userId }) => {
  console.log('User created:', userId);
});
```

## SQLite Usage

```typescript
import SQLite from '@services/SQLite';

// Static SQL → template literals (preferred)
const user = SQLite.one<User>`SELECT * FROM users WHERE id = ${id}`;
const users = SQLite.many<User>`SELECT * FROM users WHERE active = 1`;
SQLite.exec`INSERT INTO users (id, email) VALUES (${id}, ${email})`;

// Dynamic SQL (variable columns, IN clauses) → string params
const result = SQLite.all<User>(`SELECT * FROM users WHERE id IN (${placeholders})`, ids);
SQLite.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

// Transactions
SQLite.transaction(() => {
  SQLite.exec`INSERT INTO users ...`;
  SQLite.exec`INSERT INTO profiles ...`;
});
```

## Rules

1. **No classes** - Use functions
2. **No comments** - Function names are documentation
3. **No DRY obsession** - Copy-paste is fine
4. **Zod validation** - Schemas in `validators/schemas.ts`, use `Schema.safeParse()` in handlers
5. **Direct SQL** - No ORM, no query builder
6. **Types at top** - Interfaces before functions

## Response Helpers

```typescript
jsonSuccess(res, 'OK', data);
jsonCreated(res, 'Created', data);
jsonError(res, 'Not found', 404);
jsonError(res, 'Forbidden', 403, 'FORBIDDEN');
```

## Auth Guards

```typescript
// In handler
if (!req.user) return jsonError(res, 'Unauthorized', 401);

// Check admin
import { isAdmin } from '@queries';
if (!isAdmin(req.user.id)) return jsonError(res, 'Forbidden', 403);

// Check permission
import { hasPermission } from '@queries';
if (!hasPermission(req.user.id, 'users.edit')) return jsonError(res, 'Forbidden', 403);
```

## Inertia Pages

```typescript
import { inertia } from '@core';

export const usersPage = (req: NaraRequest, res: NaraResponse) => {
  const users = SQLite.many<User>`SELECT * FROM users`;
  return inertia(res).inertia('users', { users });
};
```
