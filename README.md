# Nara

Nara is an architecture-aware TypeScript application kit built around
composable, evolvable open code.

Build by feature, own the source, compose explicitly, and keep architecture
machine-checkable without hiding Hono, Vue, TypeScript, or SQLite behind a
custom runtime.

```text
Compose → Own → Understand → Evolve → Protect
```

## Start here

The publishable CLI package is `@nara-web/cli`. It is not yet published to the
npm registry, so the command below is the canonical flow for the first public
release; until then use a source checkout or a locally staged/packed package.

```bash
npx @nara-web/cli new my-app
cd my-app
npm install
npm run dev
```

Generated applications pin the exact Nara CLI version that created them as a
devDependency. The default Health Feature is installed from the same official
open-code source used by `nara add`.

```bash
npm run check
npx nara doctor
npx nara context health --json
npx nara add audit
```

Nara's architecture analysis is deterministic and does not require an AI
provider.

## Work on Nara itself

```bash
git clone https://github.com/MasRama/nara.git
cd nara
npm install
cp .env.example .env
npm run setup
npm run dev
```

`npm run setup` applies pending migrations, reference seeds, and bootstraps the
first administrator if needed. Without admin environment overrides it creates
a temporary development credential:

```text
admin@nara.local / admin12345
```

The application requires that temporary password to be changed before normal
authenticated use. Set `NARA_ADMIN_NAME`, `NARA_ADMIN_EMAIL`, and
`NARA_ADMIN_PASSWORD` before setup to provide your own initial credential.

The repository root is a richer reference application proving Auth/RBAC,
Users, Activity, assets, and the SQLite lifecycle. New applications should be
created with `nara new`; additional capabilities are installed explicitly with
`nara add`.

Development uses one Vite HTTP server on `PORT` (default `5555`). Vite serves
the Vue app and HMR while Hono handles `/api`, `/health`, and `/ready` on the
same origin.

## Core model

A Feature owns one business capability:

```text
src/features/billing/
├── contract.ts       # shared boundary types and schemas
├── index.ts          # public server/general boundary
├── server/           # runtime and persistence
├── web/              # optional browser surface
└── tests/            # feature tests
```

Cross-feature imports use the target Feature's public boundary:

```ts
import { getUser } from '@/features/users';
```

Deep cross-feature imports such as `@/features/users/server/repository` are
invalid and detected by `nara doctor`.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) and
[`docs/feature-model.md`](./docs/feature-model.md) for the full ownership and
composition rules.

## CLI

Common commands:

```text
nara new <name>                 Create a runnable Nara application
nara make feature <name>        Create the canonical Feature skeleton
nara add <feature>              Install an official open-code Feature
nara evolve <feature>           Evolve installed official source
nara doctor                     Validate current architecture
nara inspect <feature>          Show bounded Feature facts
nara context <feature>          Produce a focused architecture context pack
nara impact <feature>           Show structural dependents
nara diff --base main           Describe architecture change
nara guard --base origin/main   Fail on newly introduced architecture debt
```

All architecture commands support deterministic JSON where documented.
Generated projects run them from their pinned local CLI installation.

Full command and output semantics live in [`docs/cli.md`](./docs/cli.md).

## Repository map

```text
src/
├── app/                 application composition
├── cli/                 CLI and architecture engine
├── features/
│   ├── activity/
│   ├── auth/
│   └── users/
└── shared/              business-neutral infrastructure

official-features/
├── audit/
├── health/
└── users/

resources/               Vue/Vite application shell
scripts/                 setup, database, build, release helpers
tests/                   cross-cutting and integration tests
```

`web/` is optional inside a Feature. The supported browser stack is Vue 3 +
Vite + TypeScript; Hono is the HTTP layer; SQLite uses `better-sqlite3` and raw
SQL.

## Development and verification

Use the narrowest relevant test while iterating, then run the canonical gate
before handoff:

```bash
npm run lint
npm run check:frontend
npm run test:fast
npm run test:integration
npm run test:heavy
npm run architecture:doctor
npm run check
npm run build
```

`npm run check` is the canonical repository gate. Release/distribution work
uses:

```bash
npm run validate:release
npm run perf:sanity   # separate machine-sensitive sanity check
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for contribution workflow and
validation expectations.

## Database and production

Development starts from `.env.example`. The main lifecycle commands are:

```bash
npm run setup
npm run migrate
npm run seed
npm run db:check
npm run db:backup
```

Production requires an explicit public `APP_URL` and a local SQLite path:

```bash
cp .env.production.example .env.production
npm run build
npm start
```

Production serves the built Vue SPA and Hono APIs from the same Node process.
SQLite files, WAL files, and backups must live on storage local to the
application host; the default architecture is not intended for shared
multi-host network filesystems.

The reference app also performs bounded SQLite maintenance: planner statistics
are optimized at connection/migration boundaries and periodically at runtime,
while Activity events older than `ACTIVITY_RETENTION_DAYS` (default `365`) are
pruned in bounded batches. Set the value to `0` only when indefinite Activity
retention is intentional.

Database ownership, migrations, seeds, backup, and integrity behavior are
documented in [`docs/database-lifecycle.md`](./docs/database-lifecycle.md).

## Official Features

The current installable catalog is intentionally small:

```text
health
audit
users
```

Installation copies visible source into the application and composes explicit
application-owned bindings where needed. There is no runtime plugin registry or
DI container. Users is the substantial assembly proof and can bind to the
reference Auth capability or another compatible provider.

Package shape and prerequisites are documented in
[`docs/feature-format.md`](./docs/feature-format.md).

## Package status

The npm package is `@nara-web/cli` and exposes the `nara` executable. The first
registry publication is still pending. The staged publishable package lives at
`packages/nara`; `npm run stage:package` and `npm pack` produce the artifact
used by release validation.

## Read next

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — current architecture authority
- [`docs/feature-model.md`](./docs/feature-model.md) — Feature ownership and boundaries
- [`docs/feature-format.md`](./docs/feature-format.md) — installable Feature format
- [`docs/cli.md`](./docs/cli.md) — CLI reference
- [`docs/database-lifecycle.md`](./docs/database-lifecycle.md) — SQLite lifecycle
- [`SECURITY.md`](./SECURITY.md) — security model and reporting
- [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) — community participation

## License

[MIT](./LICENSE) — Built by [MasRama](https://github.com/MasRama)
