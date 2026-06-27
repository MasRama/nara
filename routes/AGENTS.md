# Routes

Single file: `routes/web.ts`. Uses `createRouter()` from `@core`.

## Pattern

```typescript
import { createRouter } from '@core';
import * as users from '@handlers/users';
import Auth from '@middlewares/auth';
import { strictRateLimit } from '@middlewares/rateLimit';

const Route = createRouter();

// Inertia page (browser navigation)
Route.get('/users', [Auth], users.usersPage);

// JSON data (called by api(() => axios.method()) from Svelte)
Route.post('/users', [Auth], users.create);
Route.put('/users/:id', [Auth], users.update);
Route.delete('/users', [Auth], users.remove);

// Route groups with shared prefix + middleware
Route.group('/api', [Auth], (r) => {
  r.get('/items', items.index);
  r.post('/items', items.store);
});

export default Route.getRouter();
```

## Middleware

| Middleware | Import | Effect |
|---|---|---|
| `Auth` | `@middlewares/auth` | Requires logged-in session |
| `strictRateLimit()` | `@middlewares/rateLimit` | 10 req/min per IP |

## Rules

- Handlers are **functions** imported as namespaces (`import * as users from '@handlers/users'`)
- Inertia page handler: `res.inertia('pageName', { data })` — set up by renderer middleware, no import needed
- JSON handler: `jsonSuccess(res, 'OK', data)` / `jsonError(res, 'Not found', 404)`
- Static/wildcard routes (`/*`) must be registered **last**
- NEVER return `jsonSuccess` from a page route — browser will show raw JSON
- NEVER return `inertia()` from a data route — use json helpers
