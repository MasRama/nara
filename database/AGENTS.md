# Database

Database files. Note: **migrations live at root `/migrations/`**, not here.

## Structure

| Path | Purpose |
|------|---------|
| `dev.sqlite3` | Development SQLite database (gitignored) |

> Seeds live at `/seeds/` (project root). Migrations at `/migrations/` (project root).

## Seed Pattern

```typescript
// seeds/posts.ts
import type SQLiteType from '../app/services/SQLite';
import { randomUUID } from 'crypto';

export function run(SQLite: typeof SQLiteType): void {
  const now = Date.now();
  SQLite.exec`
    INSERT INTO posts (id, title, content, created_at, updated_at)
    VALUES (${randomUUID()}, ${'First Post'}, ${'Hello'}, ${now}, ${now})
  `;
}
```

## Commands

```bash
npm run seed              # Run seeders
npm run migrate:fresh     # Drop all tables + re-migrate + seed (destroys data)
```

## Notes

- `dev.sqlite3` is gitignored — recreate with `npm run migrate:fresh`
- Database config: `app/config/env.ts` (DB path) + `app/services/SQLite.ts`
