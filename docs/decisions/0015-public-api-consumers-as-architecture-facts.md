# ADR 0015: Public API consumers as architecture facts

Date: 2026-09-05
Status: Accepted

## Context

Nara already derives Feature ownership, dependency edges, public boundaries, and statically provable application integration from repository conventions. A dependency edge answers which Feature depends on another Feature, but it does not explain which public symbol is consumed, whether the usage is explicitly type-only or value-capable syntax, or which consumer remains after a public symbol is removed.

That gap makes contract review unnecessarily manual. The architecture model must become more useful without turning into a compiler, runtime tracer, or semantic breakage predictor.

## Decision

Nara derives deterministic cross-Feature import evidence from statically declared TypeScript and Vue module syntax. Evidence records:

- source and target Feature
- source file and original module specifier
- public or browser-safe boundary when the path proves one
- imported symbol, local alias, or re-export alias when syntax proves one
- import form and explicitly type-only versus value-capable syntax
- `symbol` precision or conservative `module` precision
- internal-path status used by existing boundary diagnostics

The existing Feature dependency graph is aggregated from this shared evidence model. Dependency edge shape and affected semantics remain compatible; richer evidence is additive.

`index.ts` remains the general/server public boundary. `web/index.ts` is the optional browser-safe public boundary. Inspection and context expose exact symbol-level consumers through these boundaries. Impact exposes exact evidence for direct dependents only.

Namespace imports, side-effect imports, `require`, dynamic imports, and `export *` establish module-level dependency evidence but do not claim an exact symbol. No identifier-flow inference, TypeScript type-checker reference search, runtime tracing, or inferred semantic relationship is added.

Architecture snapshots persist the deterministic evidence and web public exports. `nara diff` reports import-evidence additions/removals and connects removed public, web, and contract symbols to baseline symbol consumers. Each baseline consumer is labeled `still-imported` or `removed-in-change`; this is evidence for review, not a prediction of whether a change breaks behavior.

Application composition remains a separate architecture fact. The consumer model does not replace or merge with statically provable Hono/Vue composition discovery.

## Consequences

Positive:

- `inspect`, `context`, and `impact` provide bounded public API consumer intelligence.
- Reviewers can distinguish explicitly type-only contracts from value-capable syntax consumers.
- `diff` shows the consumer evidence that changed and the baseline consumers of removed symbols.
- Existing dependency edges, diagnostics, guard policy, and application-integration facts retain their contracts.
- Output remains deterministic, relative-path based, and independent of an AI provider.

Negative:

- Syntax that proves only a module dependency cannot identify exact symbols.
- Alias changes may appear as evidence changes even when the same symbol remains imported; removed-symbol analysis labels that consumer `still-imported`.
- Dynamic behavior, re-export resolution across arbitrary modules, and semantic breakage remain outside the architecture model.
- Snapshots carry a larger deterministic payload.

## Alternatives considered

- **Use the TypeScript compiler or language-service references** — rejected. It would add type-resolution cost and complexity, and would make the architecture fact depend on compiler configuration rather than the repository's explicit boundary conventions.
- **Infer symbol usage from namespace, dynamic, or runtime module values** — rejected. Those forms prove only a module relationship and exact-symbol claims would be false positives.
- **Add a separate consumer manifest or CLI command** — rejected. The evidence belongs in existing dependency, inspect, context, impact, snapshot, and diff surfaces; duplicated metadata would drift.
- **Predict whether a removed symbol breaks a consumer** — rejected. Nara reports declared architecture evidence and leaves behavior and compatibility review to the project.
