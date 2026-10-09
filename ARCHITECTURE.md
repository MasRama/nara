# Nara Architecture

Nara is an **architecture-aware TypeScript application kit**. Build by feature, not by layer.

Nara stays useful after project creation: compose capabilities from explicit features, understand the feature graph, statically provable public API consumers and public-boundary provenance, and canonical application integrations with deterministic CLI facts (no AI provider required), protect current boundaries with `nara doctor`, and protect architecture change with `nara guard --base origin/main` before new debt enters unnoticed.

This document is the current architecture authority. Obsolete implementation history stays in Git, not in the active documentation set.

- **Compose** — build from explicit business features (`nara make feature`, `nara add`), including Feature assemblies with application-owned bindings.
- **Own** — application-owned code stays application-owned: bindings, provider choice, authorization policy, manifests, tests, and data change only with application consent, while Nara keeps reasoning across those boundaries.
- **Understand** — inspect the architecture deterministically (`nara inspect`, `nara context`, `nara impact`, each with `--json`), including Feature public-symbol consumers, boundary export provenance, explicitly type-only versus value-capable syntax evidence, application consumers, and route mounts, and describe how it is changing (`nara diff --base main`).
- **Evolve** — keep official open-code Features current with deterministic local lineage (`nara evolve`), while validating every candidate against the source-derived architecture model.
- **Verify** — adopt upstream changes through explicit Feature Transitions (`nara evolve --transition` / `--verify` / `--accept`): candidate application, obligations, scoped evidence, VERIFIED / BLOCKED / UNVERIFIED outcomes, and exact-candidate acceptance before lineage advances.
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

No native HTTP engine: Ultimate Express / uWebSockets.js are intentionally unsupported; portability is preferred over a custom native HTTP runtime. Other native packages (`better-sqlite3`, Sharp) are legitimate and unrelated to that contract.

## The feature model

The primary unit is a **feature**: one business capability kept together.

```text
src/features/billing/
├── contract.ts       # feature-owned types, input schemas, and response schemas
├── index.ts          # general/server-facing public boundary
├── server/           # routes, services, repositories (+ config.ts, migrations/, seeds/)
├── web/              # optional browser code (+ index.ts browser-safe boundary)
└── tests/            # feature behavior tests
```

Rules:

- `src/features/<feature>/index.ts` is the general/server-facing public boundary. Cross-feature server use imports only from there.
- `src/features/<feature>/web/index.ts` is the optional browser-safe boundary. App composition (`src/app/`) and legitimate browser-safe feature dependencies import browser surfaces only from there.
- Internals (`server/*`, `web/pages/*`, `web/components/*`, `web/client`) are private. Deep imports across features are invalid.
- Nara records deterministic import evidence for named/default imports and re-exports, including the source file, boundary, imported symbol, local/export alias, and explicitly type-only versus value-capable syntax. It separately records the canonical public and browser-safe boundary exports, including direct local declarations and named re-export provenance. A direct named re-export to the owning Feature's `contract.ts` proves contract provenance; export-all and other module-level forms remain module-precision evidence and never become an exact symbol claim.
- Application integration is inferred from the canonical composition roots only: `src/app/server.ts` for public-boundary imports and Hono route mounts, and `src/app/router.ts` for web-boundary imports and Vue Router records. Nara follows a statically provable chain from framework composition root to Feature boundary before reporting a route integration; dynamic or non-canonical composition is not reported. Official Features may additionally ship assembly templates that install application-owned bindings under `src/app/bindings/`; a binding counts as an integration only when its canonical root explicitly consumes it (server binding called with the proven Hono instance, web binding spread into the proven route array), and orphan bindings are never reported.
- Feature dependencies must be acyclic.

Details: [`docs/feature-model.md`](./docs/feature-model.md).

## Application and shared layers

- `src/app/` composes features: `server.ts` (Hono composition, production static/SPA delivery), `router.ts` (Vue Router: app pages + feature pages via `web/index.ts` barrels), `bindings/` (application-owned Feature assembly bindings: ordinary Hono/Vue Router code activated explicitly from the canonical roots), `App.vue`, `pages/`, `layouts/` (the authenticated shell lists the routes that declare `meta.nav`). The CLI keeps application composition facts separate from cross-Feature public API consumer evidence and reports server/web routes only when their framework composition is statically proven; it does not add an application graph node or claim runtime reachability.
- `src/shared/` is small business-neutral infrastructure only: `config/` (business-neutral settings plus `readFeatureEnv`, through which each feature's `server/config.ts` reads and validates the environment variables it owns), `database/` (connection, migration/seed engines — features own their SQL), `storage/` (provider-neutral binary-object contract plus the local default), `realtime/` (in-process Server-Sent Events hub and its browser connection, editing presence, and the three-way form merge; Features decide who hears which topic), `logging/`, `security/` (headers, CSRF, rate limits, and body budgets that read the route policy Features declare where their routers are mounted). Never a second global services/repositories layer. The canonical reference application guarantees the stack, canonical roots, Feature structure, plus `src/shared/config/`, `database/`, `realtime/`, `security/`, and `storage/`; official Features and their assembly templates may rely on that substrate, while `logging/` and anything else under `src/shared/` is reference-only. `nara add` and `nara evolve` derive which modules a package imports and refuse anything outside the substrate or missing from the application.
- `resources/app.ts` is a thin Vite entry mounting the app shell. `official-features/` holds installable open-code features (`health`, `audit`, `users`, each optionally with assembly templates and a distribution-only `.nara/requirements.json` describing provider and npm prerequisites).

## HTTP and contracts

- Features expose Hono sub-applications; `src/app/server.ts` mounts them (`/api/auth`, `/api/users`, …) plus `/health` and `/ready`. Public-boundary consumers are architecture facts, while route mounts require the statically provable Hono import → Hono instance → `.route()` chain; they are not runtime health checks.
- JSON shape: `{ success: true, message, data? }` / `{ success: false, message, code, errors? }`. English messages. Zod validation at the route boundary through `jsonInput`/`queryInput` middleware (422 `VALIDATION_ERROR`, before the handler's state checks; access checks that must not leak validation details run ahead of it); `src/app/error-handler.ts` maps domain errors.
- Contracts live in the owning feature's `contract.ts`, including strict response schemas that routes type their responses against (`satisfies`); browser code consumes them through the feature's `web/` client, built on Hono's `hc` from a type-only import of the feature's own routes, so the compiler checks paths, request bodies, and responses end to end. Per-feature contract tests run each web client method against the real app and parse every answer with those schemas. No RPC layer beyond Hono's own `hc`.
- Permissions are declared by the Feature that gates them (`<feature>/contract.ts` exports its actions), handed to Auth by the Feature's binding through `declarePermissions`, and written by startup after migrations. Auth's seed holds roles only; Auth never lists another Feature's slugs.

## CLI

```text
nara make feature <name>   Create the canonical feature skeleton
nara add <feature>         Install an official open-code feature
nara doctor [--json]       Validate architecture
nara guard --base <ref> [--head <ref>] [--json]
                           Fail when the change introduces new violations
nara inspect <feature> [--json]
nara context <feature>|--file <path> [--json]
nara evolve <feature> [--dry-run] [--json]
                           Reconcile official source without losing local code
nara evolve <feature> --transition|--verify [--history <fixture>] [--json]
                           Plan or re-evaluate the application-specific transition
nara evolve <feature> --accept [--json]
                           Apply the exact VERIFIED candidate and advance lineage
```

## Product lifecycle

Five distinct things; do not conflate them:

1. **Ecosystem/runtime stack** — Hono, Vue, SQLite, TypeScript. Nara never
2. **Nara's architecture model** — feature ownership, public and browser-safe boundaries, deterministic import evidence, public-symbol consumers, direct public-boundary provenance, and statically provable application integrations (this document).
3. **Nara CLI/tooling** — `nara` is a development-time architecture
   companion, not a production runtime abstraction. Its publishable npm
   package is `@nara-web/cli` at `packages/nara` (`bin`
   exposes the `nara` executable from the staged CLI, `files` includes
   only the staged `dist/` and `official-features/` source). The source release
   may be tagged independently; the npm package has not yet had its first
   registry publication and will be acquired from the registry once published.
4. **Official open-code features** — installable source (`health`, `audit`, `users`).
   `nara add` installs official package source into
   `src/features/<name>` plus explicit application-owned bindings; the result is ordinary project code. A package
   may also ship assembly templates (`.nara/assembly/`) that install
   application-owned bindings plus explicit canonical-root composition;
   installation proves the resulting integration before applying and
   `nara evolve` never touches bindings.

5. **Evolvable open code** — `nara add` establishes exact official
   source bytes under `.nara/lineage/official-features/<feature>/base`.
   `nara evolve` compares BASE, LOCAL, and INCOMING deterministically, blocks
   conflicts and newly introduced architecture diagnostics, and advances
   lineage only after a successful transactional apply. Lineage is
   reconciliation state, not architecture metadata; inspect, context, diff,
   snapshots, and doctor stay source-derived from `src/`. Managed adoption
   of upstream changes goes through explicit Feature Transitions
   (`nara evolve --transition` / `--verify` / `--accept`), which bind the
   exact candidate to obligations, scoped evidence, VERIFIED / BLOCKED /
   UNVERIFIED outcomes, and explicit acceptance; lineage BASE then advances
   to pure INCOMING bytes while application-owned bindings stay untouched.

The repository root is both the development reference and the canonical
starting application. It installs official Users through lineage like any
application: `official-features/users` is the source, and `src/features/users`
follows it through `nara evolve`. New products start from that codebase and keep or remove
Git history according to their own repository workflow.

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
- [`docs/feature-model.md`](./docs/feature-model.md) — ownership and boundaries
- [`docs/cli.md`](./docs/cli.md) — CLI and JSON reference
- [`docs/database-lifecycle.md`](./docs/database-lifecycle.md) — SQLite lifecycle
