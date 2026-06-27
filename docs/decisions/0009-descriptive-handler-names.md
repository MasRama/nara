# ADR 0009: Descriptive handler names over REST conventions

Date: 2025-06-28
Status: Accepted

## Context

REST convention uses generic handler names: `index`, `show`, `store`, `create`, `update`, `destroy`. These names are:
- Low semantic density — `users.create` tells you nothing without reading the file
- Context-dependent — `create` in `users.ts` creates a user, `create` in `roles.ts` creates a role
- AI-unfriendly — AI must open the file to understand what the handler does

For AI-first code, names should be self-documenting. The AI should understand intent from the name alone.

## Decision

Use descriptive handler names that include the resource and action:
- `index` → `listUsers`, `listRoles`, `listProducts`
- `store`/`create` → `addUser`, `addRole`, `addProduct`
- `update` → `editUser`, `editRole`, `editProduct`
- `destroy`/`remove` → `removeUsers`, `removeRole`, `removeProducts`
- `show` → `showUser`, `showRole` (or just include in page handler)
- Page handlers keep `*Page` suffix: `usersPage`, `rolesPage`, `landingPage`

Enforced by lint rules L11-L13 in `scripts/lint-layers.ts`.

## Consequences

Positive:
- AI understands handler intent without reading the file
- Route file reads like documentation: `Route.post('/users', users.addUser)`
- Grep-friendly — `grep "addUser"` finds the handler, not 10 different `create` functions
- Self-documenting code — no comment needed to explain what `addUser` does

Negative:
- More typing than `create` — acceptable, AI generates the names
- Deviates from REST convention — acceptable, Nara is not a REST API framework
- Name collisions with query functions (e.g. `createUser` handler vs `createUser` query) — resolved by using different verbs (handler: `addUser`, query: `createUser`)

## Alternatives considered

- **REST names (index, store, create, etc.)** — traditional, but low semantic density. AI must read files to understand intent.
- **Verb-only (create, update, delete)** — shorter but still context-dependent. `users.create` vs `roles.create` requires reading the file.
- **Full sentences (createNewUser)** — too verbose. `addUser` is sufficient.
