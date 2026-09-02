---
trigger: Writing SQL queries, transactions, dynamic updates, or any database access
status: active-v3
---

# SQLite Usage (v3)

## Ownership

Feature repositories own SQL. Shared database lifecycle lives in `src/shared/database/`; route modules and browser code must not access SQLite directly.

```typescript
import { getDatabase } from '../../../shared/database';

export function findUserById(userId: string): StoredUser | undefined {
  return getDatabase()
    .prepare(
      'SELECT id, name, email, password, avatar, created_at, updated_at FROM users WHERE id = ?',
    )
    .get(userId) as StoredUser | undefined;
}
```

Use `better-sqlite3` prepared statements for values. Keep row interfaces near the repository that reads them or export them through the Feature's public boundary when another module needs the type.

## Parameter binding

Never interpolate user-controlled values into SQL. Bind values through `.get()`, `.all()`, or `.run()`:

```typescript
const pattern = `%${search}%`;
const rows = getDatabase()
  .prepare(
    `SELECT id, name
     FROM products
     WHERE name LIKE ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
  )
  .all(pattern, limit, offset) as ProductRow[];
```

For dynamic `IN` clauses, generate one placeholder per validated value and spread the values into the prepared statement:

```typescript
const placeholders = roleIds.map(() => '?').join(', ');
const rows = getDatabase()
  .prepare(`SELECT * FROM roles WHERE id IN (${placeholders})`)
  .all(...roleIds) as Role[];
```

Dynamic identifiers cannot be bound. Prefer fixed SQL; if an identifier must be dynamic, validate it against a closed allowlist before inserting it into the statement.

## Transactions

Use a `better-sqlite3` transaction for multi-statement writes that must be atomic:

```typescript
const database = getDatabase();
const replace = database.transaction(() => {
  database.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
  const statement = database.prepare(
    `INSERT INTO user_roles (id, user_id, role_id, created_at)
     VALUES (?, ?, ?, ?)`,
  );
  const now = Date.now();
  for (const roleId of roleIds) {
    statement.run(randomUUID(), userId, roleId, now);
  }
});
replace();
```

A thrown error rolls the transaction back. Use transactions for replacement operations, junction-table synchronization, and coordinated writes across tables.

## Pagination

Validate page and limit at the request boundary, then use a deterministic order and a bound offset:

```typescript
const offset = (page - 1) * limit;
const data = database
  .prepare(
    `SELECT * FROM products
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
  )
  .all(limit, offset) as ProductRow[];
```

Return `{ data, total }` from the repository when the API contract needs both values. Do not accept arbitrary SQL fragments as pagination or sorting input.

## Schema and lifecycle

Use `getDatabase()` so the configured database path, test in-memory mode, pragmas, and schema initialization remain centralized. Call `closeDatabase()` in test teardown when a test opens the shared connection. Foreign keys are enabled by the shared database module; preserve them for new relationships.

## Do / Don't

- **Do** keep SQL in Feature repositories or the smallest intentional shared database module.
- **Do** bind every value through prepared statements.
- **Do** use `crypto.randomUUID()` for new IDs and `Date.now()` for timestamps.
- **Do** use transactions for all-or-nothing multi-row writes.
- **Do** validate dynamic identifiers against an allowlist.
- **Don't** put SQL in Hono route composition or Vue code.
- **Don't** use an ORM, query builder, or hidden SQL wrapper.
- **Don't** interpolate request values into SQL.
- **Don't** swallow database errors; translate only known domain failures at the route boundary.
