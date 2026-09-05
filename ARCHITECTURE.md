# Nara Architecture

Nara is an **architecture-aware TypeScript application kit**. Build by feature, not by layer.

Nara stays useful after project creation: compose capabilities from explicit features, understand the feature graph and its statically provable application integrations with deterministic CLI facts (no AI provider required), protect current boundaries with `nara doctor`, and protect architecture change with `nara guard --base origin/main` before new debt enters unnoticed.

This document is the current architecture authority. History lives in [`docs/archive/v3/](./docs/archive/v3/)` and [`docs/decisions/`](./docs/decisions/).

- **Compose** — build from explicit business features (`nara make feature`, `nara add`).
- **Understand** — inspect the architecture deterministically (`nara inspect`, `nara context`, `nara impact`, each with `--json`), including application consumers and route mounts, and describe how it is changing (`nara diff --base main`).
- **Protect** — validate current architecture (`nara doctor`, plus `--json`) and protect architecture change (`nara guard --base origin/main`, plus `--json`): the change ratchet fails only on newly introduced diagnostics.

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
- Application integration is inferred from the canonical composition roots only: `src/app/server.ts` for Hono public-boundary imports and static `.route()` mounts, and `src/app/router.ts` for Vue web-boundary imports and static route records. Dynamic or non-canonical composition is not reported.
- Feature dependencies must be acyclic.

Details: [`docs/v3/feature-model.md`](./docs/v3/feature-model.md).

## Application and shared layers

- `src/app/` composes features: `server.ts` (Hono composition, production static/SPA delivery), `router.ts` (Vue Router: app pages + feature pages via `web/index.ts` barrels), `App.vue`, `pages/`, `layouts/`. The CLI records deterministic application imports, server mounts, and browser routes from the two canonical roots; it does not add an application graph node or claim runtime reachability.
- `src/shared/` is small business-neutral infrastructure only: `config/`, `database/` (connection, migration/seed engines — features own their SQL), `errors/`, `logging/`, `security/`. Never a second global services/repositories layer.
- `resources/app.ts` is a thin Vite entry mounting the app shell. `official-features/` holds installable open-code features (`health`, `audit`).

## HTTP and contracts

- Features expose Hono sub-applications; `src/app/server.ts` mounts them (`/api/auth`, `/api/users`, …) plus `/health` and `/ready`. These static public-boundary imports and mount paths are architecture facts, not runtime health checks.
- JSON shape: `{ success: true, message, data? }` / `{ success: false, message, code, errors? }`. English messages. Zod `safeParse` at the route boundary; `src/app/error-handler.ts` maps domain errors.
- Contracts live in the owning feature's `contract.ts`; browser code consumes them through the feature's `web/` typed client. No global RPC abstraction.

## CLI

```text
nara new <name>            Create a runnable application
nara make feature <name>   Create the canonical feature skeleton
nara add <feature>         Install an official open-code feature
nara doctor [--json]       Validate architecture
nara guard --base <ref> [--head <ref>] [--json]
                           Fail when the change introduces new violations
nara inspect <feature> [--json]
nara context <feature>|--file <path> [--json]
nara impact <feature> [--json]
nara diff --base <ref> [--head <ref>] [--json]
```

## Product lifecycle

Five distinct things; do not conflate them:

1. **Ecosystem/runtime stack** — Hono, Vue, SQLite, TypeScript. Nara never
   wraps these behind a custom runtime.
2. **Nara's architecture model** — feature ownership, public boundaries, deterministic discovery, and statically provable application integrations (this document).
3. **Nara CLI/tooling** — `nara` is a development-time architecture
   companion, not a production runtime abstraction. It ships as the
   publishable npm package `@nara-web/cli` at `packages/nara` (`bin`
   exposes the `nara` executable from the staged CLI, `files` includes
   only the staged `dist/` and `official-features/` source) and will be
   acquired from the registry once published; it has not been published
   yet.
4. **Generated applications** — `nara new` output: the minimal canonical
   application (health-only, no database, no auth). Each carries the
   creating CLI as an exact-pinned `@nara-web/cli` devDependency, so
   `npm run check` (which ends in `nara doctor`) and
   `nara add/inspect/context/impact/diff/guard` work reproducibly from
   the project's own install. Guard is an explicit CI/review command
   there (`npx nara guard --base origin/main`) because a new project has
   no universal baseline ref to assume.
5. **Official open-code features** — optional installable source
   (`health`, `audit`). `nara add` copies versioned package source into
   `src/features/<name>`; the result is ordinary project code.

The repository root is the development/reference application: it proves
richer capabilities (auth, RBAC, users, assets, SQLite lifecycle) but is
not the starting point for new products. Cloning it is for Nara
contributors; building on Nara starts with `nara new`.

## Versioning

Nara does not assign a new minor version when development of a single
capability begins. Minor versions represent coherent public release
milestones. `main` may contain unreleased additive capabilities while
retaining the latest released package version until release preparation
begins. SemVer still applies at release time: a bugfix-only public
release is a patch candidate, an additive public capability is a minor
candidate, and an incompatible public contract is a major candidate.
Release numbering is decided when a release bundle is ready, not when
the first commit lands.

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
