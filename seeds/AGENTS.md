# Seeds

## Overview

Database seeders for populating initial/test data. Each file seeds one domain (table or related group). Seeders use raw Knex directly and may call factories for fake data.

Run: `node nara db:seed`
Reset + seed: `node nara db:fresh --seed`

## Structure

| File | Seeds |
|------|-------|
| `users.ts` | Roles, permissions, role_permissions, admin user + user_roles |

## Golden Pattern

```typescript
import type { Knex } from "knex";
import { randomUUID } from "crypto";
import dayjs from "dayjs";
// Optional: use factories for fake data
import { UserFactory } from "../database/factories";
import Authenticate from "../app/services/Authenticate";

export async function seed(knex: Knex): Promise<void> {
  // ─── 1. Clean tables in reverse FK order ───────────────────────────────────
  // Delete child tables before parent tables to avoid FK constraint errors
  await knex("user_roles").del();
  await knex("users").del();

  const now = dayjs().valueOf(); // bigint timestamp (matches timestampFormat: 'bigint')

  // ─── 2. Insert parent records ───────────────────────────────────────────────
  const adminId = randomUUID();
  await knex("users").insert([
    {
      id: adminId,
      name: "Admin",
      email: "admin@example.com",
      password: await Authenticate.hash("secret"),
      is_verified: true,
      created_at: now,
      updated_at: now,
    },
  ]);

  // ─── 3. Insert child / junction records ────────────────────────────────────
  const adminRole = await knex("roles").where("slug", "admin").first();
  await knex("user_roles").insert([
    { id: randomUUID(), user_id: adminId, role_id: adminRole.id, created_at: now },
  ]);

  // ─── 4. Use factory for bulk fake data (optional) ──────────────────────────
  await UserFactory.count(10).create(); // creates 10 random users
}
```

## Conventions

- **File name**: match the primary table being seeded (e.g. `users.ts`, `posts.ts`)
- **Export**: single named `export async function seed(knex: Knex)` — Knex runner calls this automatically
- **Clean order**: always delete child tables BEFORE parent tables (respect FK constraints)
- **Timestamps**: use `dayjs().valueOf()` for `bigint` columns, `new Date()` for `datetime` columns
- **Passwords**: always hash via `Authenticate.hash()` — never store plain text
- **IDs**: always `randomUUID()` from `crypto` — never hardcode UUIDs
- **Factories**: use for bulk fake data; use direct Knex inserts for fixed seed records (admin user, roles, permissions)
- **Idempotent**: seeders truncate tables first — safe to re-run via `db:seed`
