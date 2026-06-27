# ADR 0004: SQLite over PostgreSQL for starter kit

Date: 2025-01-15
Status: Accepted

## Context

Nara is a starter kit. The database choice affects:
- Setup complexity (does the user need to install a database server?)
- Deployment options (can it run on a $5 VPS? a container? a serverless function?)
- AI ergonomics (can AI write queries without knowing the database version?)
- Performance characteristics (is it fast enough for a starter?)

## Decision

Use SQLite via `better-sqlite3` (synchronous, native binding).

- Dev database: `database/dev.sqlite3`
- Production database: `database/production.sqlite3`
- Migrations: TypeScript files in `migrations/` with `up`/`down` SQL strings

## Consequences

Positive:
- Zero setup — no database server to install, just `npm run migrate`
- Single-file deployment — the database is a file, easy to backup/copy
- Synchronous queries — no async/await in query layer, simpler code
- AI writes standard SQL — no PostgreSQL-specific syntax to learn
- Fast enough for starter kit workloads (thousands of concurrent users with WAL mode)

Negative:
- No concurrent writes (single writer) — acceptable for starter kit, switch to Postgres for high-write apps
- No built-in replication — acceptable for starter kit
- Limited data types (no arrays, no JSON operators) — use TEXT + JSON.parse for JSON
- File-based — can't run on serverless (Lambda) without external storage

## Alternatives considered

- **PostgreSQL** — more powerful, but requires installation, configuration, and a running server. Adds setup friction for a starter kit.
- **MySQL** — similar trade-offs to PostgreSQL, less standard SQL than Postgres.
- **Turso/libSQL** — SQLite-compatible with edge replication. Good option, but adds a dependency on a hosted service.
