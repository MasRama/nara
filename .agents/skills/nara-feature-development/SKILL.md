---
name: nara-feature-development
description: Creating or changing a business feature — skeleton, boundaries, and composition
---

# Feature Development

Primary procedural skill for creating or changing a business capability.
Authority stays in `../../../AGENTS.md`, `../../../ARCHITECTURE.md`, and
`../../../docs/v3/feature-model.md`; this file is the workflow.

## Workflow

1. For an existing Feature, scope the change against deterministic facts first:
   `node build/src/cli/index.js context <feature> --json` for the bounded
   context pack and reading order, `node build/src/cli/index.js impact
   <feature> --json` before changing a public contract, and `node
   build/src/cli/index.js inspect <feature> --json` for exports, consumers,
   dependencies, surfaces, and integrations.
2. For a new Feature, the target does not exist yet, so do not run `inspect` or
   `impact` against that name before scaffolding. Use `context` on a related
   existing Feature when useful, then scaffold only what the new capability
   needs. In an installed/generated app use `npx nara make feature billing`;
   in this contributor checkout use the built CLI (`node
   build/src/cli/index.js make feature billing`) or the source CLI form
   documented in `AGENTS.md`. The command creates `contract.ts` + `index.ts`.
   After that, `context` / `inspect` can describe the new Feature. Add
   `server/`, `web/`, `tests/` only when needed — never empty layers for
   symmetry.
3. Put the boundary types in `contract.ts` (Zod schema + inferred types together).
4. Implement server code under `server/` (routes, service, repository). Export only the intentional public surface from `index.ts`.
5. If the capability needs browser UI, add `web/` (pages, components, composables, typed client) and export browser-safe surfaces from `web/index.ts`. Never export server-only symbols through it.
6. Cover the new observable contract with tests under `tests/` (route behavior, validation, authorization — not plumbing).
7. Run `node build/src/cli/index.js doctor --json`, then the narrow Vitest file, then `npm run check` before handoff.

## Composition

Compose through the application layer, never Feature-to-Feature internals:

```typescript
// Server: mount the public route export.
import { billingRoutes } from '@/features/billing';
app.route('/api/billing', billingRoutes);

// Browser: compose the page through the browser-safe barrel.
import { BillingPage } from '@/features/billing/web';
{ path: '/billing', name: 'billing', component: BillingPage, meta: { requiresAuth: true } },
```

## Reusable Features: host requirements plus bindings

A reusable/installable Feature that needs application capabilities it does
not own must stay provider-neutral: declare typed host requirements and let
an application-owned binding adapt them. The reference shape is
`createUserRoutes(host)` from the Users Feature, supplied by
`src/app/bindings/users.server.ts` (server) and the `UsersWebHost` props
from `src/app/bindings/users.web.ts` (browser). Do not teach direct
coupling to a particular provider when the capability is supposed to
remain provider-neutral. Authorization composition details: `nara-auth-rbac`.

Related procedures: `nara-api-contracts` (routes, validation, responses),
`nara-database` (repositories, migrations), `nara-frontend` (pages,
clients, router), `nara-testing` (which proof to write).

## Do / Don't

- **Do** keep the capability under one `src/features/<feature>/` directory.
- **Do** export the smallest public interface another capability needs.
- **Do** keep feature dependencies acyclic.
- **Don't** create global `controllers/`/`services/`/`repositories/` trees.
- **Don't** reach into another feature's `server/*` or `web/pages/*` internals.
- **Don't** put business logic in `src/app/` or `src/shared/`.
