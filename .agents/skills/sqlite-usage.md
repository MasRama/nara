---
authority: canon
last_verified: 2026-06-28
trigger: Writing SQL queries, transactions, dynamic updates, or any database access
---

# SQLite Usage

> **Authority:** canon — current source of truth for SQLite access patterns.

## When to use

Any time you touch the database. Queries live in `app/queries/` — handlers never import `SQLite` directly.

## Static SQL → Template Literals (preferred)

```typescript
import SQLite from '@services/SQLite';

const user = SQLite.one<User>`SELECT * FROM users WHERE id = ${id}`;       // single row or undefined
const users = SQLite.many<User>`SELECT * FROM users WHERE active = 1`;     // array (never undefined)
SQLite.exec`INSERT INTO users (id, email) VALUES (${id}, ${email})`;       // run (returns RunResult)
```

Template literals auto-parameterize interpolated values — safe from SQL injection.

## Dynamic SQL → String Params (variable columns, IN clauses)

```typescript
const row = SQLite.get<User>('SELECT * FROM users WHERE id = ?', [id]);    // single row
const rows = SQLite.all<User>('SELECT * FROM users WHERE id IN (?)', ids); // array
SQLite.run('UPDATE users SET name = ? WHERE id = ?', [name, id]);          // run
```

Use string params when:
- Column list is dynamic (e.g. `ORDER BY ${column}`)
- `IN (?)` clauses with array values
- Any SQL where template literal interpolation would not work

## Transactions

```typescript
SQLite.transaction(() => {
  SQLite.exec`INSERT INTO users ...`;
  SQLite.exec`INSERT INTO profiles ...`;
});
```

Auto-rollback on throw. Use for any multi-statement write that must be atomic.

## Dynamic Update (auto-skips undefined, converts booleans, sets updated_at)

```typescript
SQLite.update('users', { id }, { name, email, avatar: undefined });
// → UPDATE users SET name = ?, email = ? WHERE id = ?
// undefined fields are skipped, booleans converted to 0/1, updated_at auto-set
```

## Pagination Pattern

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

## Junction Table Operations

```typescript
// Insert
SQLite.exec`INSERT INTO user_roles (id, user_id, role_id, created_at) VALUES (${randomUUID()}, ${userId}, ${roleId}, ${Date.now()})`;

// Delete all for a user (before re-sync)
SQLite.exec`DELETE FROM user_roles WHERE user_id = ${userId}`;

// Fetch with join
const roles = SQLite.many<Role>`
  SELECT r.* FROM roles r
  JOIN user_roles ur ON ur.role_id = r.id
  WHERE ur.user_id = ${userId}
`;
```

## Native Database Access (rare)

```typescript
const db = SQLite.raw(); // better-sqlite3 instance
```

Only for operations not covered by the wrapper (e.g. custom prepared statements with complex reuse).

## Do / Don't

- **Do** keep all SQL in `app/queries/` — handlers call query functions, never write SQL
- **Do** use template literals for static SQL — auto-parameterized, safe
- **Do** use string params for dynamic SQL (IN clauses, variable columns)
- **Do** wrap multi-statement writes in `SQLite.transaction()`
- **Do** use `SQLite.update()` for partial updates — it handles undefined/boolean/timestamps
- **Don't** interpolate user input directly into SQL strings — use template literals or `?` params
- **Don't** use `SQLite.raw()` in queries unless the wrapper genuinely cannot do what you need
- **Don't** catch SQLite errors in queries — let them bubble to handlers
