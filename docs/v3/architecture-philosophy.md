# Nara v3 Architecture Philosophy

Nara's product thesis is simple:

> Nara is an architecture-aware TypeScript application kit.
>
> Build applications that stay understandable as they grow.

The organizing rule is:

> Build by feature, not by layer.

Nara makes the architecture interesting and the technology boring. A business capability should be findable in one place, its relationships should be inspectable, and its boundaries should be enforceable without a custom runtime or an AI provider.

## Compose → Understand → Protect

A starter kit is useful once when it copies boilerplate. Nara should remain useful through the application's lifecycle:

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

The three product pillars are the loop after creation.

## Compose

Compose an application from explicit business Features.

A Feature owns a capability across the relevant application surfaces:

```text
src/features/billing/
├── contract.ts
├── index.ts
├── server/
├── web/       # optional
└── tests/
```

The Feature's `index.ts` is its public boundary. Application composition mounts the public route export, and other Features consume public operations or types. Internal repositories and services remain implementation details. Nara records the application integration only when the canonical composition roots statically prove the complete chain from framework composition to a Feature boundary: Hono import → Hono instance → `.route()`, or Vue Router factory import → static route record.

Composition is intentionally ordinary:

```ts
import { Hono } from 'hono';
import { userRoutes } from '@/features/users';

const app = new Hono();
app.route('/api/users', userRoutes);
```

`nara make feature` creates a minimal boundary. `nara add` installs inspectable official source. Neither command creates a hidden runtime registry or merges code into local internals.

Composition means assigning ownership, not collecting files. If a capability has a natural owner, it belongs in that Feature. If code is genuinely business-neutral infrastructure, it may live in `src/shared/`.

## Understand

Understand the architecture from the repository itself.

Nara's architecture engine derives bounded facts from ordinary conventions and TypeScript imports:

- which Features exist and whether their shape is valid
- which public Feature dependencies are visible
- which Features depend on a target
- which server, web, contract, and test surfaces belong to one Feature
- which Feature imports, server route mounts, and web route records are statically provable from `src/app/server.ts` and `src/app/router.ts` through their framework composition bindings

The CLI exposes these facts:

```bash
nara inspect billing
nara context billing
nara impact billing
```

Use JSON when another tool needs stable data:

```bash
nara inspect billing --json
nara context billing --json
nara impact billing --json
```

The output is intentionally bounded. It identifies where to work and what may be affected without dumping the entire repository or guessing at business meaning. `impact` reports graph relationships, not semantic product impact; people still review behavior and contracts.

Nara can describe not only what the architecture is, but how the architecture is changing:

```bash
nara diff --base main
nara diff --base main --json
```

`git diff` explains text changes; `nara diff` explains deterministic Feature-architecture changes (added/removed Features, boundary and contract deltas, dependency edges, surfaces, application integration imports and statically proven route changes, and new versus resolved diagnostics) with an affected set labeled structural dependency impact. It is Git-aware by design, needs no manifest or AI provider, and never claims semantic behavior impact or runtime reachability.

The progression is deliberate:

```text
doctor  -> protect current architecture
diff    -> understand architecture change
guard   -> protect architecture change
```

## Protect

Protect the boundaries before drift becomes debt, and protect changes before new debt enters unnoticed.

```bash
nara doctor
nara doctor --json
nara guard --base origin/main
nara guard --base origin/main --json
```

`doctor` checks the current structural rules:

- Feature entries have valid names and public `index.ts` files
- cross-Feature imports use public boundaries
- Feature dependencies do not form cycles
- `web/` code does not import server-only modules or runtime dependencies

Diagnostics are part of the product. Every issue explains:

1. what is wrong
2. where it happened
3. which Features or surfaces are related
4. why the relationship is invalid
5. the direction that fixes it

Human output comes first:

```text
Found 1 architecture issue.
- [CROSS_FEATURE_INTERNAL_IMPORT] ...
  file: src/features/billing/server/checkout.ts
  relationship: billing -> users
  reason: Features may communicate only through the target feature public index.
  fix: Import the public interface from "@/features/users" instead of a server internals path.
```

Machine-readable output preserves the same facts in a stable object. Valid and invalid repository fixtures keep these rules regression-tested.

`doctor` is absolute correctness: any diagnostic means the architecture is unhealthy. `guard` is the relative ratchet for teams carrying existing debt: it compares a Git baseline against the working tree (or a head ref), passes when no new diagnostic appears — even when baseline violations remain — and fails only on newly introduced violations, reporting resolved ones positively. Application integration changes are informational and do not fail `guard`; enforcement never invents policy beyond the existing structural rules. There is no baseline file and no configuration: the baseline is the Git ref.

## Interesting architecture on boring technology

Nara's differentiation is the application model and the tooling around it, not a novel runtime.

The initial v3 stack uses:

- TypeScript for application code and the CLI
- Node.js as the runtime
- Hono and `@hono/node-server` for HTTP
- SQLite through `better-sqlite3` for embedded persistence
- existing ecosystem tools for validation, testing, and frontend work

Choose technology for portability, predictability, maintainability, TypeScript ergonomics, ecosystem maturity, and sufficient performance. Do not select infrastructure because it wins a synthetic benchmark. Do not introduce a native dependency until a measured practical problem requires it.

The result should be interesting where it helps developers—ownership, boundaries, discovery, diagnostics—and boring where the ecosystem already solves the problem.

## What Nara deliberately does not build

Nara composes existing tools instead of recreating them. It is deliberately not:

- a JavaScript runtime
- a custom HTTP framework
- a custom frontend framework
- a custom ORM
- a custom authentication framework
- a dependency-injection framework
- a custom RPC framework
- a compiler or programming language
- a generic build tool
- a generic package manager
- a general-purpose monorepo tool
- a multi-stack configurator
- an AI wrapper around an ordinary starter kit

That boundary keeps the product focused. Hono owns HTTP. Node owns the runtime. TypeScript owns the language. Vitest owns test execution. Nara owns the Feature model, architecture facts, and protection rules.

## Design filters

When considering a new abstraction or dependency, ask:

```text
Does this materially strengthen Compose, Understand, or Protect?
```

Then ask:

```text
Can Nara reliably infer this from code and convention?
```

If the answer is no, prefer a smaller implementation or leave the decision outside v3.0. A feature registry, metadata schema, custom query layer, or native server is not justified merely because it sounds more complete.

## Humans and coding agents

Nara serves both audiences through the same model:

- humans read a Feature directory and its public boundary
- agents receive bounded `context --json` facts before opening files
- humans review business behavior and data migrations
- agents run `doctor --json` after edits
- both use tests and production smoke checks as evidence

The architecture should be understandable without trusting an agent. Deterministic tooling reduces the context an agent must load, while explicit ownership gives a human a stable place to review a change.

## Growth without architectural drift

Nara does not promise that an application will never become complex. It makes complexity visible and gives it a recognizable shape:

```text
new capability
  → Feature owner
  → public contract
  → explicit dependency
  → statically provable application integration
  → inspectable graph
  → protected boundary
```

As the application grows, the goal is not fewer files at any cost. The goal is that each capability remains locally understandable, cross-capability relationships remain explicit, and accidental coupling fails early.
