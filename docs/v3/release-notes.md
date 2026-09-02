# Nara v3.0.0 Release Notes

Status: prepared on the `v3` branch. Merging to `main` and creating the `v3.0.0` tag remain explicit release actions and have not been performed here.

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

### Full-stack compatibility boundary

The Svelte/Inertia frontend shell and Tailwind styling remain available for applications that need browser surfaces. `web/` is optional inside a Feature; v3 does not require every capability to ship a page layer.

## Breaking changes from v2

- v2 technical-layer imports under `app/` are not a v3 API.
- The v2 `routes/web.ts`, request/response wrappers, middleware arrays, and response helpers are not available.
- v2 migration and seed runners are not part of the v3 runtime schema path.
- Existing frontend pages and global route assumptions require an intentional port into Feature ownership.
- Direct imports into another Feature's `server/` implementation are invalid.
- No automatic source or production-database migration is promised.

Use [`migration-v2-v3.md`](./migration-v2-v3.md) for the capability mapping and explicit data migration checklist.

## Verification completed

The release candidate has been exercised with:

```bash
npm run check
npm run build
npx ts-node -r tsconfig-paths/register src/cli/index.ts doctor
```

The fresh-install path was exercised in a clean temporary directory: generate with `nara new`, install dependencies, typecheck, test, build, start the generated server, query `/health`, and run `nara doctor`.

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
