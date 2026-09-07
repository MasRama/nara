# Nara v3 CLI

The Nara CLI is a TypeScript command-line tool for creating Features, composing official source packages, evolving installed official source, and inspecting architecture. Core analysis is deterministic and does not call an LLM.

The `nara` CLI is distributed on npm as `@nara-web/cli` (not yet published; see the packaging note in [`README.md`](../../README.md)) and the package exposes the `nara` executable. Inside
a generated project every command below runs from the project's own pinned
`@nara-web/cli` install (`npx nara <command>` or `npm run architecture:doctor`). From a Nara
repository checkout, the equivalent command is:

Run `nara --help` for the command list and `-h`/`--help` for command-specific usage.

## `nara new <name>`
Create a runnable minimal Nara v3 application in a new sibling directory. `nara new` writes the project files but does not install dependencies:

```bash
npx @nara-web/cli new ledger
cd ledger
npm install
npm run check
npm run build
NODE_ENV=production APP_URL=http://localhost:5555 npm start
```

Every generated project exact-pins the version of the Nara CLI that created
it as `@nara-web/cli` in devDependencies (no range), so architecture-rule
changes arrive only through an explicit dependency update — never silently
(see ADR 0011). Its `npm run check` ends with `npm run architecture:doctor`.
The Health Feature created by `nara new` comes from the same official
open-code source used by `nara add`, and its lineage is established before the
generated project is made visible. Health is composed through the same
Feature-assembly primitive as `nara add`: the project ships an
application-owned `src/app/bindings/health.server.ts` that mounts
`healthRoutes` at `/health`, explicitly invoked from `src/app/server.ts`.
A fresh `nara evolve health --json` therefore reports `up-to-date`.

`nara inspect/context/impact/doctor/add/evolve` all run from the project's own
install with no global CLI and no network service. Production serving needs
no Nara runtime: the CLI is development tooling, not request-path
infrastructure.

For the canonical full-stack development session:

```bash
npm run dev
```

This starts one Vite development server on `PORT` (default `5555`). Vite serves Vue/browser/HMR routes and mounts Hono for `/api`, `/health`, and `/ready` on the same origin and same listener.

`npm run check` runs the server typecheck, Vue typecheck, Vitest tests, and the local architecture check. `npm start` runs the generated Node server on port `5555` by default; `GET /health` returns `{"status":"ok"}`.

The production build writes the browser artifact to `build/client`. The generated Node server serves that artifact, including history-mode SPA routes and hashed assets, from the same origin as Hono. Missing asset paths and reserved API/health paths stay 404s instead of receiving the SPA shell. Set `APP_URL` to the public browser origin when deploying behind a public hostname; production startup fails clearly if the client artifact or `APP_URL` is missing.

The generated project is intentionally small:

```text
ledger/
├── .gitignore
├── .nara/
│   └── lineage/
│       └── official-features/
│           └── health/
│               ├── base/
│               └── lineage.json
├── AGENTS.md
├── package.json
├── resources/
│   ├── app.ts
│   ├── index.css
│   └── index.html
├── scripts/
│   └── dev.ts
├── src/
│   ├── app/
│   │   ├── App.vue
│   │   ├── bindings/
│   │   │   └── health.server.ts
│   │   ├── pages/
│   │   │   ├── HomePage.vue
│   │   │   └── NotFoundPage.vue
│   │   ├── router.ts
│   │   └── server.ts
│   ├── features/
│   │   └── health/
│   │       ├── contract.ts
│   │       ├── index.ts
│   │       └── tests/
│   │           └── health.test.ts
│   ├── server.ts
│   └── vue.d.ts
├── tests/
│   └── health.test.ts
├── tsconfig.frontend.json
├── tsconfig.json
├── vite.config.mjs
└── vitest.config.mjs
```

`resources/app.ts` mounts the Vue 3 browser shell from `src/app/App.vue` and installs the app router. `src/app/router.ts` composes the home and browser not-found pages; `src/app/server.ts` explicitly invokes the application-owned `src/app/bindings/health.server.ts` binding (which mounts the Health Feature's Hono route at `/health`) and owns production static/SPA delivery, and `src/server.ts` serves it through `@hono/node-server`. The Feature test proves `healthRoutes` itself; `tests/health.test.ts` proves the application mount. The starter contains no database or authentication features; add capabilities explicitly with `nara make feature` or `nara add`. `nara new` copies the same official Health source used by `nara add` and establishes its `.nara` lineage before the project directory is renamed into place. The command refuses unsafe names and existing directories; it never merges into or overwrites an existing project.


## Database lifecycle

The root Nara application uses SQLite through `better-sqlite3` and raw SQL. Database-consuming Features own their SQL under `server/migrations/` and reference seeds under `server/seeds/`; the shared database layer discovers those directories deterministically.

```bash
npm run migrate
npm run migrate:status
npm run migrate:fresh       # development only; also runs reference seeds
npm run seed
npm run setup               # migrate + seed + idempotent first-admin bootstrap
npm run bootstrap:admin     # defaults to a temporary development admin; env-overridable
npm run db:backup
npm run db:check
```

Migrations are forward-only and checksummed in `_nara_migrations`. Applied migration files are immutable; create a new corrective migration instead of editing history. Startup applies pending migrations before Hono listens. See [`database-lifecycle.md`](./database-lifecycle.md) for the SQLite layout, WAL settings, compatibility behavior, and local-disk deployment boundary. The minimal project generated by `nara new` has no database Feature, so these scripts are supplied by the reference application rather than copied into a health-only starter.

## `nara make feature <name>`

Create the smallest canonical Feature skeleton in the current project:

```bash
nara make feature billing
```

This creates:

```text
src/features/billing/
├── contract.ts
└── index.ts
```

`contract.ts` exports the generated feature name and type. `index.ts` re-exports the public value. Add `server/`, `web/`, and `tests/` only when the capability needs them. The command validates lowercase kebab-case names and refuses duplicate targets.

## `nara add <feature>`

Install an official open-code Feature package into `src/features/<feature>`:

```bash
npx nara add health
npx nara add audit
```

Packages resolve from the installed `@nara-web/cli` package's `official-features/`
source (shipped inside the published artifact), never from the network at
install time. The package is copied as inspectable TypeScript source.
Installation refuses unknown package names and existing targets. It stages the copy before renaming it into place, so a failed copy does not leave a partial Feature directory.

Official Features do not need zero application-level changes. They need zero
hidden application-level changes. A Feature with assembly templates (for
example `health`) additionally installs application-owned bindings under
`src/app/bindings/` and explicit composition calls in the canonical roots:

```bash
npx nara add health
# Installed feature "health":
# - src/app/bindings/health.server.ts
# - src/features/health/contract.ts
# - src/features/health/index.ts
# - src/features/health/tests/health.test.ts
# ~ src/app/server.ts
```

`-` lines are created files; `~` lines are explicit canonical-root edits
(one added import, one added composition call). Installation is one
fail-closed transaction: binding collisions fail before mutation, the
candidate must prove its assembly facts (`inspect`/`context` show the
binding import and the route) with no newly introduced `doctor`
diagnostic, and only then is anything applied. Existing diagnostics in the
project baseline are tolerated. Later `nara evolve` advances Feature-owned
source while leaving application bindings untouched. See
[`feature-format.md`](./feature-format.md) and ADR 0018.

### Explicit prerequisites

An official Feature may declare distribution-time requirements in
`official-features/<feature>/.nara/requirements.json` (never installed,
never architecture truth):

```json
{
  "schemaVersion": 1,
  "providers": ["auth"],
  "packages": { "sharp": "^0.35.3", "zod": "^4.4.3" }
}
```

`providers` names the Features the bundled bindings are written against;
`packages` names the npm packages Feature source needs beyond the
platform core (`hono`, `vue`, `vue-router`, `@hono/node-server`). Before
any mutation, `nara add` validates the metadata against the distributable
source in both directions (imported-but-undeclared and
declared-but-unimported both fail), verifies each provider exists and
exports the symbols the assembly consumes, and plans `package.json`
dependency edits. There is no dependency resolver and providers are
never auto-installed:

```bash
npx nara add users
# Installed feature "users":
# - src/features/users/...
# ~ src/app/server.ts
# + package.json dependency: sharp@^0.35.3
# + package.json dependency: zod@^4.4.3
# Dependencies added to package.json. Run npm install.
```

Missing packages are appended to `dependencies`; identical declarations
are kept byte-identical; a conflicting declaration fails before mutation
with the expected and declared versions. The transaction covers Feature
source, lineage, bindings, canonical-root edits, and `package.json`
together: any failure restores all of them with no stage files left
behind. Nara never edits the lockfile and never runs `npm install`
itself.

Run the architecture check after installation:

```bash
npx nara doctor
```

## `nara evolve <feature> [--dry-run] [--json]`

Reconcile an installed official Feature with the current official source
bundled in the local Nara CLI:

```bash
npx nara evolve audit --dry-run
npx nara evolve audit --dry-run --json
npx nara evolve audit
```

`nara new` establishes the initial Health `BASE` from the same exact official
source it installs into `src/features/health`. `nara add` records the exact
official source as `BASE` under
`.nara/lineage/official-features/<feature>/base/`. Evolution compares that
snapshot with `LOCAL` (`src/features/<feature>`) and `INCOMING` (the current
bundled official source). The source remains ordinary project code; lineage is
not an architecture manifest and is never used by `inspect`, `context`, `diff`,
snapshots, or `doctor`.

The plan has stable relative paths and file actions:

- unchanged files stay unchanged
- upstream-only updates and deletions are adopted
- local-only additions and changes are preserved
- upstream additions are copied
- non-overlapping text changes merge with `git merge-file`
- binary files merge only for one-side changes or identical results
- incompatible text, binary, or deletion changes are conflicts

Evolution reconciles Feature-owned source only. When the incoming package
declares requirements the application no longer satisfies (a provider the
installed bindings use is gone, or a required package is missing or
conflicted in `package.json`), the plan carries a `requirementsNotice`
listing each gap and applies the source anyway; bindings and
`package.json` are left for an explicit follow-up and never silently
migrated.

Conflicts return non-zero and list paths without writing conflict markers or
partial files. `--dry-run` never writes Feature source or lineage. A
conflict-free plan is materialized as an isolated candidate and checked with
the existing architecture snapshot, diff, affected-set, and diagnostic
identity primitives. Newly introduced diagnostics block application, while
existing local diagnostics are tolerated. On success, the Feature is replaced
transactionally and `BASE` advances to pure `INCOMING` bytes.

Missing lineage is conservative: an identical legacy Feature can bootstrap its
lineage; divergent local source fails closed because the historical official
base cannot be proven. A Feature with no official package is application-owned:
for example, `nara evolve billing` reports that `billing` has no official
upstream lineage and changes nothing.

JSON success output has this shape:

```json
{
  "schemaVersion": 1,
  "feature": "audit",
  "status": "dry-run",
  "lineage": { "baseDigest": "...", "incomingDigest": "..." },
  "files": [{ "path": "index.ts", "action": "update", "reason": "..." }],
  "conflicts": [],
  "canApply": true,
  "applied": false,
  "architecture": {
    "changes": {},
    "affected": { "scope": "structural dependency impact" },
    "introducedDiagnostics": []
  }
}
```

Plans whose incoming requirements the application does not satisfy
additionally carry `requirementsNotice: string[]` (omitted when empty);
the human report renders it as a `Requirements notice:` section.

Error JSON uses `status: "error"`, a stable `errorCode`, a human-readable
`message`, and `canApply: false`. No network service or AI provider is
required.

## `nara evolve <feature> --transition | --verify | --accept`

Plan, re-evaluate, and accept a **Feature Transition**: an
application-specific adoption proposal for the exact reconciled candidate.
Reconciliation produces a candidate for evaluation, not a conclusion that
the application can safely adopt it.

```bash
npx nara evolve users --transition --json
npx nara evolve users --verify --history ./fixtures/history.sqlite3
npx nara evolve users --accept
```

`--transition` and `--verify` evaluate the current candidate revision and
persist a receipt to `.nara/transitions/<feature>/current.json` (plus an
immutable history copy per candidate digest). Re-running after editing
application-owned bindings, packages, tests, or migrations re-evaluates
the new revision and invalidates prior evidence. `--history` points at a
representative existing-history SQLite fixture; without one,
existing-history adoption is UNVERIFIED. `--accept` applies the exact
VERIFIED candidate, advances lineage BASE to pure INCOMING bytes, and
records the accepted transition. Only VERIFIED transitions are eligible;
there is no force-verified path.

The receipt carries the transition identity, BASE / LOCAL-start /
INCOMING / candidate digests, the incoming transition-input digest
(Feature source plus the requirements manifest that drives
package/provider obligations; assembly templates are install-time only
and are not transition inputs), the application-state fingerprint
(bindings, composition, provider Feature source, shared modules,
selected tests, application migrations, manifests, compiler/build
configuration), history-fixture identities (path, digest, represented
history), obligations (source, boundary, host, binding, provider,
package, integration, migration, behavioral), per-revision evidence,
the scoped outcome, limitations, staleness, and acceptance state.
Candidate identity is reconciled Feature source plus material
application inputs plus material incoming distribution inputs plus
evidence configuration plus history-fixture identities; any drift
rejects managed acceptance as stale. VERIFIED means verified against
the named evidence and scope, not universally safe.
Application-owned evidence selection lives in
`.nara/transitions/<feature>.checks.json` (owned by the application,
never modified by evolution) and only nominates relevant tests and the
history fixture. See ADR 0021.

## `nara doctor`

Validate repository architecture from `src/features/*`:

```bash
nara doctor
```

The current checks cover:

- Feature shape and public `index.ts`
- cross-Feature internal imports
- circular Feature dependencies
- server-only imports from `web/`

Healthy output is intentionally short:

```text
Architecture looks healthy.
```

An invalid project exits non-zero and prints every issue with its stable code, source file, relationship, reason, and recommended fix. For example, a direct import of `users/server/repository.ts` from `billing` identifies both Features and points to `@/features/users` as the public direction.

### JSON output

Use `--json` for scripts, CI, and agents:

```bash
nara doctor --json
```

A healthy report has this shape:

```json
{
  "healthy": true,
  "issues": []
}
```

An issue includes the same facts as human output:

```json
{
  "healthy": false,
  "issues": [
    {
      "code": "CROSS_FEATURE_INTERNAL_IMPORT",
      "message": "...",
      "file": "src/features/billing/server/routes.ts",
      "relationship": "billing -> users",
      "reason": "Features may communicate only through the target feature public index.",
      "suggestion": "..."
    }
  ]
}
```

## `nara inspect <feature>`

Describe one discovered Feature without opening all source files:

```bash
nara inspect users
```

Human output lists the public exports, browser-safe public exports, boundary export provenance, exact public/web API consumers, explicitly type-only versus value-capable syntax evidence, dependencies, dependents, server entrypoints, web entrypoints, contracts, tests, and statically provable application integrations (server routes, web routes, and application consumers). Route integrations require the framework composition chain itself to be statically proven from the canonical root; uncertain composition is omitted.

Use machine-readable output when selecting a bounded change surface:

```bash
nara inspect users --json
```

The result contains these fields:

```json
{
  "name": "users",
  "path": "src/features/users",
  "publicExports": ["userRoutes"],
  "webPublicExports": ["UsersPage"],
  "boundaryExports": {
    "public": [
      {
        "feature": "users",
        "boundary": "public",
        "boundaryFile": "src/features/users/index.ts",
        "exportedName": "userRoutes",
        "kind": "local",
        "precision": "symbol",
        "typeOnly": false
      }
    ],
    "web": []
  },
  "dependencies": ["auth"],
  "dependents": [],
  "serverEntrypoints": ["server/routes.ts"],
  "webEntrypoints": [],
  "contracts": ["UserProfile"],
  "tests": ["tests/routes.test.ts"],
  "consumerEvidence": [
    {
      "from": "billing",
      "to": "users",
      "sourceFile": "src/features/billing/index.ts",
      "specifier": "@/features/users",
      "boundary": "public",
      "usesInternalPath": false,
      "kind": "named-import",
      "precision": "symbol",
      "importedSymbol": "userRoutes",
      "localName": "userRoutes",
      "typeOnly": false
    }
  ],
  "integrations": {
    "applicationImports": [{ "feature": "users", "appFile": "src/app/server.ts", "boundary": "public", "symbols": ["userRoutes"] }],
    "serverRoutes": [{ "feature": "users", "appFile": "src/app/server.ts", "exportName": "userRoutes", "mountPath": "/api/users" }],
    "webRoutes": []
  }
}
```

`consumerEvidence` is limited to symbol-level imports and re-exports through the public or web boundary. `boundaryExports` records the shallow, canonical-boundary export syntax that proves where a public symbol comes from; direct named re-exports to the Feature's `contract.ts` are the only contract provenance used for removed-contract consumer impact. Module-level forms remain visible through dependency facts and diff consumer changes, but Nara does not invent an exact symbol for them.

Unknown Features return a readable error and exit non-zero. Available Feature names are included when any exist.

## `nara context <feature>` / `nara context --file <path>`

A deterministic Architecture Context Pack for humans and coding agents before they modify a Feature:

```bash
nara context users
nara context users --json
nara context --file src/features/users/server/routes.ts
```

`--file` accepts repository-relative paths, absolute paths inside the repository, and normalized separators. It resolves the owning Feature from discovered architecture — no fuzzy name matching. Paths outside the repository, directories, and files not owned by a Feature fail with a clear error. File targeting returns identical architectural facts to feature targeting; only `target.selectedBy` and `target.sourceFile` differ.

The pack answers: *if I am about to change this Feature, what architectural context do I need before touching the code?* It is derived from the existing architecture model — no LLM, no embeddings, no source-code dump:

- `target`: selected Feature, how it was selected (`feature` | `file`), and the normalized source file when file-selected
- `ownership`: Feature directory, public boundary, and every owned source file (sorted)
- `publicApi`: public exports from `index.ts`, browser-safe exports from `web/index.ts`, and contract exports from `contract.ts` (via `inspect`)
- `boundaryExports`: shallow export evidence for the canonical public and web boundaries, including local declarations, named aliases, default exports, and module-precision export-all records
- `consumers`: exact public/web symbol consumers with source files, aliases, and explicitly type-only versus value-capable syntax evidence; module-precision imports remain module evidence only
- `relationships`: dependencies, direct dependents, and transitive dependents (via the dependency graph and `impact` primitives) — what this Feature relies on and what could be structurally affected
- `surfaces`: server, web, and test surfaces
- `constraints`: the architecture rules in force while editing (public boundary is `index.ts`, cross-Feature imports use the public boundary, internals are private, server code stays out of browser surfaces, canonical shape stays valid)
- `diagnostics`: current `nara doctor` issues whose offending file is owned by this Feature — unrelated repository diagnostics are excluded
- `integrations`: canonical application imports grouped by Feature, app file, and boundary, plus static Hono server mounts and Vue Router records; route facts require a statically provable framework composition chain, while uncertain or dynamic composition is omitted

Example JSON:

```json
{
  "schemaVersion": 1,
  "target": { "feature": "users", "selectedBy": "feature" },
  "ownership": {
    "directory": "src/features/users",
    "publicBoundary": "src/features/users/index.ts",
    "ownedFiles": ["src/features/users/contract.ts", "src/features/users/index.ts"]
  },
  "publicApi": { "exports": ["usersRoutes"], "webExports": ["UsersPage"], "contracts": ["User"] },
  "relationships": { "dependencies": ["auth"], "directDependents": [], "transitiveDependents": [] },
  "boundaryExports": {
    "public": [{ "feature": "users", "boundary": "public", "boundaryFile": "src/features/users/index.ts", "exportedName": "usersRoutes", "kind": "local", "precision": "symbol", "typeOnly": false }],
    "web": []
  },
  "surfaces": { "server": ["src/features/users/server/routes.ts"], "web": [], "tests": [] },
  "consumers": [
    {
      "from": "billing",
      "to": "users",
      "sourceFile": "src/features/billing/index.ts",
      "specifier": "@/features/users",
      "boundary": "public",
      "usesInternalPath": false,
      "kind": "named-import",
      "precision": "symbol",
      "importedSymbol": "usersRoutes",
      "localName": "usersRoutes",
      "typeOnly": false
    }
  ],
  "integrations": {
    "applicationImports": [{ "feature": "users", "appFile": "src/app/server.ts", "boundary": "public", "symbols": ["usersRoutes"] }],
    "serverRoutes": [{ "feature": "users", "appFile": "src/app/server.ts", "exportName": "usersRoutes", "mountPath": "/api/users" }],
    "webRoutes": []
  },
  "constraints": [{ "code": "PUBLIC_BOUNDARY_IS_INDEX", "description": "..." }],
  "diagnostics": [],
  "readingOrder": [
    { "path": "src/features/users/index.ts", "reason": "Public boundary of the users Feature." }
  ]
}
```

Human output is compact: it shows the same facts but omits the full owned-file set (available in JSON). All arrays have deterministic ordering and JSON output never contains `undefined`.

`context` reuses their primitives but never collapses them.

## `nara impact <feature>`

Show which Features depend on a target in the known Feature graph:

```bash
nara impact auth
nara impact auth --json
```

Example JSON:

```json
{
  "name": "auth",
  "directDependents": ["users"],
  "transitiveDependents": [],
  "directConsumerEvidence": [
    {
      "from": "users",
      "to": "auth",
      "sourceFile": "src/features/users/index.ts",
      "specifier": "@/features/auth",
      "boundary": "public",
      "usesInternalPath": false,
      "kind": "named-import",
      "precision": "symbol",
      "importedSymbol": "requireAuth",
      "localName": "requireAuth",
      "typeOnly": false
    }
  ],
  "scope": "feature dependency graph"
}
```

`impact` reports graph relationships and direct statically proven symbol-consumer evidence, not semantic business impact. Consumer evidence is limited to direct dependents and exact public/web symbols; module-level imports remain dependency facts. Review contracts and behavior after identifying the affected dependents.

## `nara diff --base <ref> [--head <ref>] [--json]`

Nara can describe not only what the architecture is, but how the architecture is changing. `git diff` explains text changes; `nara diff` explains deterministic Feature-architecture changes between a Git base ref and the current working tree (including uncommitted source changes), or between two Git refs with `--head`:

```bash
nara diff --base main
nara diff --base origin/main
nara diff --base v3.0.0 --head HEAD
nara diff --base main --json
```

`--base` is required; `--head` is optional. When `--head` is omitted the base ref is compared against the working tree. When `--head` is supplied both sides are Git refs and the working tree is never modified (no checkout, reset, stash, or clean). The command never mutates user changes; ref state is materialized into an isolated temporary directory via read-only Git plumbing and always cleaned up.

The diff reports architecture changes, not line changes: added/removed Features, per-Feature added/removed public and web-boundary exports and contract exports, added/removed dependency edges with deterministic module and symbol import evidence, per-Feature added/removed server/web/test surfaces, added/removed canonical application imports, statically proven Hono server routes, statically proven Vue web routes, and newly introduced versus resolved doctor diagnostics. `consumerEvidence` reports exact import/re-export changes with source, boundary, aliases, and explicitly type-only versus value-capable syntax evidence. Nara does not resolve declaration categories through the TypeScript type checker. `removedPublicApiConsumers` connects removed public/web/contract symbols to baseline consumers and labels whether each consumer remains declared or was removed in the same change; it does not predict breakage. A changed route path is represented as a removal plus an addition.

`boundaryExportProvenance` reports same-name changes in a canonical public or web boundary's source evidence without inventing a public export-name change. Each delta lists removed and added evidence. A removed contract export is connected to consumers only through a direct named boundary re-export from that Feature's `contract` or `contract.ts`; aliases are matched by the boundary export name, while export-all and unrelated re-exports remain conservative.

A successful comparison returns exit code `0` whether or not the architecture changed. Existing baseline violations do not fail the command; policy enforcement is `nara guard`. No configuration file, architecture manifest, LLM, or AI provider is required.

## `nara guard --base <ref> [--head <ref>] [--json]`

Nara can distinguish existing architecture debt from architecture debt introduced by the current change. `nara doctor` asks whether the target architecture is healthy; `nara guard` asks whether the target introduced new violations compared with an existing Git baseline:

```bash
nara guard --base main
nara guard --base origin/main
nara guard --base origin/main --head HEAD
nara guard --base main --json
```

`--base` is required and is the regression baseline — no baseline file, no configuration. Git semantics exactly match `nara diff`: without `--head` the base ref is compared against the working tree including uncommitted source changes; with `--head` two refs are compared and the working tree is never modified. The guard fails (exit `1`) only when the target introduces one or more new `nara doctor` diagnostics that did not exist in the base snapshot. Inherited baseline violations do not fail the guard, resolved violations are reported positively, and unchanged baseline debt is acknowledged but not dumped per-issue in human output. Architecture changes themselves (Features, exports, contracts, edges, surfaces, affected dependents) are informational and never fail the guard.

```text
Architecture guard passed.
No new architecture violations.

Baseline issues: 3
Resolved: 1
Remaining baseline issues: 2
```

A failing result starts clearly, lists each new diagnostic with the same stable facts as `nara doctor` (`code`, `file`, `relationship`, `reason`, `suggestion`), and shows the structurally affected Feature set as the review surface.

JSON (`schemaVersion: 1`) reports `passed` (true exactly when no issue was introduced), the base/target identities, the `regression` counts with full `introducedIssues`/`resolvedIssues` doctor structures in deterministic order, and the `affected` structural set. `passed` is suitable for CI gates and coding agents:

```bash
npx nara guard --base origin/main
```

## Exit status and failures

The CLI uses stable categories instead of stack traces for expected failures:

| Status | Meaning |
|---:|---|
| `0` | Command completed successfully (`guard` passes only with no new violations) |
| `1` | Requested Feature or architecture analysis failed (including a `guard` regression or an unresolvable Git comparison) |
| `64` | Invalid command, arguments, Feature/project name, or unknown official package |
| `73` | Duplicate target or filesystem failure |

Expected failures are written as human-readable diagnostics. `--json` is supported by `doctor`, `inspect`, `context`, `impact`, `diff`, and `guard`; invalid JSON-mode requests still return a JSON error object where the command accepts the flag.

```bash
npx nara context billing --json
# edit only the bounded Feature surface
npx nara doctor --json
npm run lint
npm test
```
Use `inspect` before opening unrelated files, `context` for a focused implementation handoff, `impact` before changing a public contract, `diff --base main` during review to see how the architecture is changing, and `guard --base origin/main` in CI to block newly introduced architecture violations. Nara remains useful when no AI provider is configured.
