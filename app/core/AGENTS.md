# app/core - Framework Kernel

**Generated:** 2026-04-04

## Overview

Framework kernel exporting HTTP abstractions, routing, error handling, and response helpers. Powers the entire application lifecycle.

## Structure

```
app/core/
├── App.ts              # NaraApp + createApp (server bootstrap)
├── BaseController.ts   # Abstract controller with auth guards
├── Router.ts           # NaraRouter + createRouter (type-safe routing)
├── FormRequest.ts      # Laravel-style form request validation
├── errors.ts           # HttpError hierarchy (8 error types)
├── response.ts         # JSON response helpers
├── types.ts            # Core TypeScript types
├── adapters/           # Frontend adapters (Svelte/Inertia)
└── index.ts            # Barrel export
```

## Key Exports

**Classes:** `NaraApp`, `NaraRouter`, `BaseController`, `FormRequest`, `HttpError`, `ValidationError`, `AuthError`, `NotFoundError`, `ForbiddenError`, `BadRequestError`, `ConflictError`, `TooManyRequestsError`, `InternalError`

**Functions:** `createApp`, `createRouter`, `jsonSuccess`, `jsonError`, `jsonPaginated`, `jsonCreated`, `jsonNoContent`, `jsonUnauthorized`, `jsonForbidden`, `jsonNotFound`, `jsonValidationError`, `jsonServerError`

**Types:** `NaraRequest`, `NaraResponse`, `NaraMiddleware`, `NaraHandler`, `AuthenticatedRequest`, `PaginationParams`, `AppOptions`

## Conventions

- **Controllers extend BaseController** for method auto-binding + auth helpers
- **Use response helpers** for all API responses (ensures consistent format)
- **Throw HttpError subclasses** for error handling (auto-caught by global handler)
- **FormRequest** for complex validation + authorization logic
- **createApp** is the entry point - pass routes, adapter, and middleware options

## Adapters (`adapters/`)

| File | Purpose |
|------|---------|
| `svelte.ts` | Svelte/Inertia.js frontend adapter — enables `res.inertia()` on responses |
| `types.ts` | TypeScript type definitions for adapter interfaces |

The Svelte adapter is passed to `createApp()` in `server.ts`:

```typescript
import { svelteAdapter } from "@core/adapters/svelte";

const app = createApp({
  routes,
  adapter: svelteAdapter(), // enables res.inertia() on all routes
  csrf: true,
});
```

Without the adapter, calling `res.inertia()` throws an error. The adapter is what wires Inertia.js server-side rendering into the HyperExpress HTTP layer.
