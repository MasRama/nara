# AGENTS.md

> Operating contract for AI coding agents working on Nara v3.
>
> This file defines **how to work**.
> `V3_SPEC.md` defines **what Nara v3 is**.
> `TODO.md` defines **what to implement next**.

---

## 1. Authority

Use this order of authority:

1. Direct user instruction in the current session
2. `V3_SPEC.md`
3. The active task in `TODO.md`
4. Existing v3 tests
5. Existing v3 implementation
6. Existing v2 implementation as historical reference only

If two sources conflict, follow the higher authority.

Do not reinterpret product or architecture decisions that are already defined in `V3_SPEC.md`.

---

## 2. Branch

Nara v3 is a full rewrite developed on the `v3` branch.

Rules:

* Treat `main` as the stable Nara v2 line until v3 is ready.
* Do not merge `v3` into `main` unless explicitly instructed.
* Do not modify `main`.
* Do not preserve v2 compatibility unless a task explicitly requires it.
* Do not add compatibility wrappers merely to keep old APIs alive.
* Reuse lessons and proven behavior from v2, not necessarily its implementation.

Nara v3 is allowed to break Nara v2 APIs.

---

## 3. Required Reading

At the beginning of a new coding session:

1. Read this file.
2. Read `V3_SPEC.md`.
3. Read the current incomplete task in `TODO.md`.
4. Inspect only the code relevant to that task.
5. Execute the task.

Do not recursively read the entire repository unless necessary.

Do not load every documentation file into context by default.

Prefer targeted context.

---

## 4. Execution Model

Work on **one TODO task at a time**.

For every task:

1. Read the task and its acceptance criteria.
2. Inspect the minimum relevant code.
3. Implement the smallest correct solution.
4. Add or update tests when required.
5. Run the required verification.
6. Fix failures caused by the task.
7. Mark the task complete only when every acceptance criterion passes.
8. Continue to the next unblocked task.

Do not implement future TODO items opportunistically.

Do not turn one task into a broad cleanup.

---

## 5. Architecture Decisions Are Closed

The coding agent is an implementer, not the product architect.

Do not independently replace or reconsider:

* TypeScript
* Vue 3 + Vite + TypeScript as the only supported frontend stack
* Node.js as the default server runtime
* Hono as the HTTP framework
* feature-first architecture
* feature public boundaries
* the architecture-aware direction of Nara
* the TypeScript implementation of the Nara CLI
* the decision to avoid a custom Nara runtime
* the decision to avoid native HTTP dependencies by default

Do not propose another framework during implementation unless explicitly asked.

Do not replace Hono with:

* Express
* Ultimate Express
* Fastify
* NestJS
* another HTTP framework

Do not introduce Go or Rust into the v3 implementation unless explicitly requested.

---

## 6. Preserve Undecided Technology

Some technology choices are intentionally not part of the initial v3 rewrite decision.

Unless a TODO task explicitly changes them, preserve the currently proven Nara choices for:

* styling system
* database
* ORM/query layer
* authentication provider/library
* test runner
* package manager
* formatter/linter

The frontend framework is not undecided. `V3_SPEC.md` locks Vue 3 + Vite + TypeScript as Nara's sole supported frontend stack.
Do not replace a dependency merely because another option appears newer or more popular.

A full rewrite of Nara architecture does not mean every dependency must be replaced.

---

## 7. No Overengineering

Prefer the simplest implementation that satisfies the current specification.

Before creating a new abstraction, ask:

> Is this abstraction required by the current specification or acceptance criteria?

If not, do not create it.

Avoid:

* speculative abstractions
* generic factories used once
* wrapper classes around libraries without a real boundary need
* premature plugin systems
* premature caching
* premature performance optimization
* custom dependency injection containers
* custom HTTP abstractions
* custom RPC frameworks
* custom ORMs
* custom validation frameworks
* custom compilers
* custom DSLs
* custom language servers
* custom package managers

Nara should provide architectural value without recreating the ecosystem.

---

## 8. Framework Transparency

Nara is not a runtime abstraction layer.

Application code should use ecosystem libraries directly where appropriate.

Good:

```ts
import { Hono } from "hono"
```

Avoid:

```ts
import { NaraServer } from "nara"
```

Do not create:

* `NaraRequest`
* `NaraResponse`
* `NaraRouter`
* `NaraServer`
* `NaraORM`

unless a future specification explicitly introduces them.

Nara should organize and understand application architecture, not hide the underlying stack.

Use Vue directly for frontend composition. Do not create a Nara frontend framework or a multi-framework abstraction.

---

## 9. Feature-First Rule

The primary architectural unit in Nara v3 is a **feature**.

A business capability belongs together.

Prefer:

```text
features/
  billing/
    contract.ts
    index.ts
    server/
    web/
    tests/
```

Frontend rules:

* Feature-specific Vue pages, components, and composables live under the owning Feature's `web/`.
* Application-wide Vue composition belongs under the app layer (`src/app/`); keep the Vite entry thin.
* Never keep or reintroduce Svelte. React, Nuxt, SSR tooling, and multi-framework abstractions are out of scope unless a later specification explicitly changes this decision.

Avoid organizing business code primarily as:

```text
controllers/
services/
repositories/
validators/
models/
```

Cross-feature communication and application composition must use an explicit public interface.

For every feature:

* `src/features/<feature>/index.ts` is the general/server-facing public boundary.
* If the feature has browser surfaces, `src/features/<feature>/web/index.ts` is its optional browser-safe public boundary.

Application-wide Vue composition under `src/app/` may import browser surfaces only from the Feature's `web/index.ts` boundary:

```ts
import { LoginPage } from "@/features/auth/web"
```

Other Features' browser code may use another Feature's browser-safe boundary when that dependency is legitimate and browser-safe. General or server-facing consumers use the Feature's root boundary:

```ts
import { getUser } from "@/features/users"
```

Feature internals remain private. Application composition and other Features must not reach into `web/pages/*`, `web/components/*`, `web/client`, `server/*`, or other implementation paths. Do not export server-only runtime symbols through `web/index.ts`.

Forbidden examples:

```ts
import LoginPage from "@/features/auth/web/pages/LoginPage.vue"
import { createAuthClient } from "@/features/auth/web/client"
import { db } from "@/features/users/server/repository"
```

---

## 10. Keep Architecture Inferable

Prefer conventions that Nara can understand from:

* filesystem structure
* TypeScript imports
* public exports
* existing schemas
* existing configuration

Do not introduce duplicated architecture metadata when the information can be reliably inferred.

Avoid creating manifests that humans must manually keep synchronized with code.

Generated metadata is acceptable if it has one authoritative source and is reproducible.

---

## 11. Dependencies

Before installing a dependency:

1. Verify the current task actually requires it.
2. Check whether the repository already contains an appropriate solution.
3. Prefer stable, focused ecosystem packages.
4. Avoid native dependencies unless they provide clearly necessary value.
5. Avoid dependencies that substantially reduce deployment portability.

Never reintroduce `uWebSockets.js` or Ultimate Express as the default Nara HTTP engine.

The frontend dependency set is opinionated: Vue 3 + Vite + TypeScript with `@vitejs/plugin-vue`. Do not add React, Svelte, Nuxt, or SSR dependencies unless a later specification explicitly requires them.

Nara v2 experienced native binary / glibc compatibility problems through this dependency chain:

```text
Ultimate Express
    ↓
uWebSockets.js
    ↓
native binary
    ↓
host glibc compatibility
```

Nara v3 deliberately avoids this deployment coupling.

---

## 12. Performance

Do not optimize synthetic framework benchmarks.

Optimize only after evidence of a real bottleneck.

Priority order:

1. correctness
2. architecture clarity
3. portability
4. maintainability
5. developer experience
6. measured performance
7. synthetic benchmark performance

Nara should choose simple technology that is already fast enough.

---

## 13. Testing

Every architectural rule implemented by Nara should be testable.

Prefer testing behavior over implementation details.

For CLI features, test:

* successful behavior
* invalid input
* expected diagnostics
* exit status where relevant
* deterministic output where practical

For architecture rules, create fixtures representing both:

* valid Nara projects
* intentionally invalid Nara projects

Never weaken tests simply to make implementation pass.

---

## 14. Diagnostics

Nara diagnostics are part of the product.

Errors must explain:

1. what is wrong
2. where it happened
3. why Nara considers it invalid
4. the expected direction to fix it

Prefer:

```text
billing imports an internal module from users

src/features/billing/server/checkout.ts
  → @/features/users/server/repository

Cross-feature internals cannot be imported directly.

Import from the users public interface instead:
  @/features/users
```

Avoid:

```text
ERR_NARA_BOUNDARY_004
```

unless a machine-readable error code is additionally useful.

Human-readable diagnostics come first.

---

## 15. CLI Principles

The v3 CLI is implemented in TypeScript.

CLI commands should be:

* predictable
* composable
* scriptable
* deterministic when possible
* useful without an AI model
* friendly to both humans and agents

Interactive prompts are allowed for human workflows, but core operations should also support non-interactive execution.

Prefer:

```bash
nara make feature billing
```

over flows that require many prompts.

Machine-readable output may be added where specified.

---

## 16. AI and Agent Features

Nara must remain fully useful without an LLM.

Do not add LLM calls to core architecture commands.

Commands such as:

```text
doctor
inspect
context
impact
```

should derive information deterministically from the repository whenever possible.

For bounded implementation work, prefer deterministic JSON facts before opening unrelated files:

```bash
nara doctor --json
nara inspect billing --json
nara context billing --json
nara impact billing --json
```

Use `nara context <feature> --json` to identify the feature boundary, public dependencies, dependents, contracts, and relevant server/web/test surfaces. Use `nara doctor --json` after edits; it is a repository check and does not require an AI provider.

AI integrations consume Nara's architecture knowledge.

AI does not define the architecture.

---

## 17. Documentation

Do not duplicate the same rule across many files.

Canonical responsibilities:

```text
AGENTS.md
  How agents work.

V3_SPEC.md
  What Nara v3 is.

TODO.md
  What gets implemented and in what order.
```

If additional documentation is created, link it from an index rather than expanding `AGENTS.md` indefinitely.

---

## 18. Nested AGENTS.md Policy

Do not create nested `AGENTS.md` files by default.

A nested `AGENTS.md` is justified only when a subtree has operational constraints that genuinely differ from the repository root.

Examples that may justify one in the future:

```text
packages/cli/
examples/
website/
```

but only when the root rules are insufficient.

Do not use nested agent files merely to document code.

Repository knowledge belongs in documentation or a wiki, not in a tree of agent instructions.

---

## 19. LLM Wiki Policy

An LLM Wiki may be introduced as a **derived knowledge layer**.

It is not authoritative over:

* `V3_SPEC.md`
* `TODO.md`
* tests
* source code

If a `wiki/` directory exists:

1. Read `wiki/index.md` first.
2. Load only pages relevant to the current task.
3. Do not recursively load the whole wiki.
4. Treat wiki content as contextual knowledge, not architecture authority.
5. If wiki content conflicts with `V3_SPEC.md`, follow `V3_SPEC.md`.
6. Update wiki content only when the workflow explicitly requires it.

Recommended future structure:

```text
wiki/
  index.md
  overview.md
  architecture/
  features/
  decisions/
  lessons/
```

Do not create the wiki merely because it may become useful later.

Introduce it when repository/session knowledge becomes difficult to navigate without it.

---

## 20. Git Hygiene

Keep changes scoped to the active TODO task.

Do not:

* mass-format unrelated files
* rename unrelated files
* refactor unrelated features
* modify generated lockfiles without dependency changes
* commit secrets
* force-push
* merge into `main`

Do not create commits unless the current workflow or user explicitly requests commits.

---

## 21. Completion Report

After completing a task, report concisely:

```text
Completed: <task ID and title>

Changed:
- ...
- ...

Verified:
- ...
- ...

Remaining:
- next TODO task
```

Do not write a long retrospective unless asked.

---

## 22. Core Principle

When uncertain between a clever solution and a boring solution that satisfies the specification:

**choose the boring solution.**

Nara's innovation belongs in its application model and architectural tooling, not unnecessary infrastructure.
