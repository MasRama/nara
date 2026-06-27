# ADR 0001: Raw SQL over ORM

Date: 2025-01-15
Status: Accepted

## Context

Nara is an AI-first starter kit. AI code generators (Claude, GPT, Cursor) write SQL fluently — it's in their training data. ORMs add a translation layer that:
- Hides the actual SQL from the AI (AI must learn the ORM's DSL)
- Generates suboptimal queries that the AI can't inspect
- Adds dependencies that may have breaking changes
- Makes debugging harder (SQL is hidden behind method chains)

## Decision

Use raw SQL via `better-sqlite3` with a thin wrapper (`app/services/SQLite.ts`) that provides:
- Template literal parameterization (auto-safe from injection)
- `one()`, `many()`, `exec()` for static SQL
- `get()`, `all()`, `run()` for dynamic SQL with `?` params
- `update()` for partial updates (auto-skips undefined, converts booleans)
- `transaction()` for atomic multi-statement writes

All SQL lives in `app/queries/` — handlers never write SQL.

## Consequences

Positive:
- AI can write any SQL query without learning a DSL
- SQL is explicit and inspectable — no hidden N+1 problems
- Zero ORM lock-in — switching databases means rewriting queries, not learning a new ORM
- Smaller dependency tree

Negative:
- No automatic migrations from schema changes (manual migrations)
- No type-safe query builder (types come from TypeScript interfaces, not the query)
- Developers must know SQL (acceptable for an AI-first kit — AI knows SQL)

## Alternatives considered

- **Prisma** — excellent DX, but adds a schema language (Prisma DSL) that AI must learn, and generates queries that are hard to inspect. Also requires a separate generate step.
- **Drizzle** — lighter than Prisma, SQL-like syntax, but still an abstraction layer. AI writes SQL better than Drizzle syntax.
- **Knex** — query builder, not ORM. Better than ORMs but still hides SQL behind method chains.
- **Sequelize** — heavy, class-based, poor AI ergonomics.
