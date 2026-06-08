# Database

Database files. Note: **migrations live at root `/migrations/`**, not here.

## Structure

| Path | Purpose |
|------|---------|
| `factories/` | Model factories for test/seed data generation |
| `dev.sqlite3` | Development SQLite database (gitignored) |

> Seeds live at `/seeds/` (project root). Migrations at `/migrations/` (project root).

## Seed Pattern

```typescript
// seeds/posts.ts
import type { Knex } from "knex";
import { randomUUID } from "crypto";

export async function seed(knex: Knex): Promise<void> {
  await knex("posts").del();

  const now = Date.now();
  await knex("posts").insert([
    { id: randomUUID(), title: "First Post", content: "Hello", created_at: now, updated_at: now },
  ]);
}
```

## Commands

```bash
npm run seed              # Run seeders
npm run migrate:fresh     # Rollback all + re-migrate + seed (destroys data)
```

## Notes

- `dev.sqlite3` is gitignored — recreate with `npm run migrate:fresh`
- Database config: `knexfile.ts` at project root
