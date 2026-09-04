# Nara Architecture

Nara is an **architecture-aware TypeScript application kit**. Build by feature, not by layer.

Nara stays useful after project creation: compose capabilities from explicit features, understand the feature graph with deterministic CLI facts (no AI provider required), and protect boundaries with `nara doctor` before drift becomes debt.

This document is the current architecture authority. History lives in [`docs/archive/v3/](./docs/archive/v3/)` and [`docs/decisions/`](./docs/decisions/).

## Product pillars

- **Compose** — build from explicit business features (`nara make feature`, `nara add`).
- **Understand** — inspect the architecture deterministically (`nara inspect`, `nara context`, `nara impact`, each with `--json`).
- **Protect** — validate boundaries before drift becomes debt (`nara doctor`, plus `--json`).

## Locked stack

| Area | Choice |
|---|---|
| Language | TypeScript (application and CLI) |
| Runtime | Node.js ≥ 22 |
| HTTP | Hono + `@hono/node-server` + `node:http`, used directly (no Nara HTTP wrapper) |
| Frontend | Vue 3 + Vite + TypeScript, `vue-router` for browser routes (sole supported stack; no React, Svelte, Nuxt, SSR) |
| Database | SQLite via `better-sqlite3`, raw SQL in feature repositories (no ORM) |
| Validation | Zod, feature-owned schemas |
| Auth | Session cookies, owned by the `auth` feature (no second mechanism without explicit spec) |
| Tests | Vitest (+ `jsdom` for browser code) |

No native HTTP engine: Ultimate Express / uWebSockets.js are intentionally unsupported (portability over synthetic benchmarks; see `docs/decisions/` history). Other native packages (`better-sqlite3`, Sharp) are legitimate and unrelated to that contract.

## The feature model

The primary unit is a **feature**: one business capability kept together.

```text
src/features/billing/
├── contract.ts       # feature-owned types and runtime input schemas
├── index.ts          # general/server-facing public boundary
├── server/           # routes, services, repositories (+ migrations/, seeds/)
├── web/              # optional browser code (+ index.ts browser-safe boundary)
└── tests/            # feature behavior tests
```

Rules:

- `src/features/<feature>/index.ts` is the general/server-facing public boundary. Cross-feature server use imports only from there.
- `src/features/<feature>/web/index.ts` is the optional browser-safe boundary. App composition (`src/app/`) and legitimate browser-safe feature dependencies import browser surfaces only from there.
- Internals (`server/*`, `web/pages/*`, `web/components/*`, `web/client`) are private. Deep imports across features are invalid.
- Feature dependencies must be acyclic.

Details: [`docs/v3/feature-model.md`](./docs/v3/feature-model.md).

## Application and shared layers

- `src/app/` composes features: `server.ts` (Hono composition, production static/SPA delivery), `router.ts` (Vue Router: app pages + feature pages via `web/index.ts` barrels), `App.vue`, `pages/`, `layouts/`. No business logic that belongs in a feature.
- `src/shared/` is small business-neutral infrastructure only: `config/`, `database/` (connection, migration/seed engines — features own their SQL), `errors/`, `logging/`, `security/`. Never a second global services/repositories layer.
- `resources/app.ts` is a thin Vite entry mounting the app shell. `official-features/` holds installable open-code features (`health`, `audit`).

## HTTP and contracts

- Features expose Hono sub-applications; `src/app/server.ts` mounts them (`/api/auth`, `/api/users`, …) plus `/health` and `/ready`.
- JSON shape: `{ success: true, message, data? }` / `{ success: false, message, code, errors? }`. English messages. Zod `safeParse` at the route boundary; `src/app/error-handler.ts` maps domain errors.
- Contracts live in the owning feature's `contract.ts`; browser code consumes them through the feature's `web/` typed client. No global RPC abstraction.

## CLI

```text
nara new <name>            Create a runnable application
nara make feature <name>   Create the canonical feature skeleton
nara add <feature>         Install an official open-code feature
nara doctor [--json]       Validate architecture
nara inspect <feature> [--json]
nara context <feature> [--json]
nara impact <feature> [--json]
```

Reference: [`docs/v3/cli.md`](./docs/v3/cli.md). Database lifecycle (`migrate`, `seed`, `db:check`, …): [`docs/v3/database-lifecycle.md`](./docs/v3/database-lifecycle.md).

## What Nara does not build

No custom runtime, HTTP framework, frontend framework, ORM, auth framework, DI container, RPC system, compiler, language, build tool, package manager, monorepo tool, multi-stack configurator, or AI wrapper. Nara organizes and inspects the application; the ecosystem owns the stack.

## Design filters

1. Does this strengthen Compose, Understand, or Protect? If not, leave it out.
2. Can an existing ecosystem tool solve it? If yes, use it.
3. Can Nara infer it from code and convention? If yes, infer it — no duplicated metadata.

## Further reading

- [`README.md`](./README.md) — first run, topology, deployment
- [`docs/v3/feature-model.md`](./docs/v3/feature-model.md) — ownership and boundaries
- [`docs/v3/cli.md`](./docs/v3/cli.md) — CLI and JSON reference
- [`docs/v3/architecture-philosophy.md`](./docs/v3/architecture-philosophy.md) — Compose, Understand, Protect
- [`docs/v3/database-lifecycle.md`](./docs/v3/database-lifecycle.md) — SQLite lifecycle
- [`docs/v3/migration-v2-v3.md`](./docs/v3/migration-v2-v3.md) — v2 porting guide
- [`docs/v3/v2-inventory.md`](./docs/v3/v2-inventory.md) — v2 capability inventory
- [`docs/decisions/`](./docs/decisions/) — why past decisions were made
