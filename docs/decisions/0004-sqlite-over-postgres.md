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
- Migrations: checksummed, forward-only SQL files under owning Feature `server/migrations/` directories
- Backups: SQLite online backup API into `database/backups/`

## Consequences

Positive:
- Zero setup — no database server to install, just `npm run migrate`
- Synchronous queries — no async/await in query layer, simpler code
- AI writes standard SQL — no PostgreSQL-specific syntax to learn
- Online backups use SQLite's supported snapshot mechanism

Negative:
- SQLite has a single writer — use a client/server database for high write concurrency
- No built-in replication — acceptable for a local-disk application
- Limited data types (no arrays, no JSON operators) — use TEXT + JSON.parse for JSON
- File-based — keep the database and WAL files on storage local to the application host, not a shared network filesystem

## Alternatives considered

- **PostgreSQL** — more powerful, but requires installation, configuration, and a running server. Adds setup friction for a starter kit.
- **MySQL** — similar trade-offs to PostgreSQL, less standard SQL than Postgres.
- **Turso/libSQL** — SQLite-compatible with edge replication. Good option, but adds a dependency on a hosted service.
