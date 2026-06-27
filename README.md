# Nara

[![CI](https://github.com/MasRama/nara/actions/workflows/ci.yml/badge.svg)](https://github.com/MasRama/nara/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

> **Clone it. Prompt it. Ship it.**
>
> The TypeScript starter kit designed for AI-assisted development.

Most starter kits fight your AI — complex abstractions, deep class hierarchies, magic ORMs. AI hallucinates, you debug. Nara is the opposite: flat patterns, raw SQL, plain functions. AI picks up the conventions and generates working code on the first try.

## Design Decisions

| Decision | Why |
|----------|-----|
| Functions, not classes | AI generates standalone functions more accurately than class hierarchies |
| Raw SQL, not ORM | AI writes SQL fluently — no query builder syntax to hallucinate |
| Flat file structure | AI finds files by name, not by navigating deep nesting |
| No magic | Every behavior is traceable — AI can read and reason about it |
| Minimal dependencies | Fewer APIs to learn = fewer mistakes from AI and humans alike |

## Ship a Feature in a Single Prompt

Tell your AI assistant:

> *"Add a products CRUD."*

That's it. AI picks up Nara's patterns and generates the full stack:

```
types/models.ts       →  interface Product { ... }
queries/products.ts   →  findProductById(), createProduct(), ...
handlers/products.ts  →  index(), show(), store(), update(), destroy()
routes/web.ts         →  Route.get('/products', [Auth], products.index)
Pages/products.svelte →  Full UI with table, forms, toast notifications
```

No boilerplate generators needed. The pattern **is** the generator.

## Quick Start

```bash
git clone https://github.com/MasRama/nara.git my-app && cd my-app
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:5555](http://localhost:5555). You're live.

> Migrations run automatically on startup. To reset the database: `npm run migrate:fresh`

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

## Database

Migrations are raw SQL strings executed by a lightweight migrator (`app/services/Migrator.ts`). No ORM, no query builder — just SQL.

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

- **[AGENTS.md](./AGENTS.md)** — Full knowledge base: code patterns, path aliases, SQLite API, error handling, anti-patterns.

## Requirements

Node.js >= 20 · npm · That's it. SQLite is embedded.

## License

[MIT](./LICENSE) — Built by [MasRama](https://github.com/MasRama)
