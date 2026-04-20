# Controllers

## Overview

HTTP request handlers. All controllers extend `BaseController` for auto-binding, auth guards, and validation helpers.

## Structure

| File | Purpose |
|------|---------|
| `HomeController.ts` | Landing page (Inertia) |
| `AuthController.ts` | Login, register, logout, change password |
| `UserController.ts` | User CRUD + profile management |
| `OAuthController.ts` | Google OAuth flow |
| `AssetController.ts` | File upload, avatar serving |

## Golden Pattern

```typescript
import { BaseController, jsonSuccess, jsonCreated, jsonNotFound, jsonServerError } from "@core";
import type { NaraRequest, NaraResponse } from "@core";
import { MyModel } from "@models";
import Logger from "@services/Logger";
import { paginate } from "@services/Paginator";
import { event } from "@helpers/events";
import { MyEvent } from "@events/examples";
import { CreateMySchema } from "@validators";
import { randomUUID } from "crypto";

class MyController extends BaseController {
  // Page route — renders Inertia page shell
  public async page(req: NaraRequest, res: NaraResponse) {
    this.requireInertia(res);
    return res.inertia("my/Index"); // no data here
  }

  // JSON endpoint — called by fetch() from Svelte
  public async index(req: NaraRequest, res: NaraResponse) {
    const { page, limit, search } = this.getPaginationParams(req);
    const query = MyModel.query().orderBy("created_at", "desc");
    const result = await paginate(query, { page, limit });
    return jsonPaginated(res, "OK", result.data, result.meta);
  }

  public async store(req: NaraRequest, res: NaraResponse) {
    this.requireAuth(req);
    const data = await this.getBody(req, CreateMySchema);
    try {
      const record = await MyModel.create({ id: randomUUID(), ...data });
      await event(new MyEvent({ record, userId: req.user!.id }));
      return jsonCreated(res, "Created", record);
    } catch (error: any) {
      Logger.error("Failed to create", error);
      return jsonServerError(res);
    }
  }
}

export default new MyController();
```

## Response Type Rules (CRITICAL)

> ⚠️ ERROR TO AVOID: `"All Inertia requests must receive a valid Inertia response, however a plain JSON response was received."`
> This error happens when a route navigated to by the browser returns `jsonSuccess/jsonError` instead of `res.inertia()`.

**BEFORE YOU WRITE ANY CONTROLLER METHOD, ASK YOURSELF:**

```
Q: Will a user's browser navigate directly to this URL (clicking a link, typing in address bar, router.visit())?
├── YES → use res.inertia("PageName")   — DO NOT use json*() helpers
└── NO  → this is called by fetch() inside Svelte
         └── use jsonSuccess / jsonCreated / jsonError / jsonPaginated
```

**Two distinct response types — NEVER mix them:**

| Route purpose | Method to use | Route registered as |
|---|---|---|
| Browser page navigation | `res.inertia("PageName")` | `Route.get('/path', [], Controller.page)` |
| CRUD via `fetch()` | `jsonSuccess/jsonCreated/jsonError` | `Route.post('/path', [Auth], Controller.store)` |

- Routes navigated to by browser → **always** `res.inertia()`
- Routes called by `fetch()` in Svelte → **always** `json*()` helpers
- **NEVER** return `jsonSuccess/jsonError/jsonPaginated` from a page route — this causes the Inertia JSON error
- **NEVER** return `res.inertia()` from an API/CRUD route — this returns wrong format to frontend fetch()

**Name your methods to make the intent unmistakable:**
- Page methods: `page`, `showPage`, `editPage` → always `res.inertia()`
- Data/action methods: `index`, `store`, `update`, `destroy`, `show` → always `json*()`

## Auth Guards

```typescript
this.requireAuth(req);          // throws AuthError if not logged in
await this.requireAdmin(req);   // throws ForbiddenError if not admin
await this.authorize(req, 'edit-user', targetUser); // RBAC check
```

## Conventions

- Filename: `{Resource}Controller.ts`
- Class: `extends BaseController` (required for auto-binding)
- Export singleton: `export default new MyController()`
- Import via `@core`, `@models`, `@services`, `@validators`, `@helpers`
- All methods auto-bound — no need to `.bind(this)` in routes
- Use `try/catch` + `jsonServerError` for database errors
- Dispatch events after successful mutations
