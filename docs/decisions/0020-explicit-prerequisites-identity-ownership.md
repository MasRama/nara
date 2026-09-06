# ADR 0020: Explicit Feature Prerequisites and Auth Identity Ownership

Date: 2026-09-06
Status: Accepted

## Context

The Users assembly proved composable open code, but proving it exposed
two product gaps that would have blocked the v3.2 release line.

First, identity persistence ownership was contradictory. The Users
package shipped the migration that creates the `users` table while Auth
directly created, read, joined, and updated its rows for
login, registration, sessions, and password changes. The documentation
called this a "deliberate directional" row-level split, but no test
could defend shared-table ownership, and the alternative-provider proof
still seeded Auth-owned rows with SQL.

Second, the official Users package had hidden prerequisites. Adopting it
from a normal generated project required hand-copying reference-app
shared modules and hand-editing `package.json` before `nara add users`
— steps discoverable only through later TypeScript and module-resolution
failures. That violates the launch principle behind assemblies: an
official Feature may have prerequisites, but it must have zero hidden
prerequisites.

## Decision

**Auth owns account identity data.** Identity, credentials, login
identifiers, sessions, roles, permissions, and role assignments belong
to Auth. Users owns its management workflow, profile/admin
presentation, and the avatar assets it genuinely owns. Concretely:

- The canonical `users`-table migration moved to Auth with identical
  bytes, so existing migration ledgers still match by id, name, and
  checksum.
- Auth exposes a presentation-safe account directory
  (`findAccountById`, `listAccounts`, `createAccount`, `updateAccount`,
  `deleteAccounts`) that never returns password hashes.
- Users reaches accounts exclusively through an extended typed host:
  `UsersIdentityHost` for account-directory behavior alongside the
  existing `UsersAuthorizationHost` for roles and permissions. Its
  account repository is deleted; its routes, avatar upload, and tests
  hold no Auth imports and no SQL against account rows.
- The `assets.user_id` foreign key into Auth-owned storage is removed by
  forward migration. The column stays as an opaque owner reference with
  its indexes; assets are addressed by URL, so deleting an account no
  longer rewrites asset rows.

**Official Features declare explicit requirements** in
`official-features/<feature>/.nara/requirements.json`
(distribution-only, never installed, never architecture truth):

```json
{
  "schemaVersion": 1,
  "providers": ["auth"],
  "packages": { "sharp": "^0.35.3", "zod": "^4.4.3" }
}
```

Before any mutation, `nara add` validates the declaration against the
distributable source in both directions (imported-but-undeclared and
declared-but-unimported both fail), verifies each provider exists and
exports the symbols the assembly consumes (no resolver, no
auto-install), and plans `package.json` edits: missing packages are
appended, identical declarations are kept byte-identical, and any
conflict fails with both versions named. The manifest participates in
the same transaction and rollback as source, lineage, bindings, and
roots. Nara never edits the lockfile and never runs `npm install`;
success reports `Dependencies added to package.json. Run npm install.`

**Only the guaranteed substrate may be imported from `src/shared/`.**
Every generated app carries the SQLite persistence engine and the
environment/config it reads, staged verbatim from reference source —
they are platform, not reference-app coupling. Logging, security
validation, and app tuning stay reference-only: official Features own
such behavior or receive it through the host. `nara add` never copies
`src/shared/`.

**Evolve stays separate.** `nara evolve` reconciles Feature-owned source
only. When incoming requirements are unsatisfied (a provider the
installed bindings use is gone, or a package is missing or conflicted),
the plan carries a `requirementsNotice` and still applies the source;
bindings and `package.json` are left for explicit follow-up, never
silently migrated.

## Consequences

Positive:

- One Feature owns each table, and a source scan proves it: no
  cross-Feature account SQL, no Auth imports, no reference-only shared
  imports in Feature-owned source.
- The alternative provider implements the full account directory in
  memory, so Users management workflows run with no Auth code and no
  Auth-owned storage.
- `nara add users` on a generated app with the Auth provider is
  `add → install → check` with every Users-specific change performed by
  the transaction itself.
- Generated apps gain a documented persistence substrate instead of an
  undocumented copy step; health-only apps still ship no tables, seeds,
  or database scripts.

Negative:

- Every generated app now carries the database engine, config, and
  their npm dependencies even before any persistent Feature is added.
  The cost is a few small modules; the alternative was unadoptable
  persistent Features.
- Package compatibility uses exact declaration equality, so two
  semantically compatible ranges from different authors fail closed and
  need a human decision. Deterministic and safe over clever.
- Avatar rows keep a stale owner id after account deletion instead of
  being cleared; serving and upload flows are unaffected because assets
  are addressed by URL.

## Alternatives considered

- **Keeping the row-level split and documenting it harder** — rejected.
  Shared-table ownership cannot be tested or reasoned about, and the
  mock proof kept depending on the table it claimed to avoid.
- **Moving asset persistence behind the host as well** — rejected. The
  host supplies account/authorization behavior; making the provider
  implement Users-owned storage inverts ownership.
- **A Feature-owned SQLite engine inside Users** — rejected. Two engines
  (one per persistent Feature) would duplicate connections and split
  migration discovery; the engine is platform.
- **Copying selected `src/shared/` modules during installation** —
  rejected. That recreates starterkit patching with extra steps; the
  substrate rule keeps one verbatim source of truth.
- **Automatic provider installation or a dependency resolver** —
  rejected. Explicit prerequisites with fail-closed messages keep the
  application understandable; npm remains the package manager.
- **Automatic binding migration on evolve** — rejected again (consistent
  with ADRs 0018/0019). The notice names each gap; a future explicit
  workflow can consume it.
