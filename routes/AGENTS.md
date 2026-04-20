# Routes

## Overview

Single file defines all HTTP routes. Uses `createRouter()` from `@core`.

## Structure

| File | Purpose |
|------|---------|
| `web.ts` | All routes (public, auth, protected, assets) |

## Route Registration Pattern

```typescript
import { createRouter } from "@core";
import { Auth } from "@middlewares";
import { strictRateLimit } from "@middlewares";
import HomeController from "@controllers/HomeController";

const Route = createRouter();

// Public route
Route.get("/", [], HomeController.index);

// Protected route (requires auth)
Route.get("/dashboard", [Auth], DashboardController.page);

// With rate limiting
Route.post("/login", [strictRateLimit()], AuthController.processLogin);

// Resource route pattern — 1 Inertia page + N JSON data routes
Route.get("/posts", [], PostController.page);          // Inertia: renders page
Route.get("/posts/data", [Auth], PostController.index); // JSON: table data
Route.post("/posts", [Auth], PostController.store);     // JSON: create
Route.put("/posts/:id", [Auth], PostController.update); // JSON: update
Route.delete("/posts/:id", [Auth], PostController.destroy); // JSON: delete

export default Route.getRouter();
```

## Route Groups (Current)

| Group | Routes |
|-------|--------|
| Public | `/` |
| Auth | `/login`, `/register`, `/logout`, `/google/*` |
| Protected | `/dashboard`, `/users`, `/profile`, `/assets/*` |
| Static assets | `/assets/:file`, `/public/*`, `/storage/*` |

## Middleware

| Middleware | Import | Effect |
|---|---|---|
| `Auth` | `@middlewares` | Requires logged-in session |
| `strictRateLimit()` | `@middlewares` | 10 req/min per IP |
| `apiRateLimit()` | `@middlewares` | 60 req/min per IP |

## Conventions

- **Only one file**: `routes/web.ts`
- Add comments to group related routes (e.g., `// Users`)
- Static/wildcard routes (`/*`) must be registered **last** — order matters
- Route for page: method name suggests navigation (e.g., `page`, `usersPage`)
- Route for data: method name suggests action (e.g., `index`, `store`, `update`, `destroy`)
- **One Inertia page route + separate JSON data routes** — never mix response types in the same controller method

## CRITICAL: Response Type Per Route

> ⚠️ NEVER return `jsonSuccess/jsonError/jsonPaginated` from a route that the browser navigates to.
> Doing so causes: `"All Inertia requests must receive a valid Inertia response, however a plain JSON response was received."`

**Rule: Every `Route.get()` that a user visits directly in the browser MUST map to a controller method that calls `res.inertia()`.**

```
GET /posts        → PostController.page    → res.inertia()   ← browser navigation (MUST be Inertia)
GET /posts/data   → PostController.index   → jsonPaginated() ← fetch() in Svelte (MUST be JSON)
POST /posts       → PostController.store   → jsonCreated()   ← fetch() in Svelte (MUST be JSON)
PUT /posts/:id    → PostController.update  → jsonSuccess()   ← fetch() in Svelte (MUST be JSON)
DELETE /posts/:id → PostController.destroy → jsonSuccess()   ← fetch() in Svelte (MUST be JSON)
```

**When adding a new route, label it explicitly:**

```typescript
// INERTIA (browser navigates here)
Route.get("/posts", [], PostController.page);

// JSON (called by fetch() from Svelte — NOT browser navigation)
Route.get("/posts/data", [Auth], PostController.index);
Route.post("/posts", [Auth], PostController.store);
```
