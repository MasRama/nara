# AGENTS.md

Nara is an **architecture-aware TypeScript application kit**. Build by feature, not by layer.

Stack: TypeScript, Node.js 22+, Hono + `@hono/node-server`, Vue 3 + Vite + `vue-router`, SQLite (`better-sqlite3`, raw SQL), Zod, Vitest. Session auth owned by the `auth` feature.

Authority: user instruction → this file → [`ARCHITECTURE.md`](./ARCHITECTURE.md) → tests → implementation. History (`docs/archive/v3/`, ADRs) explains past decisions; it never overrides current code.

## Architecture model

```text
src/features/<feature>/   contract.ts · index.ts · server/ · web/ (optional) · tests/
src/app/                  server.ts · router.ts · App.vue · pages/ · layouts/
src/shared/               config/ · database/ · errors/ · logging/ · security/
resources/app.ts          thin Vite entry mounting the app shell
official-features/        installable open-code features (health, audit)
```

- `src/features/<feature>/index.ts` is the general/server-facing public boundary. Cross-feature server use imports only from there.
- `src/features/<feature>/web/index.ts` is the optional browser-safe boundary. `src/app/` imports browser surfaces only from there.
- Internals (`server/*`, `web/pages/*`, `web/components/*`, `web/client`) are private. Feature dependencies must be acyclic.
- Details: [`docs/v3/feature-model.md`](./docs/v3/feature-model.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Hard rules

- Feature-first: new capability → `src/features/<name>/` (skeleton via `nara make feature`). Never add global `controllers/`/`services/`/`repositories/` trees.
- Boundaries: never import another feature's `server/*`, `web/pages/*`, `web/components/*`, or `web/client` — use its `index.ts` / `web/index.ts`. Never export server-only symbols through `web/index.ts`.
- Browser code under `web/` must not import `server/` files, `@/shared/database`, Node-only built-ins, or server-only packages.
- Server is authoritative: enforce auth/permissions in Hono routes, never only in Vue. Permission slugs are `<resource>.<action>`; `admin` bypasses where the route requires it.
- Responses use `{ success: true, message, data? }` / `{ success: false, message, code, errors? }`, English messages, Zod `safeParse` at the route boundary (401 auth, 403 permission, 404 absent, 409 conflict, 422 validation).
- SQL lives in the owning feature's repository via `better-sqlite3` prepared statements; multi-write replacements use transactions. No ORM, no string-interpolated values.
- Locked stack: do not replace Hono, add a frontend framework (React/Svelte/Nuxt/SSR), add a native HTTP engine (Ultimate Express/uWebSockets.js), or wrap Hono/Vue behind a custom Nara abstraction. New dependency genuinely required → update `package.json`, `.agents/skills/nara-dependencies/SKILL.md`, and add an ADR.
- No overengineering: no speculative abstractions, plugin systems, caches, DI containers, RPC/ORM/validation frameworks, or duplicated architecture metadata. Keep changes scoped; no mass-formatting, no unrelated refactors, no secrets, no force-push.

## Where work belongs

| Change | Location |
|---|---|
| Business capability | owning `src/features/<feature>/` (`contract.ts`, `server/`, `web/`, `tests/`) |
| HTTP composition, browser routes, app shell | `src/app/` (`server.ts`, `router.ts`, pages/layouts) |
| Business-neutral infra only | `src/shared/` (config, database engine, errors, logging, security) |
| Reusable installable feature | `official-features/<name>/` + `nara add` wiring |
| CLI / architecture engine | `src/cli/` with fixture-backed tests |

## Inspect before editing

Deterministic facts first — no LLM needed, no full-repo scan:

```bash
node build/src/cli/index.js doctor --json
node build/src/cli/index.js context <feature> --json   # context pack: ownership, API, constraints, reading order
node build/src/cli/index.js inspect <feature> --json
node build/src/cli/index.js impact <feature> --json    # dependents before contract changes
```

(Or `npx ts-node -r tsconfig-paths/register src/cli/index.ts <command>` without a build.)

## Skills

Procedural deep dives in [`.agents/skills/`](./.agents/skills/) (one directory per skill, `SKILL.md` inside). Load every skill relevant to the task:

- `nara-feature-development` — feature skeleton, boundaries, composition
- `nara-api-contracts` — Hono shapes, errors, Zod
- `nara-auth-rbac` — sessions, permissions, guards
- `nara-database` — repositories, transactions, lifecycle
- `nara-frontend` — Vue pages, router, typed clients
- `nara-dependencies` — allowed/banned table, adding a package
- `nara-testing` — layout, route/repo/Vue/CLI tests
- `nara-pitfalls` — read before writing code

`AGENTS.md` and `ARCHITECTURE.md` win on conflict.

## Verify

Narrow first, full gate before handoff:

```bash
npx vitest run <affected-file-or-dir>
npm run lint                 # server typecheck
npm run check:frontend       # Vue typecheck
npm test                     # full Vitest suite
npm run architecture:doctor  # nara doctor, human-readable
npm run check                # all of the above combined
npm run build                # production client + server
```

Database-backed routes need migrations first: `npm run migrate` (`seed`, `db:check` as needed). Production: `npm run build && npm start` (requires `build/client/index.html`).

## Docs

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — current architecture authority
- [`README.md`](./README.md) — first run, topology, deployment
- [`docs/v3/cli.md`](./docs/v3/cli.md) — CLI and JSON reference
- [`docs/v3/database-lifecycle.md`](./docs/v3/database-lifecycle.md) — SQLite lifecycle
- [`docs/v3/migration-v2-v3.md`](./docs/v3/migration-v2-v3.md) — v2 porting guide
- [`docs/decisions/`](./docs/decisions/) — decision history
- [`SECURITY.md`](./SECURITY.md) — security reporting and model notes

Keep it boring where the ecosystem solves it; keep it explicit where ownership matters.
