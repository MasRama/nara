# Nara v3.2.0 — Composable & Evolvable Open Code

Status: released as `v3.2.0`. Canonical lifecycle: Compose → Own → Understand → Evolve → Protect.

> Nara is an architecture-aware TypeScript application kit built around composable, evolvable open code.

Nara v3.1.0 taught the CLI to describe architecture and how it changes.
Nara v3.2.0 makes that architecture something you can ship, adopt, and keep:
official capabilities install as explicit source, adapt to your application
through ordinary typed code, and evolve without orphaning your customizations.

## Composable Open Code

A Feature Assembly separates three things that starter kits usually blur together:

```text
Feature-owned source
+
application-owned binding
+
explicit application activation
```

Installing Users copies its implementation to `src/features/users/`, writes
application-owned bindings to `src/app/bindings/users.server.ts` and
`src/app/bindings/users.web.ts`, and activates them with explicit composition
calls in the canonical roots (`src/app/server.ts`, `src/app/router.ts`).
Every file is visible, deterministic, and verified by the architecture engine
before anything is applied — installation is transactional and fails closed.

The key principle:

> Official Features do not need zero application-level changes. They need zero hidden application-level changes.

Bindings remain ordinary Hono / Vue Router TypeScript. There is no runtime
Feature registry, no plugin loader, no hidden container. `nara doctor`,
`inspect`, `context`, and `impact` read the same source you read.

## Evolvable Open Code

Installed source stays evolvable through a three-way reconciliation:

```text
BASE + LOCAL + INCOMING
```

`BASE` is the exact official source recorded at install time,
`LOCAL` is your possibly customized copy, and `INCOMING` is the current
official source bundled with your installed CLI. Evolution merges
upstream-only updates, preserves local-only code, and reports conflicts as a
stable path list — never as conflict markers, never partially applied.

> Open code without orphaning.

Local customization remains owned by the application: evolution advances the
Feature and its lineage while application bindings stay byte-identical.
Before applying, Nara replays the architecture snapshot and diff model over
an isolated candidate and blocks newly introduced architecture diagnostics.
Conflicts and new diagnostics fail closed; existing debt stays tolerated.

## Typed Host Requirements

Users is the substantial proof. It needs account identity — but it must not
depend on any particular identity implementation. So Users declares a typed
host requirement:

```text
Users
→ typed requirement

application binding
→ Auth / another provider
```

`src/features/users/server/host.ts` and `web/host.ts` describe the host
surface as plain TypeScript; the application binding satisfies it with the
reference Auth capability or any compatible provider the application owns.
There is no DI container, no service locator, and no direct Users → Auth
implementation dependency — the feature graph stays empty and `nara inspect`
proves it.

## Explicit prerequisites

Distribution-only metadata makes the rest explicit:

```text
.nara/requirements.json
```

The Users package declares provider prerequisites (`["auth"]`) and npm
prerequisites (`sharp`, `zod`). `nara add` validates the provider surface
against the application's actual source and composes `package.json`
transactionally — already-satisfied packages are left untouched, and every
addition is reported so the application can run `npm install` itself.
Requirements metadata is distribution help, not architecture truth: the
engine derives facts from `src/`, never from the manifest.

Nara does NOT:

```text
edit package-lock.json
run npm install
auto-install provider Features
```

Dependency installation stays an ordinary, reviewable application decision.

## Architecture intelligence

The v3.1 architecture engine now serves the product story:

* Architecture Context Packs (`nara context`) — bounded reading order before editing
* Application integration provenance — which bindings mount which routes, and from which boundary symbols
* Public API consumer evidence — who consumes exact public and browser-safe symbols
* Public boundary provenance — direct-AST, statically provable framework composition
* Architecture-aware `diff` — structural dependency impact between refs
* `guard` — fail CI only on newly introduced diagnostics

These describe and protect the composed application; they never dominate it.

## Official Features

The current catalog:

```text
health
audit
users
```

Health ships with every `nara new` project, lineage already established.
Audit adds explicit audit events. Users is the first substantial assembly:
full server routes, browser pages, migrations, and typed host bindings —
requiring a compatible provider for its bundled binding. Auth remains a
reference implementation in the Nara repository, not an installable package:
it is one valid provider, never a hidden dependency.

## Foundations

Every generated project carries the guaranteed persistence substrate
(`src/shared/database/` engine, `src/shared/config/` environment) with no
tables until a persistent Feature provides migrations — health-only starters
are runnable without a database Feature. The identity-storage ownership move
(Auth now owns what Users once held) is migration-compatible: applied
databases accept it by id, filename, and checksum without rerunning, and the
forward owner-reference migration preserves asset data and required indexes.
Generated projects exact-pin `@nara-web/cli: 3.2.0`, so architecture-rule
changes arrive only through an explicit dependency update.
