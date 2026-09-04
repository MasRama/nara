# Nara

Architecture-aware TypeScript application kit.

Build by feature, not by layer.

Nara keeps each business capability together and makes the boundaries machine-checkable. The underlying stack stays transparent: Hono handles HTTP, TypeScript defines the application, and Nara's CLI explains the repository without an LLM.

## Start here

```bash
npx nara new my-app
cd my-app
npm install
npm run dev
```

This is the canonical lifecycle: `nara new` creates a minimal runnable
application that carries its own pinned Nara tooling as a devDependency,
so architecture checks travel with the project:

```bash
npm run check                  # typechecks, tests, and nara doctor
npx nara doctor                # validate architecture from the local install
npx nara context health --json
npx nara impact health --json
npx nara add audit             # install an official open-code feature
```

Nara stays useful after creation: the same local CLI that scaffolds the
project keeps understanding (`inspect`, `context`, `impact`), describing
change (`diff --base main`), and protecting (`doctor`) its feature
architecture in month 12. No AI provider is required.

To work on Nara itself instead, clone the reference repository:

```bash
git clone https://github.com/MasRama/nara.git
cd nara
npm install
cp .env.example .env
npm run dev
```

The repository root is the development/reference application proving richer
Nara capabilities (auth, RBAC, users, assets, SQLite lifecycle). It is not
the starting point for new products — `nara new` is. Additional capabilities
reach generated projects as explicit open-code features via `nara add`, not
by cloning the reference app.

Packaging note: the publishable `nara` package lives at `packages/nara` (`bin` points at the staged CLI and `files` ships only the staged `dist/` plus `official-features/` source). It has not been published to the npm registry yet; the remaining external step is a one-time `npm run build && npm run stage:package && npm publish` from `packages/nara` on a clean tree, after which the commands above resolve from the registry. Until then, staging plus `npm pack` from `packages/nara` produces the same artifact the registry would serve.

The development topology uses two local ports: Vite serves the browser on `VITE_PORT` (default `5173`) and proxies same-origin `/api`, `/health`, and `/ready` requests to Hono on `PORT` (default `5555`).

## The core idea

A feature owns a business capability, its public contract, runtime code, optional web code, and tests:

```text
src/features/billing/
├── contract.ts       # types and runtime-safe boundary data
├── index.ts          # the only public import boundary
├── server/           # routes, services, repositories
├── web/              # optional client-side surface
└── tests/            # feature tests
```

Cross-feature code imports the target feature's public `index.ts`:

```ts
import { getUser } from '@/features/users';
```

This is invalid:

```ts
import { findUserById } from '@/features/users/server/repository';
```

The second import couples one feature to another feature's implementation. `nara doctor` detects this, along with malformed features, dependency cycles, and server-only code leaking into `web/`.

## CLI

Inside a generated project the CLI is a pinned local devDependency — every
command below runs from the project's own install, reproducibly:

```bash
npm run architecture:doctor    # local nara doctor
npx nara make feature billing
npx nara doctor
```

When working directly from a Nara checkout, use the equivalent command:

```bash
node build/src/cli/index.js make feature billing
node build/src/cli/index.js doctor
```

Available commands:

```text
nara new <name>                 Create a runnable v3 application
nara make feature <name>        Create the canonical feature skeleton
nara add <feature>              Install an official open-code feature
nara doctor                    Validate architecture
nara inspect <feature>         Show bounded feature facts
nara context <feature>         Show coding context without source dumps
nara impact <feature>          Show feature-graph dependents
nara diff --base main          Show how the architecture is changing
```

Nara can describe not only what the architecture is, but how the architecture is changing. `git diff` explains text changes; `nara diff` explains deterministic Feature-architecture changes, with affected output labeled structural dependency impact (never semantic behavior prediction) and no AI provider required. See [`docs/v3/cli.md`](./docs/v3/cli.md#nara-diff---base-ref---head-ref---json).

Architecture facts are deterministic and available as JSON for scripts and agents:

```bash
npx nara inspect health --json
npx nara context health --json
npx nara impact health --json
npx nara diff --base main --json
```

No AI provider is required for these commands. `nara new` pins the creating
CLI version exactly in the generated project, so architecture-rule changes
arrive only through an explicit dependency update (see ADR 0011).

## HTTP and application structure

```text
Request
  │
  ▼
Hono application (src/app/server.ts)
  │
  ├── Feature routes
  │     ├── auth
  │     └── users
  │
  ├── Health and readiness
  └── Shared infrastructure
        ├── configuration
        ├── SQLite database
        ├── structured logging
        └── error handling
```

The reference application (repository root) exposes:

| Surface | Purpose |
|---|---|
| `/health` | Liveness response |
| `/ready` | Database readiness response |
| `/api/auth` | Registration, login, sessions, and password changes |
| `/api/roles` | Role and permission administration |
| `/api/users` | Profile and user administration |
| `/api/assets` | Avatar upload and delivery |

Hono is the HTTP layer. Nara does not replace it with a custom runtime or a native HTTP dependency.

## Source map

```text
src/
├── app/                 HTTP composition and error handling
├── cli/                 TypeScript CLI and architecture engine
├── features/
│   ├── auth/            Sessions, passwords, roles, permissions
│   └── users/           Profiles, administration, and avatars
└── shared/              Configuration, database, errors, logging

official-features/
├── audit/               Installable audit feature
└── health/              Installable health feature

resources/                Vue 3/Vite/TypeScript frontend shell
 tests/
├── v3/                  Runtime and CLI tests
└── fixtures/architecture Valid and invalid architecture projects
```

`web/` is optional inside a feature. A backend-only feature is valid. The supported browser stack is Vue 3 + Vite + TypeScript; feature-specific Vue pages, components, and composables live in the owning Feature's `web/`, while application-wide composition lives under `src/app/`.

## Development loop

Make a focused change, then run the checks that defend it:

```bash
npm run lint                 # TypeScript typecheck
npm run check:frontend       # Vue-aware frontend typecheck
npm test                     # Vitest suite
npm run architecture:doctor # Human-readable architecture report
npm run check                # All repository checks above
npm run build                # Production client and server build
```

The architecture tests include valid projects and intentionally invalid fixtures for:

- invalid feature shape
- cross-feature internal imports
- circular feature dependencies
- server/client leaks

Diagnostics report the problem, source file, relationship, reason, and recommended fix. Human output and `--json` output use the same analysis.

## Configuration and deployment

Development configuration starts from `.env.example`:

```text
NODE_ENV=development
PORT=5555
VITE_PORT=5173
APP_URL=http://localhost:5173
DB_FILE=database/dev.sqlite3
```

`APP_URL` is the public browser-facing application origin. In development it is the Vite URL; `PORT` is the Hono listener and `VITE_PORT` is the Vite browser port.

Nara's database is a local SQLite file managed by `better-sqlite3`. Apply its Feature-owned migrations before using database-backed routes:

```bash
npm run migrate
npm run seed
npm run db:check
```

For the production Node process, copy `.env.production.example` to `.env.production`, set `APP_URL` to the public application origin, choose a production database path, and build:

```bash
cp .env.production.example .env.production
npm run build
npm start
```

Production serves the built Vue SPA, public files, and backend APIs from the same Node/Hono origin. `npm start` requires `build/client/index.html`; run `npm run build` first. The startup log identifies the browser/API URL from `APP_URL`.

Linux runtime: the Hono + `@hono/node-server` HTTP path uses no Ultimate/uWebSockets native HTTP runtime. (Other native dependencies such as `better-sqlite3` or Sharp are legitimate and unrelated to this contract; the portable HTTP-stack audit in release validation guards against reintroducing the old runtime.) Canonical validation is one gate:

```bash
npm run validate:release   # check, production serving + startup
                           # failures, HTTP-stack audit, fresh project, official feature
npm run perf:sanity        # separate machine-sensitive sanity (catastrophic tripwires only)
```

Production configuration fails during startup with the invalid field named in the error. SQLite files, WAL files, and backups must live on storage local to the application host; Nara's default SQLite architecture is not intended for multi-host shared network filesystems. Applications with high write concurrency or multi-host database requirements should use a client/server database architecture instead. Put TLS termination and public traffic handling in a reverse proxy such as nginx or Caddy.

Development HTML is served by Vite and is not covered by Hono security headers; production is authoritative for page headers.

## Official feature packages

Official features are open TypeScript source installed into `src/features/<name>` without merging or overwriting local code:

```bash
npx nara add health
npx nara add audit
```

The installation result is inspectable source, not a hidden runtime plugin. Run `npx nara doctor` after adding a feature.

The catalog is intentionally small. The reference application's `auth` and
`users` capabilities are not official packages: they depend on shared
infrastructure (`shared/config`, `shared/database`, `shared/security`),
feature-owned migrations, and application-level route/session composition,
so extracting them would require hidden cross-directory patches — exactly
what open-code composition forbids. They stay reference implementations
until a capability can be packaged with zero out-of-feature changes.


## Read next
- [`AGENTS.md`](./AGENTS.md) — coding rules and agent workflow
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — architecture authority
- [`docs/v3/release-notes.md`](./docs/v3/release-notes.md) — v3 release notes and verification
- [`docs/v3/release-checklist.md`](./docs/v3/release-checklist.md) — pre-RC gates and validation semantics
- [`docs/v3/feature-model.md`](./docs/v3/feature-model.md) — feature ownership and boundaries
- [`docs/v3/cli.md`](./docs/v3/cli.md) — CLI command reference and JSON output
- [`docs/v3/feature-format.md`](./docs/v3/feature-format.md) — installable feature format
- [`docs/v3/v2-inventory.md`](./docs/v3/v2-inventory.md) — capability migration inventory
- [`docs/v3/migration-v2-v3.md`](./docs/v3/migration-v2-v3.md) — v2 to v3 porting guide
- [`docs/v3/architecture-philosophy.md`](./docs/v3/architecture-philosophy.md) — Compose, Understand, Protect
- [`docs/v3/database-lifecycle.md`](./docs/v3/database-lifecycle.md) — canonical SQLite migrations, seeds, backup, and integrity lifecycle
- [`SECURITY.md`](./SECURITY.md) — security reporting

## License

[MIT](./LICENSE) — Built by [MasRama](https://github.com/MasRama)
