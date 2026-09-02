---
trigger: Before writing code — read this to avoid common AI mistakes
status: active-v3
---

# Common Pitfalls (v3)

Mistakes coding agents make in Nara v3. Read before changing code.

### 1. Organizing a capability by technical layer

**Wrong:** Adding a new global `controllers/`, `services/`, or `repositories/` tree.

**Fix:** Keep the capability under `src/features/<feature>/` and use `server/`, `web/`, `contract.ts`, and `tests/` only where needed.

### 2. Importing another Feature's internals

**Wrong:** Importing `src/features/users/server/repository.ts` from the auth Feature.

**Fix:** Import only the target Feature's public exports from its `index.ts`.

### 3. Putting feature pages in a global frontend directory

**Wrong:** Creating `resources/Pages/Users.vue` for a users capability.

**Fix:** Place feature-specific pages, components, and composables under `src/features/users/web/`. Keep application-wide Vue composition under `src/app/`.

### 4. Treating frontend authorization as security

**Wrong:** Hiding a destructive button and assuming the operation is protected.

**Fix:** Enforce authentication and permission checks in the owning Hono route. Frontend permission gating is only a user-experience concern.

### 5. Duplicating server and client contract types

**Wrong:** Defining a second request interface in a Vue page that already has a Feature contract.

**Fix:** Export the schema and inferred types from the owning Feature's `contract.ts`, then consume them through its browser client.

### 6. Adding a global frontend transport abstraction

**Wrong:** Wrapping Vue and Hono behind a new Nara RPC or universal API layer.

**Fix:** Use the existing feature-scoped typed client in `web/client.ts`, or a direct browser request when no client exists. Keep the underlying ecosystem visible.

### 7. Returning the wrong Hono response shape

**Wrong:** Returning an ad hoc success or error object from a route.

**Fix:** Follow the Feature contract's discriminated response shape: `{ success: true, message, data? }` or `{ success: false, message, code, errors? }`.

### 8. Putting SQL in route composition

**Wrong:** Building SQL inside `src/app/server.ts` or a route registration callback.

**Fix:** Keep raw SQL in the owning Feature's repository module or the smallest intentional shared database module.

### 9. Skipping transactions for replacement operations

**Wrong:** Deleting and recreating role or user assignments as separate unprotected operations.

**Fix:** Use a `better-sqlite3` transaction for all-or-nothing replacement behavior.

### 10. Using a language other than English for user-facing messages

**Wrong:** Returning a localized message that conflicts with the rest of the API.

**Fix:** Keep API, validation, and Vue-visible messages in English (ADR 0010).
