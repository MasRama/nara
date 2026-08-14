---
description: "Raw SQL functions — the only layer that touches SQLite. Static SQL via template literals, dynamic SQL via ? params, IN-clause and pagination patterns"
tags: [queries, sql, sqlite, database, crud, pagination, transactions]
---

# Queries


Raw SQL functions in `app/queries/`. The only layer that touches `SQLite`. Handlers call these — never import `SQLite` directly.

## Structure

| File | Purpose |
|------|---------|
| `users.ts` | CRUD + `isAdmin`, `hasPermission`, `hasRole`, role sync |
| `roles.ts` | CRUD + role-permission junction + permission lookups |
| `sessions.ts` | session CRUD + expiry cleanup + `getUserBySessionId` |
| `assets.ts` | `createAsset`, `findAssetsByUserId` |
| `health.ts` | `pingDatabase` (readiness probe) |
| `index.ts` | barrel export (`export * from './X'`) |

## Static SQL → Template Literals (auto-parameterized, safe)

```typescript
import SQLite from '@services/SQLite';
import type { User } from '@types';

export const findUserById = (id: string): User | undefined =>
  SQLite.one<User>`SELECT * FROM users WHERE id = ${id}`;

export const findAllRoles = (): Role[] =>
  SQLite.many<Role>`SELECT * FROM roles ORDER BY created_at ASC`;

SQLite.exec`INSERT INTO users (id, email) VALUES (${id}, ${email})`;
```

## IN Clause (arrays expand automatically)

```typescript
// ✅ Correct — interpolated arrays expand to (?, ?, …)
export const deleteProducts = (ids: string[]): void => {
  if (ids.length === 0) return;
  SQLite.exec`DELETE FROM products WHERE id IN (${ids})`;
};
```

## Pagination

```typescript
export const getProductsPaginated = (page: number, limit: number, search = ''): { data: Product[]; total: number } => {
  const offset = (page - 1) * limit;
  const pattern = `%${search}%`;
  const countRow = SQLite.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM products WHERE name LIKE ?', [pattern]
  );
  const data = SQLite.all<Product>(
    'SELECT * FROM products WHERE name LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [pattern, limit, offset]
  );
  return { data, total: countRow?.count ?? 0 };
};
```

## Dynamic Update (skips undefined, converts booleans, sets updated_at)

```typescript
SQLite.update('users', { id }, { name, email, avatar: undefined });
// → UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?
// undefined fields skipped, booleans → 0/1, updated_at auto-set
```

## Transactions

```typescript
SQLite.transaction(() => {
  SQLite.exec`INSERT INTO users ...`;
  SQLite.exec`INSERT INTO profiles ...`;
});
```
Auto-rollback on throw. Use for any multi-statement write that must be atomic.

## Conventions

- **Bottom layer** — may only import `@services/SQLite`, `@types`, `@config`, `crypto` (L14, enforced)
- **No try/catch in queries** — let errors bubble to handlers
- **No `console.log`** — queries have no Logger import (bottom layer)
- `const` arrow functions — never `class`, never `function` declarations
- Add new file → update `index.ts` with `export * from './name'`

## Anti-Patterns (enforced by lint:layers)

- Importing `@handlers`, `@validators`, `@middlewares`, `@core` — L14
- Single `?` for IN clauses — runtime crash (see above)
- ORM / query builder — ADR 0001 bans them
