# Migrations

Knex database migrations. Each file has `up()` (apply) and `down()` (rollback).

## Naming Convention

`YYYYMMDDHHMMSS_description.ts` — timestamp ensures correct order.

Generate: `npx knex migrate:make create_products_table`

## Pattern

```typescript
import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("products", (table) => {
    table.string("id").primary().notNullable();
    table.string("name", 255).notNullable();
    table.text("description").nullable();
    table.integer("price").unsigned().notNullable();
    table.boolean("is_active").defaultTo(true);
    table.string("user_id").references("id").inTable("users").onDelete("CASCADE");
    table.bigInteger("created_at").notNullable();
    table.bigInteger("updated_at").notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("products");
}
```

## Junction Table Pattern

```typescript
export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("user_roles", (table) => {
    table.uuid("user_id").references("id").inTable("users").onDelete("CASCADE").notNullable();
    table.uuid("role_id").references("id").inTable("roles").onDelete("CASCADE").notNullable();
    table.unique(["user_id", "role_id"]);
  });
}
```

## ID Types

| Use case | Column definition |
|----------|------------------|
| Most tables | `table.string('id').primary().notNullable()` (UUID from `randomUUID()`) |
| Auto-increment (tokens, logs) | `table.increments('id').primary()` |

## Timestamps

| Use case | Column definition |
|----------|------------------|
| Most tables | `table.bigInteger('created_at').notNullable()` (unix ms via `Date.now()`) |
| Junction / log tables | Omit timestamps |

## Rules

- `down()` must exactly reverse `up()`
- Never modify existing migrations — create a new one
- Foreign keys: always `.onDelete('CASCADE')` unless orphan retention is intentional
- Default timestamps: `bigInteger` for unix milliseconds

## Commands

```bash
npm run migrate            # Run pending migrations
npm run migrate:rollback   # Rollback last batch
npm run migrate:fresh      # Rollback all + re-migrate + seed
npm run migrate:status     # Show pending/applied
npm run migrate:make name  # Generate new migration
```
