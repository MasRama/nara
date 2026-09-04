# ADR 0011: Pinned local Nara CLI devDependency over global install

Date: 2026-09-04
Status: Accepted

## Context

`nara new` generated projects whose `package.json` contained only the
ecosystem stack (Hono, Vue) and whose `npm run check` ran typechecks and
tests but never `nara doctor`. The architecture tooling lived only in the
developer's checkout or global state, so a generated application could drift
without its own verification noticing. The root package was also marked
`private: true` while exposing a `bin`, so no coherent install path existed.

## Decision

- The `nara` package is publishable (`private: false`, `files` ships the
  built CLI plus `official-features/` source) and installed from the npm
  registry (`npm install nara`, `npx nara new my-app`).
- `nara new` pins the creating CLI version as an exact devDependency
  (`"nara": "3.0.0"`, no range) of every generated project.
- Generated `npm run check` ends with `npm run architecture:doctor`
  (`nara doctor` from the project's own install).
- Nara stays development/tooling infrastructure: production serves HTTP
  without requiring the CLI at runtime.

## Consequences

Positive:
- Reproducible architecture tooling travels with the project, independent
  of global CLI state or the original repository checkout.
- Exact pinning keeps architecture-rule changes explicit: updating `nara`
  is a deliberate dependency update, never a silent behavior change.
- `doctor`, `inspect`, `context`, `impact`, and `add` work naturally from
  inside generated projects, including offline after install.

Negative:
- Pre-publish, the pinned spec cannot resolve from the registry; tests
  stand in with the packed tarball (`file:` URL, same bytes).
- Generated projects carry one more devDependency to update over time.
- No automatic migration between architecture-rule versions (documented
  limitation, not built in this pass).

## Alternatives considered

- **Global `nara` install** — irreproducible across machines and versions;
  contradicts "useful in month 12".
- **Copying CLI source into each project** — duplicates code, forks rules,
  no shared versioning.
- **Semver range (`^3.0.0`)** — silently receives rule changes that can
  break previously valid source; rejected for v3 predictability.
- **Separate `create-nara` package** — a second entrypoint with no proven
  need; one canonical `nara` package covers `new` and `add`.
