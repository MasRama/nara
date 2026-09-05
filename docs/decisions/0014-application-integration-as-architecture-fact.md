# ADR 0014: Application integration as an architecture fact

Date: 2026-09-05
Status: Accepted

## Context

Nara already models Feature ownership, public boundaries, dependencies, surfaces, and diagnostics. The reference application still composed Features in `src/app/server.ts` and `src/app/router.ts` without those relationships appearing in the architecture facts. That made an important part of the system—where a Feature enters the application and which routes expose it—available only through manual source reading.

Application composition must remain ordinary Hono and Vue code. A registry, manifest, runtime instrumentation, or semantic route analyzer would add a second source of truth and weaken Nara's deterministic model.

## Decision

Model statically provable application composition as first-class `FeatureIntegrationFacts` for every discovered Feature:

- `applicationImports` groups a Feature, canonical application file, public or web boundary, and imported export symbols.
- `serverRoutes` records static Hono `.route(staticPath, importedPublicFeatureExport)` mounts from `src/app/server.ts` only when the imported Hono binding, statically initialized Hono instance, and `.route()` receiver form a provable chain.
- `webRoutes` records static Vue Router route records whose component is an imported Feature web-boundary export from `src/app/router.ts` only when the `createRouter` binding is imported from `vue-router`, including statically nested child paths and optional names.

Discovery is AST-based and bounded to the two canonical application roots. Missing roots produce empty facts. Nara follows a statically provable chain from framework composition root to Feature boundary before reporting a route integration. Dynamic paths, dynamic components, unrelated imports, non-canonical roots, and uncertain composition are omitted rather than guessed. Route discovery records composition evidence; it does not validate runtime route health, enumerate HTTP methods, or interpret authentication metadata.

Snapshots persist integration facts for every Feature. `nara inspect` and `nara context` expose them in JSON and compact human output; context places relevant application composition roots after the public boundary and contract. `nara diff` reports added and removed application imports, server routes, and web routes. A changed path is represented as a removal plus an addition. Integration changes directly affect the owning Feature and propagate through the existing dependency graph to downstream Features.

`nara guard` continues to fail only for newly introduced `nara doctor` diagnostics. Integration changes and their affected set are informational review data, not a new policy gate. No application graph node is introduced.

## Consequences

Positive:

- Application composition becomes inspectable, diffable, and deterministic without duplicated metadata.
- Architecture context points an editor to the application roots that actually consume the target Feature.
- Route and import changes participate in the same affected-Feature review surface as boundary and dependency changes.
- The same facts work for the reference application, minimal generated projects, and packaged CLI installations.

Negative:

- Only composition that is statically provable from the canonical roots is reported.
- Dynamic factories, re-export chains, computed paths, and non-standard composition require source review and are intentionally not inferred.
- The snapshot and diff JSON contracts gain an integration section that consumers must tolerate.

## Alternatives considered

- **Application metadata manifest** — rejected because it duplicates ordinary imports and routes and can drift from executable code.
- **Runtime route introspection** — rejected because it is environment-dependent, cannot describe unexecuted composition reliably, and would blur architecture facts with runtime health.
- **Recursive application-file discovery** — rejected because arbitrary app recursion would report incidental composition and make the architecture boundary nondeterministic.
- **A new application graph node** — rejected because application roots are composition points, not business Features; the existing Feature dependency graph is sufficient for propagation.
