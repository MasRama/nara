# Nara v3 Specification

Status: Draft implementation specification
Target release: `v3.0.0`
Development branch: `v3`
Previous stable line: Nara v2

---

# 1. Summary

Nara v3 is a full rewrite of Nara around a new product thesis:

> **Nara is an architecture-aware TypeScript application kit.**

Nara helps developers build full-stack applications around business features rather than technical layers, understand how those features relate to each other, and protect architectural boundaries as the application grows.

Nara is designed to remain understandable to both humans and coding agents.

---

# 2. Product Thesis

Traditional starter kits provide value primarily at project creation time.

```text
create project
     ↓
copy boilerplate
     ↓
starter disappears
```

Nara v3 should continue providing value throughout the application's lifecycle.

```text
create
   ↓
compose
   ↓
understand
   ↓
protect
   ↓
grow
```

Nara v3 is not defined by how many features are preinstalled.

It is defined by a predictable application model that tooling can understand.

---

# 3. Core Promise

> Build applications that stay understandable as they grow.

The primary architectural idea is:

> **Build by feature, not by layer.**

A business capability should be locally understandable.

For example:

```text
features/
  billing/
  users/
  projects/
  auth/
```

instead of spreading each capability primarily across:

```text
controllers/
services/
repositories/
validators/
routes/
```

---

# 4. Product Pillars

Nara v3 has three product pillars.

## 4.1 Compose

Build applications from explicit business features.

Primary concepts:

```text
nara make feature
nara add
feature conventions
public feature interfaces
```

---

## 4.2 Understand

Allow humans and tools to inspect the application's architecture.

Primary concepts:

```text
nara inspect
nara context
nara impact
dependency discovery
```

The output must primarily come from deterministic analysis, not LLM inference.

---

## 4.3 Protect

Prevent architectural drift.

Primary concept:

```text
nara doctor
```

Nara should detect invalid boundaries and structural problems before they become long-term architecture debt.

---

# 5. Nara Is Not

Nara v3 is not intended to become:

* a new JavaScript runtime
* a custom HTTP framework
* a custom frontend framework
* a custom ORM
* a custom authentication framework
* a custom dependency injection framework
* a custom RPC framework
* a custom compiler
* a custom programming language
* a generic build tool
* a generic package manager
* a general-purpose monorepo tool
* a multi-stack configurator
* an AI wrapper around an ordinary starter kit

Nara should compose existing ecosystem tools rather than recreate them.

---

# 6. Technology Philosophy

Nara follows this rule:

> **Interesting architecture on boring technology.**

Technology decisions should prioritize:

1. portability
2. predictability
3. maintainability
4. TypeScript ergonomics
5. ecosystem maturity
6. sufficient performance

Do not select infrastructure primarily because it wins synthetic benchmarks.

---

# 7. Locked Technology Decisions

These decisions are locked for the initial v3 architecture.

## Language

```text
TypeScript
```

Both Nara application code and the Nara CLI remain TypeScript.

Nara v3 does not rewrite the application backend in Go.

---

## Default Backend Runtime

```text
Node.js
```

Node.js is the reference/default server runtime.

Portable code is preferred when practical, but Nara does not need to promise universal runtime compatibility.

---

## HTTP Framework

```text
Hono
```

Reference server:

```text
Hono
+
@hono/node-server
+
node:http
```

Nara must not wrap Hono behind a custom HTTP framework abstraction.

Application code may import Hono directly.

---

## Native HTTP Dependencies

Native HTTP engines are not part of the default stack.

Specifically, do not reintroduce:

```text
Ultimate Express
uWebSockets.js
```

as the default Nara HTTP layer.

Reason:

Nara v2 encountered deployment compatibility problems caused by native uWebSockets.js binaries and host glibc requirements.

Nara v3 prioritizes deployment portability over extreme synthetic HTTP throughput.

## Frontend

The initial v3 browser stack is locked to:

```text
Vue 3 + Vite + TypeScript
```

Vue is the sole supported frontend framework. Nara is intentionally opinionated here; it does not offer multiple frontend choices or a multi-framework abstraction.

Do not keep or reintroduce the v2 Svelte implementation. React, Svelte, and Nuxt are not part of the initial v3 stack. SSR is not part of the initial v3 stack and requires a later explicit specification.

Feature-specific Vue pages, components, and composables belong under the owning Feature's `web/` directory.

Application-wide Vue composition belongs under `src/app/`. The Vite entrypoint should remain thin and mount the app-layer composition.

---

## Nara CLI

```text
TypeScript
```

Do not introduce Go/Rust solely to make the CLI native.

Native tooling may be reconsidered only after measured evidence demonstrates a real performance problem.

---

# 8. Preserved Technology Decisions

The v3 rewrite is an architectural rewrite, not a mandate to replace every dependency.

Until an explicit v3 task says otherwise, preserve the currently proven Nara choices for:

* frontend styling
* database
* ORM/query system
* authentication
* test runner
* package manager
* formatting
* linting
* application logging

The frontend framework is not part of this preserved set. Vue 3 + Vite + TypeScript is locked above, and the v3 frontend migration moves away from the v2 Svelte implementation.

When migrating preserved areas, prefer adapting them to the v3 feature model rather than replacing them.

---

# 9. Primary Primitive: Feature

The fundamental organizational unit of Nara v3 is a **Feature**.

A Feature represents one business capability.

Examples:

```text
auth
users
billing
projects
notifications
teams
```

A Feature should contain the code required to understand that capability across relevant application layers.

Reference shape:

```text
src/
  features/
    billing/
      index.ts
      contract.ts

      server/
        routes.ts
        service.ts
        repository.ts

      web/
        pages/          Vue pages (`*.vue`)
        components/     Vue components (`*.vue`)
        composables/    TypeScript composables (`*.ts`)

      tests/
```

Not every feature must contain every directory.

Empty structural directories should not be created unless needed.

Feature-specific Vue pages, components, and composables belong under the owning Feature's `web/` directory. They must use the appropriate public boundary when consuming another capability.

Application-wide Vue composition belongs under `src/app/`. It may compose Features but must not absorb business logic owned by a Feature.

---

# 10. Feature Public Boundaries

Every Feature has a general/server-facing public interface:

```text
features/<feature>/index.ts
```

Other Features and application server composition use intentional exports from this root boundary.

A Feature with browser surfaces may additionally expose an explicit browser-safe public interface:

```text
features/<feature>/web/index.ts
```

Application browser composition under `src/app/` may import Feature browser surfaces from this `web/index.ts` boundary. Another Feature's browser code may use it only for a legitimate browser-safe dependency. This optional browser boundary is separate from the general/server boundary; do not collapse them into one universal barrel.

Examples:

```ts
import { authRoutes } from "@/features/auth"
import { LoginPage } from "@/features/auth/web"
```

Feature internals remain private. Application composition and other Features may not access `web/pages/*`, `web/components/*`, `web/client`, `server/*`, or other implementation paths directly:

```ts
import LoginPage from "@/features/auth/web/pages/LoginPage.vue"
```

This separation is a core invariant of Nara v3. Do not create additional public entrypoints unless a later specification demonstrates a need.

---

# 11. Feature Internals

Inside a feature, implementation may use appropriate internal layering.

For example:

```text
billing/
  server/
    routes.ts
    service.ts
    repository.ts
```

Nara does not ban controllers/services/repositories as concepts.

Nara bans making those technical layers the primary organization of the whole application.

The top-level mental model remains the business feature.

---

# 12. Shared Code

Code that genuinely belongs to no single business feature may live under:

```text
src/shared/
```

Shared code should remain intentionally small.

Examples:

```text
shared/
  config/
  database/
  errors/
  logging/
```

Do not move code into `shared/` merely because two features currently use it.

Prefer explicit feature ownership when a business concept has a natural owner.

`shared/` must not become a dumping ground.

---

# 13. Application Layer

Application-wide composition belongs under:

```text
src/app/
```

Reference responsibilities:

```text
app/
  server.ts
  config.ts
```

The app layer composes features.

It should not contain business logic that belongs inside a feature.

For the browser application, the app layer owns application-wide Vue composition and bootstrap-level concerns. Feature-specific Vue pages, components, and composables remain in Feature `web/` directories.

The initial v3 frontend is a direct Vue + Vite application. Nara does not add a custom frontend abstraction, Nuxt, or SSR; SSR requires a later explicit specification.

Example server composition:

```ts
const app = new Hono()

app.route("/api/auth", authRoutes)
app.route("/api/users", userRoutes)
app.route("/api/billing", billingRoutes)
```

---

# 14. HTTP Composition

Each feature may expose its own Hono sub-application/routes.

Reference:

```text
features/
  billing/
    server/
      routes.ts
```

The central application composes feature routes.

Avoid one giant routes file containing the whole application's business routing.

---

# 15. Full-Stack Contracts

Nara should encourage explicit contracts between server and client.

The initial implementation should prefer existing TypeScript ecosystem capabilities rather than creating a custom Nara RPC system.

Hono's typed route/RPC capabilities may be used where appropriate.

Contract ownership should remain feature-scoped.

Conceptually:

```text
billing
  contract
  server
  web
```

Avoid one gigantic application-wide RPC type if it materially harms TypeScript performance or feature isolation.

Prefer feature-scoped contracts and clients.

---

# 16. No Custom DSL

Nara should not require users to describe their application twice.

Avoid architecture definitions such as:

```ts
defineFeature({
  name: "billing",
  dependencies: ["users"],
  routes: [...]
})
```

when the same information can be inferred from:

* directory structure
* public exports
* imports
* schemas
* route composition

Convention and static inspection should be preferred over duplicated metadata.

---

# 17. Architecture Discovery

Nara should progressively understand the project using deterministic information.

Potential sources:

```text
filesystem
TypeScript imports
feature index exports
route composition
contracts
configuration
```

The architecture model should be derived where practical.

Do not make developers manually maintain an architecture graph.

---

# 18. `nara new`

Purpose:

Create a new Nara application.

Initial behavior should:

* create the v3 project structure
* install/use the locked Nara stack
* create minimal working application composition
* include example or essential features only
* avoid shipping a giant SaaS application by default
* result in a runnable project

Do not turn `nara new` into a large interactive stack configurator.

Nara is opinionated.

---

# 19. `nara make feature`

Purpose:

Create a new Nara feature using the canonical feature structure.

Example:

```bash
nara make feature billing
```

Expected conceptual result:

```text
src/features/billing/
  index.ts
  contract.ts
  server/
  web/
  tests/
```

Only create files/directories that serve the canonical feature skeleton.

The generator must not generate large amounts of placeholder boilerplate.

---

# 20. `nara doctor`

`nara doctor` is a core differentiator of Nara v3.

Its purpose is to protect Nara's architecture.

Initial rules should include at minimum:

### Feature boundary violation

A feature may not import another feature's internals.

### Circular feature dependency

Example:

```text
billing → users → billing
```

should be detected.

### Invalid feature shape

Detect structural violations required by the Nara feature model.

### Server/client boundary leak

Where the application structure makes this statically identifiable, prevent clearly server-only modules from leaking into frontend code.

### Public interface validation

General or server-facing Feature-to-Feature access should flow through the target Feature root public boundary. Browser composition and legitimate browser-safe Feature dependencies may flow through the target `web/index.ts` boundary. Neither may reach arbitrary Feature internals.

Diagnostics must explain how to fix problems.

---

# 21. `nara inspect`

Purpose:

Provide deterministic information about one feature.

Example:

```bash
nara inspect billing
```

Potential output:

```text
Feature: billing

Public exports:
- createCheckout
- getSubscription

Dependencies:
- auth
- users

Server:
- server/routes.ts
- server/service.ts

Web:
- web/pages/BillingPage.vue

Contracts:
- CreateCheckout
- Subscription
```

Exact output format may evolve.

The command must not require an LLM.

---

# 22. `nara context`

Purpose:

Produce compact, feature-scoped context useful to both humans and coding agents.

Example:

```bash
nara context billing
```

It should prefer structured facts over prose generated by AI.

Possible information:

* feature location
* public interface
* dependencies
* dependents
* contracts
* server entry points
* frontend entry points
* tests
* relevant configuration

Machine-readable output should eventually be supported.

Example:

```bash
nara context billing --json
```

---

# 23. `nara impact`

Purpose:

Answer:

> What parts of the known architecture may depend on this feature?

Example:

```bash
nara impact users
```

Initial implementation may operate at feature dependency level.

Do not attempt whole-program semantic analysis in v3.0 unless it is clearly necessary.

A simple reliable feature graph is preferable to an ambitious unreliable code intelligence engine.

---

# 24. `nara add`

Purpose:

Install a reusable Nara feature/capability into the current application.

The long-term direction is open-code composition:

```bash
nara add auth
```

The resulting source code belongs to the application and may be edited.

Nara should not hide installed business logic inside an opaque runtime.

The initial v3 implementation may begin with official modules/features.

Do not build automatic upstream/local three-way merging for v3.0.

---

# 25. Module Distribution

Reusable Nara capabilities may eventually include:

```text
source code
contracts
tests
configuration
migrations
frontend code
server code
documentation
```

Nara may develop a registry/distribution layer.

However:

* registry complexity must remain subordinate to the Feature model
* v3.0 does not require a package-manager replacement
* installed code remains inspectable
* users own installed source code

---

# 26. Upgrade Strategy

Nara v3 does not need to automatically merge upstream module updates into locally modified source code.

Do not build:

* custom merge algorithms
* source-code CRDTs
* AST merge engines
* automatic conflict resolution

for v3.0.

Upgrade intelligence can be revisited after demonstrated user demand.

---

# 27. Agent Ergonomics

Nara should naturally work well with coding agents because its architecture is predictable.

The first-order solution is not more prompt files.

The first-order solution is:

```text
predictable features
explicit boundaries
deterministic tooling
small local context
```

Agents should be able to discover a feature without scanning unrelated application code.

---

# 28. AI Independence

Core Nara functionality must not require:

* OpenAI
* Anthropic
* Gemini
* local LLM
* API keys
* embeddings
* vector database

AI-specific adapters may exist later.

The architecture model remains deterministic.

---

# 29. Machine-Readable Interface

Commands useful to agents should eventually expose structured output.

Preferred direction:

```bash
nara inspect billing --json
nara context billing --json
nara doctor --json
nara impact billing --json
```

Human output remains first-class.

Do not create a separate agent-only implementation if both modes can share the same underlying analysis.

---

# 30. LLM Wiki

LLM Wiki is not required for Nara v3 to function.

If introduced during development, use it for persistent repository knowledge such as:

```text
wiki/
  index.md
  overview.md

  architecture/
    feature-model.md
    boundaries.md

  decisions/
    http-engine.md
    typescript-vs-go.md

  lessons/
    v2-uws-glibc.md

  features/
    doctor.md
    context.md
```

The wiki is derived contextual knowledge.

Canonical product decisions remain in this specification.

Avoid nested `AGENTS.md` trees as a replacement for repository knowledge.

---

# 31. Nara v2 Lessons

Nara v3 should retain lessons learned from v2.

## Native HTTP Engine

v2 used Ultimate Express / uWebSockets.js.

A production environment running Ubuntu 22.04 with glibc 2.35 encountered compatibility problems when newer native binaries expected a newer glibc.

v3 response:

```text
Hono
+
@hono/node-server
+
node:http
```

Portability is preferred over extreme HTTP microbenchmark performance.

---

## AI Documentation

v2 experimented with AI-oriented repository context including agent documentation and code mapping.

v3 should avoid requiring large manually maintained repository maps.

Prefer architecture that can be discovered from code and convention.

---

# 32. Default Repository Shape

Reference target:

```text
src/
├── app/
│   ├── server.ts
│   └── config.ts
│
├── features/
│   ├── auth/
│   │   ├── index.ts
│   │   ├── contract.ts
│   │   ├── server/
│   │   ├── web/
│   │   └── tests/
│   │
│   └── users/
│       └── ...
│
└── shared/
    ├── config/
    ├── database/
    ├── errors/
    └── logging/
```

This is a reference, not permission to create empty folders without need.

---

# 33. Definition of v3.0

Nara v3.0 is ready when all of the following are true.

## Architecture

* feature-first application structure is implemented
* public feature boundaries are defined
* representative real features use the architecture
* cross-feature dependency rules are documented and testable
* full-stack contracts have a clear canonical pattern

## Runtime

* application runs using Hono on Node.js
* Ultimate Express is removed from the v3 default path
* uWebSockets.js is removed from the v3 default path
* normal deployment does not depend on a special native HTTP binary

## CLI

Working implementations exist for:

```text
nara new
nara make feature
nara doctor
nara inspect
nara context
nara impact
nara add
```

## Architecture Protection

`nara doctor` detects at least:

* direct cross-feature internal imports
* circular feature dependencies
* required structural violations
* supported server/client boundary violations

## Agent Ergonomics

* important CLI inspection commands support deterministic output
* machine-readable output exists where defined
* an agent can identify the architecture of one feature without scanning the entire repository
* root `AGENTS.md` provides sufficient operational rules

## Quality

* automated tests cover core architecture tooling
* fixtures cover valid and invalid projects
* documentation describes the Feature model clearly
* example application demonstrates real feature composition
* v3 contains no known dependency on the previous uWS workaround

## Migration

* v2 → v3 conceptual migration is documented
* breaking changes are explicit
* no automatic source migration is required

---

# 34. Success Test

A new developer should be able to see:

```bash
nara make feature billing
```

followed by:

```bash
nara doctor
```

and understand within minutes why Nara is different from a normal starter kit.

A coding agent should be able to enter:

```text
src/features/billing
```

and understand the capability without exploring unrelated parts of the repository.

If Nara v3 cannot demonstrate those two properties clearly, the rewrite has not yet achieved its core product goal.

---

# 35. Design Filter

Before adding anything to v3.0, ask:

> Does this materially strengthen Compose, Understand, or Protect?

If not, it should probably not be part of v3.0.

Before creating new infrastructure, ask:

> Can an existing ecosystem tool already solve this adequately?

If yes, use the ecosystem tool.

Before adding architecture metadata, ask:

> Can Nara reliably infer this from the code?

If yes, infer it.

---

# 36. Final Principle

Nara v3 should not stand out because it contains more technology.

It should stand out because applications built with Nara remain structurally obvious as they grow.

> **Architecture first. Tooling second. Magic last.**
