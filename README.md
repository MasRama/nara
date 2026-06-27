# Nara

[![CI](https://github.com/MasRama/nara/actions/workflows/ci.yml/badge.svg)](https://github.com/MasRama/nara/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> **Clone it. Prompt it. Ship it.**
>
> The TypeScript starter kit designed for AI-assisted development.

Most starter kits fight your AI — complex abstractions, deep class hierarchies, magic ORMs. AI hallucinates, you debug. Nara is the opposite: flat patterns, raw SQL, plain functions, plus machine-readable docs and enforcement tooling that catches AI mistakes before they ship.

## What Makes Nara AI-First

| Layer | What | Why it matters |
|---|---|---|
| **Context** | `AGENTS.md` (root + 9 nested) + 8 skills + 10 ADRs | AI reads conventions, not guesses. Skills loaded on demand to save context window. |
| **Topology** | `CODEMAP.md` (111 files indexed) + `SCHEMA.md` (8 tables) | AI knows what exists before searching. Reads one file instead of 111. |
| **Scaffolding** | `npm run gen:resource products -- --fields="name:string,price:number"` | 7 files scaffolded with correct conventions. AI can't make structural mistakes. |
| **Enforcement** | `npm run lint:layers` (17 rules) + 258 tests + pre-commit hook | AI push violation → blocked. Naming, layer boundaries, import direction, anti-patterns. |
| **Verification** | `npm run check` (lint + typecheck + layer lint + tests + freshness) | One command. AI doesn't need to remember 4 commands. |
| **CI** | 4 steps: typecheck → layer lint → tests → freshness (strict) | Last line of defense. Cloud agents can't bypass with `--no-verify`. |
| **Policy** | Dependency policy (16 categories: allowed vs banned) | AI checks table before suggesting a dependency. No Prisma, no JWT, no React. |
| **Pitfalls** | 10 real mistakes AI makes, with fix | AI reads before coding. Prevents common errors. |

## Ship a Feature in a Single Prompt

Tell your AI assistant:

> *"Add a products CRUD."*

AI reads `AGENTS.md` → loads `crud-pattern.md` skill → runs `gen:resource` or writes code manually → runs `npm run check` → ships.

```
types/models.ts          →  interface Product { ... }
migrations/...ts         →  CREATE TABLE products (...)
queries/products.ts      →  findProductById(), createProduct(), ...
validators/schemas.ts    →  CreateProductSchema (Zod)
handlers/products.ts     →  productsPage, listProducts, addProduct, editProduct, removeProducts
routes/web.ts            →  Route.get/post/put/delete('/products', ...)
Pages/products.svelte    →  Full UI with table, forms, toast notifications
```

Or just run the generator:

```bash
npm run gen:resource products -- --fields="name:string,price:number"
```

## Quick Start

```bash
git clone https://github.com/MasRama/nara.git my-app && cd my-app
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:5555](http://localhost:5555). You're live.

> Migrations run automatically on startup. To reset: `npm run migrate:fresh`

## Architecture

```
Browser (Svelte 5 + Inertia.js)
  │  router.visit() for pages · axios for data
  ▼
Server (ultimate-express / uWebSockets.js)
  │
  ├── Handlers (functions)
  │     ├── Queries (raw SQL via better-sqlite3)
  │     └── Services (Auth, Logger, Storage, CacheStore, LoginThrottle)
  │
  └── SQLite (embedded, zero-config)
```

**Two route types:**

| Type | Called by | Returns |
|------|-----------|---------|
| Page | Browser navigation | `res.inertia('pageName', { data })` |
| Data | `axios` from Svelte | `jsonSuccess()`, `jsonError()`, `jsonCreated()` |

## Design Decisions

| Decision | Why |
|----------|-----|
| Functions, not classes | AI generates standalone functions more accurately than class hierarchies |
| Raw SQL, not ORM | AI writes SQL fluently — no query builder syntax to hallucinate |
| Flat file structure | AI finds files by name, not by navigating deep nesting |
| No magic | Every behavior is traceable — AI can read and reason about it |
| Minimal dependencies | Fewer APIs to learn = fewer mistakes from AI and humans alike |
| Descriptive handler names | `addUser` not `create` — AI understands intent from the name alone |

See [`docs/decisions/`](./docs/decisions/) for 10 ADRs explaining WHY each decision was made.

## What's Inside

| Area | Stack |
|------|-------|
| Server | ultimate-express (uWebSockets.js, 250k+ req/s) |
| Frontend | Svelte 5, Inertia.js, Tailwind CSS 4, Zag JS |
| Database | SQLite via better-sqlite3, raw SQL migrations |
| Auth | Session-based + Google OAuth + RBAC (roles & permissions) |
| Security | CSRF (double-submit cookie), rate limiting, XSS sanitization, security headers, timing-safe comparisons, login throttling |
| Storage | Local file storage with sharp image processing, magic byte validation |
| DX | Path aliases, structured logging (Pino), Vitest, Docker-ready |

## AI-First Tooling

```bash
# Scaffolding
npm run gen:resource products -- --fields="name:string,price:number"  # Scaffold full-stack resource

# Verification
npm run check              # All-in-one: lint + typecheck + layer lint + tests + freshness
npm run lint:layers        # 17 layer boundary + naming + import direction rules
npm run check:freshness    # Detect stale AGENTS.md (advisory) or --strict (CI)

# Topology
npm run codemap            # Regenerate CODEMAP.md (111 files, 278 exports)
npm run gen:schema         # Regenerate SCHEMA.md (8 tables, 55 columns)
```

## Database

Migrations are raw SQL strings executed by a lightweight migrator. No ORM, no query builder — just SQL.

```bash
npm run migrate            # Run pending migrations (auto-runs on startup)
npm run migrate:rollback   # Rollback last batch
npm run migrate:status     # Show pending/applied
npm run migrate:fresh      # Drop all + re-migrate + seed
npm run seed               # Run seeders
```

## Deployment

```bash
# Docker
docker build -t nara-app .
docker run -p 5555:5555 nara-app

# Manual
npm run build && npm start
```

Set `NODE_ENV=production` and configure SSL for production use. See [.env.production.example](./.env.production.example) for reference.

## Docs

| File | For | Read when |
|---|---|---|
| [`AGENTS.md`](./AGENTS.md) | Conventions, anti-patterns, structure | First time here |
| [`CODEMAP.md`](./CODEMAP.md) | Codebase topology (111 files, 278 exports) | Before searching the codebase |
| [`SCHEMA.md`](./SCHEMA.md) | Database schema (8 tables, 55 columns) | Before writing SQL |
| [`routes/web.ts`](./routes/web.ts) | All routes (51 lines) | Before adding routes |
| [`.agents/skills/`](./.agents/skills/SKILL.md) | 8 deep-dive skills (CRUD, SQL, auth, Inertia, errors, API, deps, pitfalls) | When touching that pattern |
| [`docs/decisions/`](./docs/decisions/README.md) | 10 ADRs explaining WHY decisions were made | When questioning a convention |

## Requirements

Node.js >= 20 · npm · That's it. SQLite is embedded.

## License

[MIT](./LICENSE) — Built by [MasRama](https://github.com/MasRama)
