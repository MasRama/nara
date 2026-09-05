# ADR 0016: Public boundary export provenance

Date: 2026-09-05
Status: Accepted

## Context

Nara already records Feature ownership, public and browser-safe boundaries, and cross-Feature import evidence. That model identifies which exported name a consumer imports, but it cannot explain where a boundary export comes from. A public alias may expose a Feature contract type, a private implementation symbol, or an unrelated module with the same name. Treating those cases alike creates false contract-impact reports.

The architecture model needs a deterministic, syntax-level provenance fact while remaining shallow. It must not become a compiler, recursively resolve arbitrary re-export chains, or claim semantic breakage.

## Decision

Nara adds `BoundaryExportEvidence` for the canonical files:

- `src/features/<feature>/index.ts` (`public`)
- `src/features/<feature>/web/index.ts` (`web`), when present

Each evidence record contains the Feature, boundary, boundary file, export kind (`local`, `named-reexport`, `default`, or `export-all`), precision (`symbol` or `module`), type-only status, and optional exported/source names and source specifier. The parser handles local declarations, local export lists and aliases, named re-exports and aliases, default exports, and export-all declarations. Export-all remains module precision and never creates a pseudo-symbol. Evidence is sorted and persisted in snapshots; `inspect` and `context` expose it alongside their existing name projections.

Discovery is limited to the canonical boundary file. It uses the TypeScript parser AST only, without the TypeScript language service, type checker, recursive module traversal, or runtime tracing. A contract provenance fact exists only for a direct named re-export whose normalized relative source is the owning Feature's `contract` or `contract.ts`. Multi-hop re-exports, export-all declarations, and unrelated source modules do not prove contract provenance.

`nara diff` reports same-name provenance changes separately from public export-name changes. When a contract export is removed, consumer impact is derived only from proven direct boundary provenance and matches consumers by the boundary's exported alias, not by the removed contract name. Existing direct public and web export impact remains unchanged. Application integration evidence and import evidence remain separate models.

## Consequences

Positive:

- Reviewers can see whether a boundary name is local, aliased from a module, default, or module-level.
- Contract removal impact follows proven public/web aliases and avoids same-name local collisions.
- Provenance changes are visible even when the public export name is unchanged.
- Output remains deterministic, relative-path based, and independent of compiler configuration or an AI provider.

Negative:

- Arbitrary re-export chains and export-all declarations remain conservative and cannot identify exact contract symbols.
- The snapshot payload is larger and includes syntax-level evidence.
- A source-module change can produce provenance noise even when runtime behavior is unchanged; Nara reports architecture evidence, not semantic compatibility.

## Alternatives considered

- **Resolve exports recursively with the TypeScript checker or language service** — rejected. It adds compiler configuration and resolution complexity and would turn a repository-convention fact into a type-system fact.
- **Treat every matching export name as a contract consumer** — rejected. Same-name local exports and unrelated re-exports create false impact.
- **Infer symbols from export-all or namespace forms** — rejected. Those forms prove only a module relationship.
- **Add a separate manifest or CLI command** — rejected. Provenance belongs in existing inspect, context, snapshot, diff, and impact surfaces; duplicated metadata would drift.
