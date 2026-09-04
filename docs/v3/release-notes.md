# Nara v3.0.0 Release Notes

Status: released as `v3.0.0` on `main` (canonical). The `v3` branch tracks the same release commit.

## What changed

Nara v3 is an architectural rewrite around one product thesis:

> Architecture-aware TypeScript application kit. Build by feature, not by layer.

### Feature-first application model

- Business capabilities live under `src/features/<feature>/`.
- Each Feature owns its contract, server behavior, optional web surface, and tests.
- `index.ts` is the public Feature boundary.
- Cross-Feature internal imports, dependency cycles, malformed Feature shapes, and server/client leaks are detected by `nara doctor`.
- The migrated application includes auth, sessions, RBAC, user administration, profiles, avatar assets, health, and readiness capabilities.

### Transparent Node HTTP stack

- Hono runs on Node.js through `@hono/node-server`.
- The old Ultimate Express / uWebSockets.js path is removed.
- Express-compatible request/response and middleware wrappers are removed from production code.
- Normal Linux deployment does not require a Nara-specific native HTTP binary.

### Architecture-aware CLI

The TypeScript CLI provides:

```text
nara new <name>
nara make feature <name>
nara add <feature>
nara doctor [--json]
nara inspect <feature> [--json]
nara context <feature> [--json]
nara impact <feature> [--json]
```

Inspection and protection commands are deterministic and do not require an AI provider. Human diagnostics identify the problem, source file, relationship, reason, and recommended fix; JSON output exposes the same facts to agents and CI.

### Open-code composition

Official `health` and `audit` Feature packages can be installed with `nara add`. Installed source remains local and inspectable. Installation never merges with or overwrites an existing Feature.

### Compose, Understand, Protect

Nara stays useful after project creation: compose capabilities from explicit Features, understand the Feature graph with deterministic `inspect`/`context`/`impact` facts (no AI provider required), and protect boundaries with `nara doctor` before drift becomes debt. See [`architecture-philosophy.md`](./architecture-philosophy.md).

### Full-stack compatibility boundary

The Vue 3 + Vite + TypeScript frontend shell and Tailwind styling are available for applications that need browser surfaces. Vue is the only supported frontend framework; feature-specific pages, components, and composables belong in the owning Feature's `web/`, while application-wide composition belongs under `src/app/`. `web/` remains optional inside a Feature.

## Breaking changes from v2

- v2 technical-layer imports under `app/` are not a v3 API.
- The v2 `routes/web.ts`, request/response wrappers, middleware arrays, and response helpers are not available.
- v2 migration and seed runners are not part of the v3 runtime schema path.
- Existing frontend pages and global route assumptions require an intentional port into Feature ownership.
- Direct imports into another Feature's `server/` implementation are invalid.
- No automatic source or production-database migration is promised.

Use [`migration-v2-v3.md`](./migration-v2-v3.md) for the capability mapping and explicit data migration checklist.

## Automated verification passing

```bash
npm run validate:release   # portable gates (all green, see TODO V3-130)
npm run validate:linux     # Linux runtime gate (green, see TODO V3-111)
npm run perf:sanity        # catastrophic-only sanity, no regression (V3-115)
```

Covered: typechecks, unit suite, `nara doctor`, production serving and
startup-failure behavior, portable HTTP-stack audit, fresh-project install,
official-feature install, and the Linux production artifact. The Hono
`@hono/node-server` HTTP path carries no Ultimate/uWS native HTTP runtime;
other native dependencies (e.g. `better-sqlite3`, Sharp) are legitimate and
unrelated to that contract. Local Linux runtime behavior is covered by
`validate:linux`: fresh build, production startup, `/health`, `/ready`,
`/api/auth/me`, and `/proc` inspection proving no uWS binary is mapped into
the running server. No pinned distribution or glibc version is part of the
release criteria. V3-133 agent cold-start passed (see
[`agent-cold-start.md`](./agent-cold-start.md)). Manual developer/product
validation was performed by the project owner throughout the v3 development
and review process; a separate unfamiliar-human cold-start gate is not part
of the v3.0.0 release criteria.

Architecture regression fixtures cover valid projects and these invalid cases:

- invalid Feature shape
- cross-Feature internal import
- circular dependency
- server/client leak

## Read before publishing

- [`README.md`](../../README.md) — first-run overview
- [`V3_SPEC.md`](../../V3_SPEC.md) — source of truth
- [`feature-model.md`](./feature-model.md) — Feature ownership and boundaries
- [`cli.md`](./cli.md) — command and JSON reference
- [`migration-v2-v3.md`](./migration-v2-v3.md) — v2 porting guide
- [`architecture-philosophy.md`](./architecture-philosophy.md) — Compose, Understand, Protect
