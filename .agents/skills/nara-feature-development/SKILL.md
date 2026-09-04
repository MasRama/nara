---
name: nara-feature-development
description: Creating or changing a business feature — skeleton, boundaries, and composition
---

# Feature Development

## Workflow

1. Scope the capability: `node build/src/cli/index.js context <related-feature> --json` for neighbors, `impact` before touching a public contract.
2. Scaffold only what the capability needs: `nara make feature billing` creates `contract.ts` + `index.ts`. Add `server/`, `web/`, `tests/` when the capability needs them — never empty layers for symmetry.
3. Put the boundary types in `contract.ts` (Zod schema + inferred types together).
4. Implement server code under `server/` (routes, service, repository). Export only the intentional public surface from `index.ts`.
5. If the capability needs browser UI, add `web/` (pages, components, composables, typed client) and export browser-safe surfaces from `web/index.ts`. Never export server-only symbols through it.
6. Cover the new observable contract with tests under `tests/` (route behavior, validation, authorization — not plumbing).
7. Run `nara doctor --json`, then the narrow Vitest file, then `npm run check` before handoff.

## Composition

```typescript
// Server: mount the public route export.
import { billingRoutes } from '@/features/billing';
app.route('/api/billing', billingRoutes);

// Browser: compose the page through the browser-safe barrel.
import { BillingPage } from '@/features/billing/web';
{ path: '/billing', name: 'billing', component: BillingPage, meta: { requiresAuth: true } },
```

Full model: `docs/v3/feature-model.md`. Response shapes and validation: `nara-api-contracts`. Auth: `nara-auth-rbac`. SQL: `nara-database`. Browser: `nara-frontend`.

## Do / Don't

- **Do** keep the capability under one `src/features/<feature>/` directory.
- **Do** export the smallest public interface another capability needs.
- **Do** keep feature dependencies acyclic.
- **Don't** create global `controllers/`/`services/`/`repositories/` trees.
- **Don't** reach into another feature's `server/*` or `web/pages/*` internals.
- **Don't** put business logic in `src/app/` or `src/shared/`.
