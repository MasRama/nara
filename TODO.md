# Nara v3 TODO

Target: `v3.0.0`

Execution rules:

* Complete tasks in order unless dependencies explicitly allow otherwise.
* Do not mark a task complete until all acceptance criteria pass.
* Do not implement future tasks while completing the current task.
* `V3_SPEC.md` is authoritative.
* `[ ]` = pending
* `[~]` = in progress
* `[x]` = complete
* `[!]` = blocked

---

# M0 — Rewrite Foundation

## [x] V3-001 — Verify v3 branch isolation

### Goal

Ensure the rewrite is isolated from stable Nara v2.

### Requirements

* confirm work is on `v3`
* do not alter `main`
* record current v2 HEAD for reference
* inspect existing repository structure

### Acceptance

* current branch is `v3`
* v2 remains recoverable from `main`
* no merge into `main` occurs

### Do not

* rewrite code yet
* mass-delete v2 code before inventory
* change architecture decisions

---

## [x] V3-002 — Inventory current Nara v2

### Goal

Create a concise implementation inventory before removing v2 architecture.

### Inspect

* application entrypoint
* HTTP engine
* frontend entrypoint
* database/query layer
* auth
* config
* validation
* tests
* logging
* migrations
* build
* package scripts
* environment variables
* reusable business capabilities

### Output

Create:

```text
docs/v3/v2-inventory.md
```

Categorize every important area as:

```text
PRESERVE
REIMPLEMENT
REMOVE
REVIEW
```

### Acceptance

* all important v2 subsystems are accounted for
* Ultimate Express/uWebSockets.js are explicitly marked for removal
* current frontend/database/auth choices are documented
* no architecture redesign occurs in this task

---

## [x] V3-003 — Establish v3 source skeleton

### Goal

Create the minimal v3 architecture.

### Target

```text
src/
  app/
  features/
  shared/
```

### Requirements

Do not create empty nested architecture merely for visual symmetry.

### Acceptance

* top-level v3 architecture exists
* old technical-layer architecture is no longer the target structure
* application can still be iterated incrementally

---

# M1 — HTTP and Application Core

## [x] V3-010 — Remove Ultimate Express from v3

### Goal

Remove the previous HTTP engine from the v3 runtime path.

### Remove

* Ultimate Express usage
* uWebSockets.js pin/workaround
* uWS-specific runtime assumptions
* uWS-specific configuration

### Acceptance

Search confirms the v3 runtime does not depend on:

```text
ultimate-express
uWebSockets.js
```

except historical documentation if intentionally retained.

### Do not

* replace unrelated dependencies
* optimize performance yet

---

## [x] V3-011 — Install Hono Node server foundation

### Goal

Create the canonical Nara v3 HTTP application.

### Required

```text
hono
@hono/node-server
```

### Reference

```ts
const app = new Hono()
```

served through the standard Node adapter.

### Acceptance

* development server starts
* HTTP request succeeds
* graceful startup errors are readable
* TypeScript passes

---

## [x] V3-012 — Add health endpoint

### Goal

Provide a minimal runtime verification endpoint.

### Route

```text
GET /health
```

### Expected

```text
200
```

with a small deterministic payload.

### Acceptance

* integration test verifies endpoint
* endpoint does not depend on DB/auth

---

## [x] V3-013 — Adapt existing configuration system

### Goal

Move existing proven Nara config behavior into the v3 architecture.

### Requirements

* preserve existing useful environment behavior
* fail clearly for missing required configuration
* avoid custom config framework
* locate application-wide config under `src/shared/config` or another spec-compliant shared location

### Acceptance

* development environment works
* production validation works
* tests cover invalid required configuration

---

## [x] V3-014 — Adapt logging

### Goal

Preserve existing useful logging behavior under the v3 structure.

### Acceptance

* server startup is logged
* runtime errors are loggable
* feature code can use the shared logging facility
* no custom logging abstraction is added without need

---

## [x] V3-015 — Adapt error handling

### Goal

Establish predictable application error behavior.

### Requirements

Distinguish at minimum:

* expected application errors
* validation errors
* unexpected server errors

### Acceptance

* unexpected errors do not expose internal stack traces in production responses
* test coverage exists
* Hono-native mechanisms are preferred where adequate

---

# M2 — Feature Model

## [x] V3-020 — Implement first real v3 feature

### Goal

Use one existing Nara capability as the reference implementation of a v3 Feature.

Prefer a capability with meaningful server behavior.

### Required structure

At minimum:

```text
src/features/<feature>/
  index.ts
  server/
  tests/
```

Add `contract.ts` and `web/` only if actually relevant.

### Acceptance

* feature works end-to-end
* business logic is locally understandable
* no unrelated feature internals are required to understand it
* public exports go through `index.ts`

---

## [x] V3-021 — Define canonical Feature rules

### Goal

Turn the working feature into explicit architectural conventions.

### Document

Create:

```text
docs/v3/feature-model.md
```

Cover:

* what is a Feature
* feature naming
* public interface
* internals
* server
* web
* tests
* contracts
* dependencies
* shared code rule

### Acceptance

* documentation matches actual implementation
* no speculative structures are documented

---

## [x] V3-022 — Implement second real feature

### Goal

Validate that the architecture works for more than one capability.

### Requirements

The second feature must communicate with the first if a natural existing Nara capability allows it.

### Acceptance

* cross-feature usage occurs only through public interface
* architecture remains understandable
* no global service layer is introduced to avoid feature boundaries

---

## [x] V3-023 — Migrate representative existing v2 capabilities

### Goal

Move enough existing Nara functionality to validate the v3 architecture.

### Requirements

Do not blindly migrate every file.

For each capability:

1. identify business owner feature
2. move/reimplement code inside feature
3. expose only required public API
4. remove obsolete v2 implementation after parity is verified

### Acceptance

* no duplicate active implementation remains
* feature ownership is explicit
* tests pass

---

# M3 — Vue Frontend Migration

## [x] V3-024 — Remove Svelte frontend runtime and tooling

### Goal

Remove the v2 Svelte runtime and build integration before introducing Vue.

### Requirements

* remove Svelte runtime, compiler, Vite plugin, config, and Svelte-specific UI/runtime packages
* remove `@inertiajs/svelte` and Svelte-specific tooling
* keep the Hono + Node backend unchanged

### Acceptance

* no active Svelte source, config, package, or build-plugin reference remains
* frontend migration starts from a clean Vue-compatible dependency graph
* Hono + Node server behavior remains intact

---

## [x] V3-025 — Install Vue frontend stack

### Goal

Make Vue 3 + Vite + TypeScript the only supported frontend stack.

### Requirements

* add Vue 3, `@vitejs/plugin-vue`, and the Vue TypeScript checker
* configure Vite for Vue SFCs
* do not add Nuxt, SSR, React, Svelte, or multi-framework abstractions

### Acceptance

* `package.json` and the lockfile contain the required Vue dependencies
* Vite resolves Vue SFCs through the Vue plugin

---

## [x] V3-026 — Establish Vue application bootstrap

### Goal

Mount a direct Vue application through the existing Vite HTML shell.

### Requirements

* keep the Vite entrypoint thin
* place application-wide Vue composition under `src/app/`
* do not introduce a custom frontend framework abstraction
* do not add SSR unless a later specification explicitly requires it

### Acceptance

* the existing HTML shell mounts a Vue application
* the application bootstrap is TypeScript and production-buildable

---

## [x] V3-027 — Establish feature-first Vue web structure

### Goal

Give browser code the same Feature ownership as server code.

### Requirements

* feature-specific Vue pages, components, and composables live under the owning Feature's `web/`
* application-wide Vue composition remains under `src/app/`
* cross-feature browser code uses public Feature boundaries

### Acceptance

* at least one real Feature web surface exists under a Feature `web/` directory
* no browser surface imports another Feature's internal implementation

---

## [x] V3-028 — Migrate frontend shell and UI behavior

### Goal

Port useful existing browser behavior from Svelte to Vue without preserving Svelte implementation details.

### Requirements

* preserve the existing shell's useful styling, theme behavior, navigation, and user-facing interactions where applicable
* use direct Vue composition rather than a custom Nara frontend abstraction
* keep backend contracts and Hono + Node behavior unchanged

### Acceptance

* the shell runs through Vue
* required migrated interactions behave as before
* no Svelte implementation remains in the active frontend

---

## [x] V3-029 — Verify Vue frontend migration

### Goal

Replace Svelte-specific checks and verify the complete Vue migration.

### Requirements

* replace `svelte-check` with `vue-tsc` or an equivalent Vue-aware typecheck
* run frontend typecheck, production build, tests, and `nara doctor`

### Acceptance

* all required verification commands pass
* no Svelte dependency, config, import, or checker remains

---

# M4 — Full-Stack Contracts

## [x] V3-030 — Establish canonical feature contract pattern

### Goal

Define how server/client contracts are expressed.

### Requirements

* use TypeScript-first ecosystem tooling
* avoid custom Nara RPC
* keep contracts feature-scoped
* evaluate existing Hono typing capabilities before adding codegen

### Acceptance

* one feature demonstrates typed request input
* response typing is available to the consuming TypeScript code
* validation exists at runtime
* no manually duplicated request types exist

---

## [x] V3-031 — Implement feature-scoped API client

### Goal

Avoid one giant application RPC type.

### Acceptance

* consuming code can use a typed client for one feature
* feature contract types remain local to that capability
* editor/typecheck performance remains reasonable

---

## [x] V3-032 — Validate contracts in multiple features

### Goal

Ensure the pattern generalizes.

### Acceptance

At least two real features use the canonical contract pattern.

Document any necessary convention updates in `docs/v3/feature-model.md`.

---

## [x] V3-033 — Complete canonical full-stack development loop
> Verified 2026-09-03: root `npm run dev` started Vite + Hono, proxied `/health` and `/ready`, and both ports closed on shutdown; the existing fresh-project integration now starts generated `npm run dev`, requests Vite `/health`, asserts `200 {"status":"ok"}`, verifies both dev ports close, then runs typechecks, tests, `npm run check`, real doctor, production build/start/health, and cleanup. Root and generated Vite configs proxy `/api`, `/health`, and `/ready`; `createAuthClient` remains relative; `npm run test:new-project` and `npm run check` passed without a custom framework or new orchestration dependency.

### Goal

Make one command start the Vue/Vite frontend and Hono development server with same-origin backend proxying.

### Acceptance

* one command starts Vue + Hono development
* browser API requests use same-origin relative URLs
* Vite proxies backend traffic to Hono
* generated applications use the same topology
* real generated-project validation proves a request through Vite reaches Hono
* no custom development framework is introduced

## [x] V3-034 — Establish canonical SPA routing and Feature page composition
> Verified 2026-09-03: Vue Router is installed as the browser routing layer; the app-level router resolves `/` to `src/app/pages/HomePage.vue` and `/login` to the auth-owned `LoginPage.vue`; RouterLink navigation changes the mounted page without replacing the document; Feature web sources are included in Tailwind; generated projects include the same router foundation; direct Vite `/login` returned the SPA shell; `npm run check`, `npm run build`, `npm run test:new-project`, and architecture doctor passed.

### Goal

Establish Vue Router as the canonical SPA composition layer.

### Acceptance

* Vue Router is the browser routing layer
* `/` and `/login` resolve client-side
* LoginPage remains owned by auth
* app layer owns route composition
* internal navigation does not cause full document reload
* Tailwind sees Feature browser surfaces
* generated applications use the canonical routing foundation
* frontend typecheck/tests/build pass
* architecture doctor passes

## [x] V3-035 — Establish canonical SQLite migration and data lifecycle
> Local verification 2026-09-03: Feature-owned forward SQL migrations, checksummed `_nara_migrations` ledger, atomic concurrent-safe application, startup gating, lifecycle commands, idempotent RBAC seeds, explicit secure admin bootstrap, online backup, integrity checks, and safe previous-v3 schema compatibility are implemented. Deterministic build cleaning removes stale migration/seed artifacts; `db:backup` and `db:check` refuse missing persistent files without creating databases; a real two-process race against one SQLite file completes successfully with one applied and one ledger-skipping result. Relevant lifecycle tests (14/14), `npm run lint`, `npm run check` (33 files, 92 tests), `npm run build`, and `npm run architecture:doctor` passed locally; this note does not claim remote GitHub Actions confirmation.

### Goal

Establish the canonical SQLite connection, migration, seed, bootstrap, backup, and integrity lifecycle for Nara v3.

### Acceptance

* SQLite connection no longer owns application schema creation
* Feature-owned forward migrations are canonical
* migration ledger includes checksums
* migration application is atomic
* applied migration edits are rejected
* migrations run before HTTP listen
* explicit migrate/status/fresh commands work
* fresh refuses production
* seeds are idempotent
* no insecure default admin seed exists
* explicit admin bootstrap works
* online backup works
* database integrity check works
* current v3 schema/data compatibility is handled safely
* tests pass
* architecture doctor passes


## [x] V3-036 — Restore browser authentication flow
> Verified 2026-09-03: auth-owned Vue registration/login/session pages use same-origin `/api/auth/*`; current-user bootstrap, guarded redirects, cookie logout, loading/error states, and no-reload browser flows are covered by frontend integration tests.

### Goal

Complete the auth-owned browser surface without reintroducing server-rendered pages or a frontend framework abstraction.

### Scope

* add the auth-owned registration page and field diagnostics
* compose `/login` and `/register` through the app router
* bootstrap current-user state through the auth public interface
* guard authenticated routes, redirect successful auth to the application, and provide browser logout
* keep browser requests same-origin and session-cookie based

### Acceptance

* registration and login complete through Vue pages against `/api/auth/*`
* authenticated sessions survive a route change and logout invalidates the browser session
* unauthenticated access to a protected route redirects to `/login`
* the existing login/register error and loading states are covered by frontend integration tests

### Architecture follow-up (complete)
> 2026-09-03: formalized the optional browser-safe `src/features/<feature>/web/index.ts` boundary, documented app/Feature import rules, and added deterministic doctor fixtures for valid barrels and invalid deep imports.

---

## [x] V3-037 — Restore dashboard and account browser surfaces
> Release-blocking: v2 users could reach dashboard, profile, password, avatar, and account navigation flows that have no v3 page replacement.
> Verified 2026-09-03: Vue Router routes and the app-owned authenticated shell restore dashboard/profile navigation without reloads; users/auth public browser clients cover profile, password, avatar, session-aware landing CTAs, and logout transitions.

### Goal

Restore the authenticated application shell and personal account workflows under v3 Feature ownership.

### Scope

* add dashboard and profile routes/pages
* add permission-aware application navigation and sign-out
* restore profile editing, password change, avatar upload, and avatar display
* make the landing page CTA reflect the current session

### Acceptance

* authenticated users can reach `/dashboard` and `/profile` without a document reload
* profile, password, and avatar workflows use the owning Feature public interfaces
* navigation and dashboard actions respect the current user's session and permissions
* frontend integration tests cover success, validation failure, unauthorized redirect, and logout transitions

---

## [x] V3-038 — Restore users and RBAC browser surfaces
> Release-blocking: v3 exposes user and role APIs but no browser workflow for administration.

### Goal

Restore the v2 users and roles workflows as Vue pages backed by the v3 auth/users Feature boundaries.

### Scope

* add `/users` and `/roles` routes/pages
* restore user search, pagination, create, edit, delete, and role assignment
* restore role and permission listing, create, edit, and delete
* expose permission-aware controls and align response payloads with public contracts

### Acceptance

* an admin can complete the documented user and role CRUD workflows from Vue
* a restricted user sees only permitted data/actions and receives clear forbidden diagnostics
* self-demotion, self-delete, protected-admin, and last-admin invariants remain enforced
* role, permission, and user-management integration tests cover the browser/API contract, including the `userCount` response shape
> Verified 2026-09-03: Auth `/me` exposes browser-safe roles/permissions; permission-aware shell, `/users`, and `/roles` flows use Feature clients and real Hono APIs. Browser coverage proves server pagination/search, user and role CRUD, role/permission assignment, forbidden access, and deletion/protection invariants.

---

## [x] V3-039 — Restore production browser and static delivery
> Release-blocking: resolved; the production Node entrypoint now serves the built Vue application and safe static assets.

### Goal

Make the built Vue application and its safe static assets reachable through the documented production startup path.

### Scope

* serve the built SPA shell from the production Node entrypoint
* provide history fallback for known client routes and a user-facing 404 for unknown routes
* preserve safe access to built, public, storage, and avatar assets using documented v3 paths
* define one canonical public `APP_URL` and document the Vite-development versus Node-production topology

### Acceptance

* `npm run build && npm start` serves `/`, `/login`, every shipped client route, and the user-facing 404 surface
* built/public/avatar assets return the expected content type, cache policy, and path-traversal protection
* `/health`, `/ready`, and `/api/*` remain reachable through the same production process
* configuration examples and startup logs identify the actual public browser URL

---

## [x] V3-043 — Restore browser request security controls
> Sealed 2026-09-04 (final adversarial closure): route-owned body budgets replace MIME-owned limits — every state-changing /api/* request is bounded by MAX_JSON_BODY_BYTES regardless of Content-Type (multipart/misleading-mixed/missing-CT smuggling to register rejected with 413), only POST /api/assets/avatar owns the 5 MB + 256 KiB framing request budget with the Feature 5 MB file check authoritative; unread-but-uninspectable bodies fail closed with 413 while bodyless requests pass; limiter and login-throttle 10_000-key ceilings sweep-then-fail-closed (deterministic 429, active lockout/failure state preserved, tiny test capacities supported); proxy trust covers disabled/forged/hops=1/hops=2/malformed/short-chain cases; all prior V3-043 controls preserved. `src/shared/security/tests/security.test.ts` (51 tests), `npm run check`, production serving smoke green.

### Goal

Reimplement the effective v2 request protections as feature-neutral Hono middleware or equivalent application composition.

### Scope

* security headers, CSP, HSTS in production, frame/content/referrer/permissions policy
* double-submit CSRF tokens for cookie-authenticated state-changing browser requests
* global and auth-specific rate limits with login identifier/IP lockout
* request body limits and the v2 input-sanitization contract where browser/API data requires it

### Acceptance

* integration tests assert required headers in development and production modes
* state-changing browser requests fail without a valid CSRF token and succeed with one
* auth and global limits return deterministic 429 responses with limit metadata and retry guidance
* repeated failed logins trigger identifier/IP lockout without exposing account existence
* oversized and unsafe input cases have explicit bounded diagnostics

---

## [x] V3-044 — Restore request lifecycle observability
> Sealed 2026-09-04: `src/app/observability.ts` provides validated request IDs (safe opaque IDs preserved, oversized/unsafe replaced with UUID, `X-Request-Id` on 401/403/404/413/429/500), one structured non-health completion event per request (method/path/status/duration/requestId, no secrets, health/ready excluded but ID'd), error correlation via `handleError`, `hono/compress` production compression, production `LOG_LEVEL=info` default, Auth-owned `cleanupExpiredSessions` with App-owned startup + hourly scheduling (`stopSessionCleanup` on shutdown, no import-time timers). `src/app/observability.test.ts` (17 tests) green.

### Goal

Preserve the v2 request lifecycle behavior while keeping implementation in the v3 app/shared layers.

### Scope

* propagate or generate `X-Request-Id`
* log non-health HTTP requests with method, path, status, duration, and request ID
* retain compressed responses and production-safe default log verbosity
* clean expired sessions at startup and on the documented interval

### Acceptance

* request integration tests verify request IDs, structured request events, and compressed responses
* production configuration defaults to `info` unless explicitly overridden
* expired sessions are removed on startup and during the cleanup interval

---

## [x] V3-045 — Close v2 parity regression coverage
> Sealed 2026-09-04: `docs/v3/parity-matrix.md` maps every preserved/replaced capability to executable tests; real Vite topology smoke (`tests/v3/vite-topology.test.ts`: Vite document + /health and /api/auth/me proxied to Hono) complements behavior-level Vue suites and the production serving smoke; auth/account/users-RBAC/static/config/database/security/observability umbrellas closed (Vue 404, TRUST_PROXY validation, removed-stack manifest+import scan); generated project stays minimal with `test:new-project` green. Full `npm test` (203 tests), `npm run check`, `build`, `architecture:doctor`, `test:production-serving`, `test:new-project` all green.

### Goal

Make every preserved or replaced user-facing and security capability executable in deterministic tests.

### Acceptance

* tests exercise the Vue routes through the Vite topology and the production Node topology
* auth, dashboard, profile, users, roles, assets, not-found, static delivery, configuration, and security controls each have a behavior-level regression test
* test names and fixtures distinguish intentionally removed v2 behavior from accidental gaps

---

# M5 — Nara CLI Foundation

## [x] V3-040 — Establish CLI package/entrypoint

### Goal

Create the TypeScript Nara CLI foundation.

### Requirements

* TypeScript
* no Go/Rust rewrite
* deterministic command routing
* useful exit codes
* testable command handlers

### Acceptance

```bash
nara --help
```

works.

---

## [x] V3-041 — Implement `nara make feature`

### Goal

Generate the canonical minimal Feature structure.

### Example

```bash
nara make feature invoices
```

### Requirements

* validate feature name
* refuse unsafe overwrite
* create only useful skeleton files
* follow canonical feature convention

### Acceptance

* generated feature passes architecture validation
* invalid name produces useful diagnostic
* duplicate feature is handled safely
* tests use temporary fixture projects

---

## [x] V3-042 — Implement `nara new`
> Verified by `npm run test:new-project`: a temporary project created through the real `nara new` path installed dependencies, ran server and Vue typechecks, ran tests and `npm run check`, built, started `build/server.js`, and returned HTTP 200 with `{"status":"ok"}` from `/health`; the spawned server was terminated and the temporary directory was removed.

### Goal

Create a clean Nara v3 application.

### Requirements

* opinionated defaults
* minimal decisions/prompts
* no generic stack configurator
* project runs after setup
* includes architecture docs/agent entrypoint as appropriate

### Acceptance

Fresh generated project can:

```text
install
typecheck
test
run
```

without manual architecture fixes.

---

# M6 — Architecture Engine

## [x] V3-050 — Implement feature discovery

### Goal

Discover Nara Features from repository conventions.

### Input

```text
src/features/*
```

### Requirements

* deterministic
* no LLM
* no manually maintained manifest required

### Acceptance

* valid features discovered
* malformed entries handled gracefully
* tests cover representative fixtures

---

## [x] V3-051 — Implement feature dependency discovery

### Goal

Determine feature-to-feature dependencies.

### Source

Prefer TypeScript imports and public-boundary usage.

### Acceptance

For:

```text
billing → users
billing → auth
```

Nara discovers both dependencies reliably.

### Do not

Build whole-program semantic analysis unless necessary.

---

## [x] V3-052 — Detect cross-feature internal imports

### Goal

Protect public feature boundaries.

### Invalid

```text
billing
  → users/server/repository
```

### Valid

```text
billing
  → users
```

### Acceptance

* invalid fixture fails
* valid fixture passes
* diagnostic shows source and target
* diagnostic suggests public import direction

---

## [x] V3-053 — Detect circular feature dependencies

### Goal

Identify feature dependency cycles.

### Example

```text
billing → users → teams → billing
```

### Acceptance

* cycle is detected
* full cycle path is reported
* acyclic projects pass

---

## [x] V3-054 — Detect supported server/client leaks

### Goal

Prevent obvious server-only code from entering client-side feature code.

### Requirements

Begin with rules that are reliable from repository conventions.

Do not invent an advanced compiler analysis system.

### Acceptance

* known invalid fixtures fail
* valid shared contracts remain usable by both sides
* false-positive rate remains low

---

# M7 — `nara doctor`

## [x] V3-060 — Implement doctor command

### Goal

Expose architecture validation through:

```bash
nara doctor
```

### Initial checks

* feature shape
* public boundaries
* dependency cycles
* server/client leaks

### Acceptance

Valid project:

```text
Architecture looks healthy.
```

Invalid project:

* exits non-zero
* explains every detected issue
* does not dump unreadable stack traces

---

## [x] V3-061 — Design human diagnostics

### Goal

Make architecture failures immediately actionable.

### Every relevant diagnostic should include

* problem
* file
* relationship
* reason
* recommended direction

### Acceptance

Diagnostics can be understood without reading Nara source code.

---

## [x] V3-062 — Add `nara doctor --json`

### Goal

Allow agents and CI to consume diagnostics.

### Acceptance

* stable structured schema exists
* human and JSON modes share the same analysis
* JSON output contains no decorative terminal text

---

## [x] V3-063 — Add doctor to CI example

### Goal

Show architecture validation as a normal project quality gate.

### Acceptance

Example CI runs:

```text
typecheck
tests
nara doctor
```

---

# M8 — Understand

## [x] V3-070 — Implement `nara inspect <feature>`

### Goal

Describe one Feature.

### Include when available

* path
* public exports
* dependencies
* dependents
* server entrypoints
* web entrypoints
* contracts
* tests

### Acceptance

* no LLM required
* unknown feature produces useful error
* output is concise

---

## [x] V3-071 — Add `nara inspect --json`

### Acceptance

Structured data represents the same architecture facts as human output.

---

## [x] V3-072 — Implement `nara context <feature>`

### Goal

Produce bounded context suitable for coding work.

### Include only relevant architecture information.

Do not dump entire source files by default.

### Acceptance

An agent can identify:

* where to work
* public dependencies
* dependents
* relevant contracts
* relevant server/web/test surfaces

without scanning the whole repository.

---

## [x] V3-073 — Add `nara context --json`

### Acceptance

Output is deterministic and machine-readable.

---

## [x] V3-074 — Implement `nara impact <feature>`

### Goal

Show known feature-level downstream impact.

### Initial scope

Feature dependency graph only.

### Acceptance

* direct dependents are shown
* transitive dependents may be shown separately
* output does not claim semantic certainty beyond known architecture relationships

---

# M9 — Composition

## [x] V3-080 — Define installable feature format

### Goal

Define the smallest format required for reusable Nara Features.

### Principles

* open code
* inspectable
* editable after installation
* no opaque runtime
* no custom package manager

### Acceptance

Specification supports at least one official reusable feature.

---

## [x] V3-081 — Implement first official installable feature
> Verified by `npm run test:official-feature`: a temporary project created through the real `nara new` path installed dependencies, installed the `audit` Feature through the real CLI path, ran generated server and Vue typechecks, ran its two tests and `npm run check`, and passed the repository's real doctor with `Architecture looks healthy.`; the temporary directory was removed.

### Goal

Prove the model with one existing useful Nara capability.

### Acceptance

Feature can be installed into a clean fixture project and:

```text
typecheck
doctor
test
```

passes.

---

## [x] V3-082 — Implement `nara add`

### Example

```bash
nara add auth
```

### Requirements

* safe file writes
* collision detection
* clear list of changes
* no automatic merge with locally modified same-name feature

### Acceptance

* install succeeds in clean project
* collision is handled safely
* resulting source belongs to project
* `nara doctor` passes

---

## [x] V3-083 — Add second installable feature

### Goal

Ensure the distribution model is not accidentally specific to the first feature.

### Acceptance

Two materially different features use the same installation mechanism.

---

# M10 — Agent Ergonomics

## [x] V3-090 — Verify root `AGENTS.md` is sufficient
> Verified 2026-09-03 with a cold-start bounded documentation task: the root guidance identified V3-090, the locked stack and feature rules, forbidden scope, and required checks; implementation inspection found the generated Vue/Hono health application; `docs/v3/cli.md` was updated and `npm run test:new-project` plus `npm run check` passed. No nested instructions were needed.

### Goal

Avoid unnecessary nested agent instructions.

### Test

Give a fresh coding agent:

```text
AGENTS.md
V3_SPEC.md
TODO.md
```

and a bounded implementation task.

### Acceptance

Agent can correctly identify:

* architecture rules
* current task
* forbidden scope
* verification requirements

without nested instructions.

---

## [x] V3-091 — Add agent-oriented command examples

### Goal

Document deterministic Nara inspection for agents.

### Examples

```bash
nara doctor --json
nara inspect billing --json
nara context billing --json
nara impact billing --json
```

### Acceptance

No specific AI vendor is required.

---

## [x] V3-092 — Evaluate agent skill integration

### Goal

Determine whether a small Nara skill materially improves agent behavior.

### Rule

Do not add MCP or a large agent framework merely for marketing.

### Acceptance

Document either:

```text
ADOPT
```

with demonstrated benefit,

or:

```text
REJECT FOR V3.0
```

with reason.

---

## [x] V3-093 — Evaluate LLM Wiki need

### Goal

Determine whether project knowledge has grown beyond what targeted docs can manage comfortably.

### Evaluate

* repeated rediscovery between sessions
* decisions spread across many files
* architecture knowledge difficult to navigate
* growing session history with useful unresolved context

### If needed

Initialize a lightweight structure:

```text
wiki/
  index.md
  overview.md
  architecture/
  decisions/
  lessons/
  features/
```

### If not needed

Do not create it.

### Acceptance

Record decision in:

```text
docs/v3/llm-wiki-decision.md
```

Do not make the wiki canonical over `V3_SPEC.md`.

---

# M11 — v2 Capability Migration

## [x] V3-100 — Map remaining v2 capabilities to v3 Features

### Goal

Create a migration matrix from the inventory.

### Output

Update:

```text
docs/v3/v2-inventory.md
```

with target Feature ownership.

---

## [x] V3-101 — Migrate required business capabilities

### Goal

Reach functional parity for capabilities required for Nara v3 release.

### Process per capability

```text
identify
reimplement/adapt
test
verify
remove obsolete v2 implementation
doctor
```

### Acceptance

No required capability exists only in obsolete v2 architecture.

---

## [x] V3-102 — Remove obsolete v2 architecture

### Goal

Delete dead implementation after parity exists.

### Acceptance

* no duplicate production implementation remains
* imports reference v3 architecture
* tests pass
* doctor passes

### Do not

Delete historical documentation that explains important lessons.

---

# M12 — Hardening

## [x] V3-110 — Fresh install test
> Verified 2026-09-03 through the existing `tests/integration/new-project.test.ts`: one clean temporary project was created by the real `nara new` path, dependencies installed, server and Vue typechecks plus tests and `npm run check` passed, the repository CLI ran `doctor` against the generated project (`exitCode 0`, `Architecture looks healthy.`, no stderr), then the production build, Node startup, HTTP 200 `/health` check, shutdown, and temporary-directory cleanup passed with no manual fix.

### Goal

Validate the real first-run experience.

### From clean temporary directory

```text
create
install
run
typecheck
test
doctor
```

### Acceptance

No undocumented manual fix is needed.

---

## [x] V3-111 — Linux deployment test
> Verified 2026-09-04: clean isolated `npm ci` + `npm run build` + `npm start` serves `GET /health` 200, `/ready` 200, `/api/auth/me` 401; manifest/lockfile/source scans show no `ultimate-express`/`uWebSockets.js` dependency, import, or native binary (old `linux-deployment.test.ts` 7/7); running production process maps no uWS binary (`/proc/<pid>/maps`); generated starter template depends only on `hono` + `@hono/node-server`. Local run on glibc 2.39 (Ubuntu 24.04-based); pinned `ubuntu-22.04` production-startup CI job (`.github/workflows/ci.yml` `compat`) as the deterministic glibc 2.35 baseline — CI execution itself not observed from here.
> Hardened pre-RC: portable assertions moved to `tests/integration/http-stack-compat.test.ts` (`npm run test:http-stack-compat`, runs everywhere); `tests/integration/linux-deployment.test.ts` (`npm run test:linux-deployment`) explicitly requires Linux (fails fast with a clear diagnostic on non-Linux so a macOS/Windows run can never read as Ubuntu validation), always rebuilds from source before starting production, and proves `/health` 200, `/ready` 200, `/api/auth/me` 401 plus no uWS mapping in `/proc/<pid>/maps`. Contract is the narrow Hono HTTP path (other native deps out of scope). Pinned `ubuntu-22.04` CI compat job now also runs the portable audit before the production startup smoke.
### Goal

Verify the problem that affected the old uWS path is gone.

### Target

A normal supported Linux environment such as Ubuntu 22.04 or equivalent compatibility baseline.

### Acceptance

* application starts
* no `GLIBC_2.38` requirement from Nara HTTP layer
* no uWebSockets.js binary is loaded
* health endpoint responds

---

## [x] V3-112 — Production build test
> Verified 2026-09-04 from an isolated clean worktree (`npm ci`, `npm run build`, `npm start` with production env): SPA shell 200, `/health` 200, `/ready` 200, `/api/auth/me` 401 `UNAUTHORIZED`, unknown API 404 (never SPA); missing `APP_URL`, invalid `MAX_JSON_BODY_BYTES=-1`, and missing `build/client/index.html` each exit non-zero naming the cause; `build/server.js` runs built output only (no tsx/Vite dev). `tests/integration/production-serving.test.ts` 7/7 and `tests/integration/new-project.test.ts` 1/1 re-run green, so generated-project production behavior is covered without a second suite.

### Acceptance

Production build:

* succeeds from clean checkout
* starts successfully
* serves expected API
* reports configuration errors clearly

---

## [x] V3-113 — Architecture fixture suite

### Create fixtures for

```text
valid-small
valid-multi-feature
invalid-internal-import
invalid-cycle
invalid-server-client-leak
invalid-feature-shape
```

### Acceptance

All architecture rules have regression coverage.

---

## [x] V3-114 — CLI failure-path audit

### Test

* missing project
* malformed config
* invalid feature
* duplicate feature
* invalid command
* unwritable target
* architecture violation

### Acceptance

Failures are readable and intentional.

---

## [x] V3-115 — Performance sanity check
> Verified 2026-09-04: `npm run perf:sanity` (`scripts/perf-sanity.mjs`) records startup median ~225ms, `GET /health` median ~3.2ms p95 ~4.3ms, `/api/auth/me` median ~3.6ms, `nara doctor` median ~1.7s (ts-node startup dominated), feature discovery ~0.3ms, dependency discovery ~33ms; no practical regression, no optimization made. Baseline recorded in `docs/v3/performance-sanity.md`. The command stays out of `npm test` and fails only on catastrophic tripwires.

### Goal

Detect actual regressions, not win benchmark contests.

### Measure

* startup
* normal HTTP baseline
* `nara doctor`
* feature discovery
* dependency discovery

### Rule

Do not introduce native infrastructure unless a measured practical problem exists.

---

# M13 — Documentation

## [x] V3-120 — Rewrite README around v3 thesis

### README opening must communicate

```text
Nara
Architecture-aware TypeScript application kit.

Build by feature, not by layer.
```

### Demonstrate

```bash
nara make feature billing
nara doctor
```

before long feature lists.

### Acceptance

A developer can understand Nara's differentiation within the first screen/minute.

---

## [x] V3-121 — Document Feature architecture

### Include

* rationale
* canonical structure
* public interface
* dependencies
* shared code
* server/web relationship
* examples
* anti-patterns

---

## [x] V3-122 — Document CLI

Cover:

```text
new
make feature
add
doctor
inspect
context
impact
```

Include human and JSON examples where applicable.

---

## [x] V3-123 — Write Nara v2 → v3 migration guide

### Be explicit

Nara v3 is a new architecture.

No automatic source migration is promised.

### Explain mappings such as

```text
v2 technical layers
    ↓
v3 Feature ownership
```

Document HTTP engine replacement and removed compatibility workarounds.

---

## [x] V3-124 — Write architecture philosophy

Explain:

```text
Compose
Understand
Protect
```

and:

> interesting architecture on boring technology

Also explain what Nara deliberately does not build.

---

# M14 — Release Validation

## [x] V3-130 — Run full validation
> Verified 2026-09-04 via old `validate:release` composition (`check` + `test:production-serving` + `test:linux-deployment` + `test:new-project`): lint PASS, frontend typecheck PASS, unit suite 203/203 PASS, `nara doctor` healthy, production-serving 7/7, linux-deployment 7/7, new-project 1/1; official-feature integration 1/1 run separately; clean-source revalidation (fresh worktree + working tree overlaid, `npm ci` + `npm run build` + linux-deployment) PASS.
> Composition hardened pre-RC: `validate:release` is now portable-only (`check` + `production-serving` + `production-startup` + `http-stack-compat` + `new-project` + `official-feature`) so non-Linux runs never claim Linux evidence; Linux runtime is `validate:linux` (= `test:linux-deployment`, fails fast off-Linux). Revalidation of the new composition runs in this batch's final verification.

Must pass:

```text
lint
typecheck
tests
nara doctor
production build
fresh install test
```

---

## [x] V3-131 — Dependency audit

### Verify

* no accidental Ultimate Express dependency
* no accidental uWebSockets.js dependency
* no unused rewrite dependencies
* no dependency added solely for speculative future work

---

## [x] V3-132 — Architecture audit

Ask of every major subsystem:

> Does this strengthen Compose, Understand, or Protect?

Remove unnecessary v3 rewrite infrastructure that does not.

---

## [ ] V3-133 — Agent cold-start test
> Reopened during the v3 consistency audit: no fresh coding-agent execution record is present.

### Scenario

Use a fresh coding agent with no previous Nara conversation.

Give it:

```text
AGENTS.md
V3_SPEC.md
TODO.md
```

and ask it to make a small real change.

### Acceptance

The agent:

* finds the correct Feature
* respects public boundaries
* avoids unrelated refactoring
* runs relevant verification
* does not redesign architecture

If it fails, improve architecture/docs before adding more prompt files.

---

## [ ] V3-134 — Human cold-start test
> Reopened during the v3 consistency audit: no human cold-start validation record is present.

### Scenario

A developer unfamiliar with Nara should:

1. read README
2. create project
3. create a feature
4. intentionally violate a boundary
5. run doctor
6. understand the diagnostic

### Acceptance

Nara's value proposition becomes obvious through usage.

---

## [ ] V3-135 — Release candidate
> Reopened during the v3 consistency audit: no release-candidate artifact was created and blocking gates remain open.

Create the v3 release candidate only after all blocking v3 TODO items pass.

Do not merge to `main` yet unless explicitly instructed.

---

## [ ] V3-136 — Final v3.0.0 release
> Reopened during the v3 consistency audit: merge to `main` and the `v3.0.0` tag were not performed, and blocking gates remain open.

Before release:

* verify release notes
* verify migration guide
* verify fresh install
* verify deployment
* verify docs
* verify architecture fixtures
* verify agent cold-start
* verify no v2 compatibility baggage accidentally remains

Then prepare:

```text
v3 → main
```

and tag:

```text
v3.0.0
```

only when explicitly instructed.

---

# Deferred Beyond v3.0

These are intentionally not required for the initial v3 rewrite unless explicitly promoted.

```text
automatic upstream module merging
AST-based code merging
custom compiler
custom language server
custom package manager
custom RPC
custom ORM
native Go CLI
native Rust CLI
AI-generated architecture
mandatory MCP server
large plugin platform
universal multi-framework support
full semantic impact analysis
```

Do not implement these opportunistically.

---

# Final Completion Rule

Nara v3 is not complete merely because all old features work.

It is complete when the following loop feels coherent:

```text
nara new
    ↓
nara make feature
    ↓
build capability
    ↓
nara doctor
    ↓
nara inspect/context/impact
    ↓
application grows
    ↓
architecture remains understandable
```

That experience is the product.
