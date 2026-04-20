# Database

## Overview

Database files and factories. Note: **migrations live at root `/migrations/`**, not here.

## Structure

| Path | Purpose |
|------|---------|
| `factories/` | Model factories for test/seed data generation |
| `dev.sqlite3` | Development SQLite database (gitignored) |
| `production.sqlite3` | Production SQLite database (gitignored) |

> ⚠️ Seeders live at `/seeds/` (project root), NOT in this folder. Migrations also live at `/migrations/` (project root).

## Factories

See `database/factories/AGENTS.md` for factory patterns.

## Seeds (at /seeds/ root)

Seeders use Knex directly (not factories alone) — they insert roles, permissions, and seed users:

```typescript
// seeds/posts.ts
import type { Knex } from "knex";
import { randomUUID } from "crypto";
import dayjs from "dayjs";

export async function seed(knex: Knex): Promise<void> {
  // 1. Clean dependent tables first (respect FK order)
  await knex("posts").del();

  const now = dayjs().valueOf(); // bigint timestamp

  // 2. Insert seed data directly
  await knex("posts").insert([
    { id: randomUUID(), title: "First Post", content: "Hello", created_at: now, updated_at: now },
  ]);
}
```

See `/seeds/AGENTS.md` for the full seeder pattern.

Run seeds: `node nara db:seed`
Fresh reset + seed: `node nara db:fresh --seed`

## Important Notes

- **Seeds**: `/seeds/*.ts` (project root) — one file per domain, named after the table
- **Migrations**: `/migrations/*.ts` (project root) — never inside `database/`
- **Factories**: `database/factories/` — for generating fake/random data
- `dev.sqlite3` is gitignored — recreate with `node nara db:fresh`
- Database config: `knexfile.ts` at project root
- Check migration state: `node nara db:status`
