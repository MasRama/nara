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

Use raw SQL with `better-sqlite3`. The shared database layer exposes the configured connection and lifecycle engines; Feature repositories use ordinary prepared statements.

Feature-owned schema changes are explicit SQL files under `src/features/<feature>/server/migrations/`. They are applied forward-only, transactionally, and recorded with checksums. Reference data uses Feature-owned idempotent seeds under `server/seeds/`.

SQL remains inspectable in source. Nara does not add an ORM, query builder, migration DSL, or schema inference layer.

## Consequences

Positive:
- AI can write any SQL query without learning a DSL
- SQL is explicit and inspectable — no hidden N+1 problems
- Zero ORM lock-in — switching databases means rewriting queries, not learning a new ORM
- Smaller dependency tree

Negative:
- Schema changes require developers to write and review explicit SQL migrations
- No type-safe query builder (types come from TypeScript interfaces, not the query)
- Developers must know SQL (acceptable for an AI-first kit — AI knows SQL)

## Alternatives considered

- **Prisma** — excellent DX, but adds a schema language (Prisma DSL) that AI must learn, and generates queries that are hard to inspect. Also requires a separate generate step.
- **Drizzle** — lighter than Prisma, SQL-like syntax, but still an abstraction layer. AI writes SQL better than Drizzle syntax.
- **Knex** — query builder, not ORM. Better than ORMs but still hides SQL behind method chains.
- **Sequelize** — heavy, class-based, poor AI ergonomics.
