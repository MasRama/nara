# Nara

Architecture-aware TypeScript application kit.

Build by feature, not by layer.

Nara keeps each business capability together and makes the boundaries machine-checkable. The framework stays transparent: Hono handles HTTP, TypeScript defines the application, and Nara's CLI explains the repository without an LLM.

## Start here

```bash
git clone https://github.com/MasRama/nara.git
cd nara
npm install
cp .env.example .env
npm run build
npm start
```

The server listens on `http://localhost:5555` by default. Verify it with:

```bash
curl http://localhost:5555/health
# {"status":"ok"}
```

For development with the Vite frontend shell and the Hono server:

```bash
npm run dev
```

Node.js 22 or newer and npm are required. SQLite is embedded; no database service is required.

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

Build the CLI from this repository, then use the `nara` executable from an installed package:

```bash
npm run build
nara make feature billing
nara doctor
```

When working directly from a checkout, use the equivalent command:

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
```

Architecture facts are deterministic and available as JSON for scripts and agents:

```bash
nara doctor --json
nara inspect billing --json
nara context billing --json
nara impact billing --json
```

No AI provider is required for these commands.

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

The current application exposes:

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
APP_URL=http://localhost:5555
DB_FILE=database/dev.sqlite3
```

For production, copy `.env.production.example` to `.env.production`, set a real `APP_URL`, and choose a production database path:

```bash
cp .env.production.example .env.production
npm run build
npm start
```

Production configuration fails during startup with the invalid field named in the error. Put TLS termination and public traffic handling in a reverse proxy such as nginx or Caddy.

## Official feature packages

Official features are open TypeScript source installed into `src/features/<name>` without merging or overwriting local code:

```bash
nara add health
nara add audit
```

The installation result is inspectable source, not a hidden runtime plugin. Run `nara doctor` after adding a feature.

## Read next

- [`AGENTS.md`](./AGENTS.md) — coding rules and agent workflow
- [`V3_SPEC.md`](./V3_SPEC.md) — architectural source of truth
- [`TODO.md`](./TODO.md) — implementation order
- [`docs/v3/feature-model.md`](./docs/v3/feature-model.md) — feature ownership and boundaries
- [`docs/v3/cli.md`](./docs/v3/cli.md) — CLI command reference and JSON output
- [`docs/v3/feature-format.md`](./docs/v3/feature-format.md) — installable feature format
- [`docs/v3/v2-inventory.md`](./docs/v3/v2-inventory.md) — capability migration inventory
- [`docs/v3/migration-v2-v3.md`](./docs/v3/migration-v2-v3.md) — v2 to v3 porting guide
- [`docs/v3/architecture-philosophy.md`](./docs/v3/architecture-philosophy.md) — Compose, Understand, Protect
- [`docs/v3/release-notes.md`](./docs/v3/release-notes.md) — v3 release notes and verification
- [`SECURITY.md`](./SECURITY.md) — security reporting

## License

[MIT](./LICENSE) — Built by [MasRama](https://github.com/MasRama)
