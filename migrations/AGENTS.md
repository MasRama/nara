# Migrations

## Overview

Knex database migrations. Each file describes one schema change with `up()` (apply) and `down()` (rollback).

## Naming Convention

`YYYYMMDDHHMMSS_description.ts` — timestamp ensures correct order.

Use CLI to generate: `node nara make:migration create_products_table`

## Golden Pattern

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("products", (table) => {
    // Primary key — always string UUID
    table.string("id").primary().notNullable();

    // String fields
    table.string("name", 255).notNullable();
    table.text("description").nullable();

    // Numbers
    table.integer("price").unsigned().notNullable();
    table.boolean("is_active").defaultTo(true);

    // Foreign key
    table.string("user_id").references("id").inTable("users").onDelete("CASCADE");

    // Timestamps — use bigInteger for unix ms, or timestamp for db dates
    table.bigInteger("created_at").notNullable();
    table.bigInteger("updated_at").notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("products");
}
```

## Existing Migrations (in order)

| File | Table |
|------|-------|
| `20230513055909_users.ts` | `users` |
| `20230514062913_sessions.ts` | `sessions` |
| `20240101000001_create_password_reset_tokens.ts` | `password_reset_tokens` |
| `20250110233301_assets.ts` | `assets` |
| `20260214120000_create_roles.ts` | `roles` |
| `20260214120001_create_permissions.ts` | `permissions` |
| `20260214120002_create_role_permissions.ts` | `role_permissions` |
| `20260214120003_create_user_roles.ts` | `user_roles` |

## ID Types — Choose the Right One

| Use case | Column definition |
|----------|------------------|
| Most tables (users, posts, etc.) | `table.uuid('id').primary().notNullable()` |
| Legacy / third-party integrations | `table.string('id').primary().notNullable()` |
| Auto-increment (tokens, logs, sequences) | `table.increments('id').primary()` |

**Default: `table.uuid('id')`** — only use `increments` for tables that don't need UUIDs (e.g. `password_reset_tokens`).

## Timestamp Formats — Choose the Right One

| Use case | Column definition | Model `timestampFormat` |
|----------|------------------|------------------------|
| Most tables | `table.bigInteger('created_at').notNullable()` | `'bigint'` (unix ms) |
| File records, dates matter | `table.timestamp('created_at')` | `'datetime'` (Date object) |
| Junction / log tables | _(omit timestamps)_ | `useTimestamps: false` |

**Default: `bigInteger`** — matches `Date.now()` in models.

## Junction Table Pattern

For many-to-many (e.g. `user_roles`, `role_permissions`):

```typescript
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("user_roles", (table) => {
    table.uuid("user_id").references("id").inTable("users").onDelete("CASCADE").notNullable();
    table.uuid("role_id").references("id").inTable("roles").onDelete("CASCADE").notNullable();
    table.unique(["user_id", "role_id"]);  // prevent duplicates
    // No id column, no timestamps for junction tables
  });
}
```

## Rules

- **Default ID**: use `table.uuid('id').primary()` — only use `increments()` for special cases (see above)
- `down()` must exactly reverse `up()` (drop the table or remove the column)
- Never modify existing migrations — create a new one instead
- Timestamps: use `bigInteger` for unix milliseconds by default; `timestamp` only when the column is a real date/time value
- Foreign keys: always `.onDelete('CASCADE')` unless orphan retention is intentional

## CLI Commands

```bash
node nara db:migrate     # Run pending migrations
node nara db:rollback    # Rollback last batch
node nara db:fresh       # Drop all + re-migrate (destroys data)
node nara db:status      # Show pending/applied status
```
