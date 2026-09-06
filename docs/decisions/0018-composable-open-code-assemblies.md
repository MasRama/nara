# ADR 0018: Composable Open Code via Feature Assemblies

Date: 2026-09-06
Status: Accepted

## Context

Evolvable Open Code (ADR 0017) solved one starter-kit failure: copied source
can evolve without losing customization. A second failure remained: after a
successful copy, the developer still performed bespoke application wiring by
hand, with no deterministic record of how an official Feature joins the
running application.

The previous installability doctrine blocked the way out: a capability could
join `official-features/` only when `nara add` produced zero changes outside
the new Feature directory. That rule keeps small Features honest, but it
prevents every substantial reusable capability — anything that needs a route
mount, a browser route, or host wiring cannot be installed without touching
application composition, so it can never become an official Feature.

## Decision

Replace the zero-outside-file restriction with a zero-hidden-change
principle:

> Official Features do not need zero application-level changes. They need
> zero hidden application-level changes.

The concrete model is **Feature Assemblies** with two distinct ownership
domains:

- Feature-owned source (`src/features/<feature>/`) belongs to the Feature
  and participates in Evolvable Open Code lineage.
- Application-owned bindings (`src/app/bindings/<feature>.server.ts`,
  `src/app/bindings/<feature>.web.ts`) belong permanently to the
  application. Feature evolution never overwrites them.

An official Feature may ship distribution-only assembly templates under
`official-features/<feature>/.nara/assembly/{server,web}.ts`. They are
installation recipes, not architecture truth: they are never installed into
`src/features/`, never enter lineage `BASE`, and the architecture engine
never treats `official-features/*/.nara` as application architecture. After
installation, Nara understands the application solely from `src/features`
and `src/app`, so deleting the CLI never removes application behavior.

Activation must be explicit and statically provable. A binding file merely
existing proves nothing. The existing application-integration analyzer
proves the whole chain — canonical root imports the binding, the root calls
it with the proven Hono instance (or spreads it into the proven
`createRouter({ routes })` array), and the binding mounts a Feature public
export — before reporting a route integration. Orphan bindings stay silent.
Conservative false negatives remain preferable to false positives, and
ordinary direct composition (`app.route('/api/users', userRoutes)`) keeps
working unchanged.

`nara add` treats Feature source, lineage, binding files, and canonical
app-root edits as one fail-closed transaction: collisions are inspected
before mutation, the candidate is validated with `analyzeArchitecture` and
`discoverFeatureIntegrations` (expected assembly facts must be provable, no
newly introduced diagnostic allowed), and only then is anything applied.
`nara new` uses the same primitive for Health instead of a separate
generator wiring. `nara evolve` never migrates bindings; a stale binding
that breaks architecture is reported through the existing
architecture-regression gate.

## Consequences

Positive:

- Substantial capabilities can become official Features without hiding
  application decisions behind a registry, manifest, or runtime.
- The final application stays ordinary TypeScript, Hono, and Vue Router:
  explicit imports, explicit calls, explicit route records.
- Nara dogfoods its own architecture model: installation fails when it
  cannot prove the composition it just generated.
- Application customizations survive Feature evolution byte-for-byte.

Negative:

- Only statically provable activation is reported; dynamic composition
  remains invisible by design.
- `nara add` for assembly Features requires the canonical app roots to
  exist and prove their framework instances.
- No generic host-requirement mechanism yet: Features needing injected
  policies or providers wait for a later capability built on a real need.

## Alternatives considered

- **Runtime registry (`defineFeature` / `registerFeature` / container)** —
  rejected because it hides wiring behind a Nara abstraction and the
  application stops being understandable without the CLI.
- **Dynamic binding discovery (glob loading, plugin system)** — rejected
  because filename presence is not intent; activation must be proven from
  the canonical roots.
- **Architecture manifest in `.nara/assembly`** — rejected because
  manifests drift from executable code; templates are consumed once at
  install time and never read again.
- **Automatic binding migration during `nara evolve`** — rejected as
  speculative; bindings are local customization and the regression gate
  already blocks breaking evolution.
- **Feature dependency manifest with auto-install** — rejected;
  TypeScript imports remain the single source of architectural truth and
  npm-within-Nara is a non-goal.
