# AGENTS.md

Nara is an **architecture-aware TypeScript application kit**. Build by feature, not by layer.

Stack: TypeScript, Node.js 22+, Hono + `@hono/node-server`, Vue 3 + Vite + `vue-router`, SQLite (`better-sqlite3`, raw SQL), Zod, Vitest. Session auth owned by the `auth` feature.

Authority: user instruction → this file → [`ARCHITECTURE.md`](./ARCHITECTURE.md) → tests → implementation. Git history explains past decisions; it never overrides current code.

## Architecture model

```text
src/features/<feature>/   contract.ts · index.ts · server/ · web/ (optional) · tests/
src/app/                  server.ts · router.ts · App.vue · pages/ · layouts/
src/shared/               config/ · database/ · logging/ · realtime/ · security/ · storage/
resources/app.ts          thin Vite entry mounting the app shell
official-features/        installable open-code features (health, audit, users, activity)
```

- `src/features/<feature>/index.ts` is the general/server-facing public boundary. Cross-feature server use imports only from there.
- `src/features/<feature>/web/index.ts` is the optional browser-safe boundary. `src/app/` imports browser surfaces only from there.
- Internals (`server/*`, `web/pages/*`, `web/components/*`, `web/client`) are private. Feature dependencies must be acyclic.
- Details: [`docs/feature-model.md`](./docs/feature-model.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Hard rules

- Feature-first: new capability → `src/features/<name>/` (skeleton via `nara make feature`). Never add global `controllers/`/`services/`/`repositories/` trees.
- Boundaries: never import another feature's `server/*`, `web/pages/*`, `web/components/*`, or `web/client` — use its `index.ts` / `web/index.ts`. Never export server-only symbols through `web/index.ts`.
- Browser code under `web/` must not import `server/` files, `@/shared/database`, Node-only built-ins, or server-only packages.
- Server is authoritative: enforce auth/permissions in Hono routes, never only in Vue. Permission slugs are `<resource>.<action>`; `admin` bypasses where the route requires it.
- Responses use `{ success: true, message, data? }` / `{ success: false, message, code, errors? }`, English messages, Zod validation at the route boundary via `jsonInput`/`queryInput` (401 auth, 403 permission, 404 absent, 409 conflict, 422 validation). Edits of a shared record send the `revision` they were based on; an older one gets 409 `STALE_REVISION` carrying `current`, which the form merges instead of overwriting.
- Interface text is English and lives in the page's template. The UI shows API refusals by `message` and branches on `code`, never on message text; every code a route sends is declared in its Feature contract (`<FEATURE>_REFUSAL_CODES`, plus `API_REFUSAL_CODES` from `src/shared/security/codes.ts`).
- SQL lives in the owning feature's repository via `better-sqlite3` prepared statements; multi-write replacements use transactions. No ORM, no string-interpolated values.
- Locked stack: do not replace Hono, add a frontend framework (React/Svelte/Nuxt/SSR), add a native HTTP engine (Ultimate Express/uWebSockets.js), or wrap Hono/Vue behind a custom Nara abstraction. New dependency genuinely required → prefer the existing stack or standard library and update the actual package manifest (`package.json`). If it changes current architecture, update `ARCHITECTURE.md`; otherwise keep rationale close to the code or test that enforces it.
- No overengineering: no speculative abstractions, plugin systems, caches, DI containers, RPC/ORM/validation frameworks, or duplicated architecture metadata. Keep changes scoped; no mass-formatting, no unrelated refactors, no secrets, no force-push.

## Where work belongs

| Change | Location |
|---|---|
| Business capability | owning `src/features/<feature>/` (`contract.ts`, `server/`, `web/`, `tests/`) |
| HTTP composition, browser routes, app shell | `src/app/` (`server.ts`, `router.ts`, pages/layouts) |
| Business-neutral infra only | `src/shared/` (config, database engine, errors, logging, security) |
| Reusable installable feature | `official-features/<name>/` + `nara add` wiring |
| Users / Activity runtime code | `official-features/<name>/`, then `npm run nara -- evolve <name>`; never edit `src/features/{users,activity}/` copies of official files (their extra `tests/` are local) |
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
- [`docs/cli.md`](./docs/cli.md) — CLI and JSON reference
- [`docs/database-lifecycle.md`](./docs/database-lifecycle.md) — SQLite lifecycle
- [`SECURITY.md`](./SECURITY.md) — security reporting and model notes

Keep it boring where the ecosystem solves it; keep it explicit where ownership matters.
