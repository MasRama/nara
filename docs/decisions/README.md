# Architecture Decision Records (ADR)

> ADRs explain WHY decisions were made, not just WHAT the rules are.
> AGENTS.md tells you the rules; ADRs tell you the reasoning.

## What is an ADR?

A short markdown file (1-2 pages) that records a significant architectural decision:

- **Context** — what problem were we solving?
- **Decision** — what did we choose?
- **Consequences** — what trade-offs did we accept?
- **Alternatives considered** — what else was on the table?

## Why ADRs for AI-first?

AI agents that understand WHY a convention exists make better decisions:

- An agent that knows "raw SQL was chosen because ORMs add abstraction that hides intent from AI" won't suggest adding Prisma
- An agent that knows "functions over classes because classes add ceremony without value in a function-first codebase" won't refactor to OOP
- An agent that understands the v2 Inertia decision (now superseded) knows why v3 uses direct Vue + Vite + TypeScript and feature-scoped contracts.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](./0001-raw-sql-over-orm.md) | Raw SQL over ORM | Accepted |
| [0002](./0002-functions-over-classes.md) | Functions over classes | Accepted |
| [0003](./0003-inertia-over-separate-api.md) | Inertia.js over separate API + SPA | Superseded by ARCHITECTURE.md (Locked stack) |
| [0004](./0004-sqlite-over-postgres.md) | SQLite over PostgreSQL for starter kit | Accepted |
| [0005](./0005-session-auth-over-jwt.md) | Session-based auth over JWT | Accepted |
| [0006](./0006-zod-over-joi.md) | Zod over Joi for validation | Accepted |
| [0007](./0007-bits-ui-over-custom-ui.md) | Bits UI over custom UI primitives | Superseded by ARCHITECTURE.md (Locked stack) |
| [0008](./0008-agents-md-over-readme.md) | AGENTS.md as primary AI context | Accepted with v3 structure notes |
| [0009](./0009-descriptive-handler-names.md) | Descriptive handler names over REST conventions | Accepted |
| [0010](./0010-english-error-messages.md) | English for user-facing messages | Accepted |
| [0011](./0011-pinned-local-cli-over-global-install.md) | Pinned local Nara CLI over global install | Accepted |

## Format

```markdown
# ADR NNNN: Title

Date: YYYY-MM-DD
Status: Accepted | Superseded by NNNN | Deprecated

## Context
What problem are we solving?

## Decision
What did we choose?

## Consequences
Positive: ...
Negative: ...

## Alternatives considered
- Option A — why not
- Option B — why not
```

## When to add an ADR

- Adding a new dependency
- Changing a fundamental pattern (e.g. switching from SQLite to Postgres)
- Making a trade-off that future developers might question
- Deciding NOT to do something that seems obvious (e.g. "why no ORM?")
