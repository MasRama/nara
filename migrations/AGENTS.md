---
authority: canon
last_verified: 2026-06-28
scope: migrations
---

# Migrations

> **Authority:** canon — current source of truth for migration conventions.

TypeScript migration files containing raw SQL strings. Each file exports `up` (apply) and `down` (rollback) as SQL strings, executed by `app/services/Migrator.ts`.

## Naming Convention

`YYYYMMDDHHMMSS_description.ts` — timestamp ensures correct order.

Create new: add a `.ts` file in `migrations/` with the next timestamp.

## Pattern

```typescript
// migrations/20260301000000_create_products.ts
export const up = `
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  user_id TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products (user_id);
`;

export const down = `
DROP INDEX IF EXISTS idx_products_user_id;
DROP TABLE IF EXISTS products;
`;
```

## Data Migration Pattern (with logic)

For migrations needing JS logic (data transforms, conditional SQL), export a function instead:

```typescript
import type SQLiteType from '../app/services/SQLite';
import { randomUUID } from 'crypto';

export function up(SQLite: typeof SQLiteType): void {
  const users = SQLite.all<{ id: string; name: string }>('SELECT id, name FROM users');
  for (const u of users) {
    SQLite.run('UPDATE users SET name = ? WHERE id = ?', [u.name.trim(), u.id]);
  }
}

export function down(SQLite: typeof SQLiteType): void {
  // no-op or reverse logic
}
```

## Junction Table Pattern

```typescript
export const up = `
CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  created_at INTEGER,
  UNIQUE (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
);
`;

export const down = `DROP TABLE IF EXISTS user_roles;`;
```

## ID Types

| Use case | Column definition |
|----------|------------------|
| Most tables | `id TEXT PRIMARY KEY NOT NULL` (UUID from `randomUUID()`) |
| Auto-increment (tokens, logs) | `id INTEGER PRIMARY KEY AUTOINCREMENT` |

## Timestamps

| Use case | Column definition |
|----------|------------------|
| Most tables | `created_at INTEGER` (unix ms via `Date.now()`) |
| Junction / log tables | Omit timestamps |

## Boolean

SQLite has no native boolean — use `INTEGER` with `0`/`1`. `SQLite.update()` auto-converts booleans.

## Rules

- Use `CREATE TABLE IF NOT EXISTS` for idempotency
- `down` must reverse `up` (drop tables/indexes created by `up`)
- Never modify existing migrations — create a new one
- Foreign keys: always `ON DELETE CASCADE` unless orphan retention is intentional
- Default timestamps: `INTEGER` for unix milliseconds

## Commands

```bash
npm run migrate            # Run pending migrations (also auto-runs on app start)
npm run migrate:rollback   # Rollback last batch
npm run migrate:status     # Show pending/applied
npm run migrate:fresh      # Drop all tables + re-migrate + seed
npm run seed               # Run seeds
```

## How It Works

The migrator (`app/services/Migrator.ts`) tracks applied migrations in a `migrations` table. On app startup, `createApp()` auto-runs `migrate()` unless `autoMigrate: false` is set. Each migration runs in a transaction with its name recorded on success.
