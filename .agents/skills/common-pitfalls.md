---
trigger: Before writing code — read this to avoid common AI mistakes
---

# Common Pitfalls


Mistakes AI agents make in Nara. Read before coding.

### 1. Using `router.post()` for mutations instead of `api(path, { method, body })`

**Wrong:** `router.post('/products', data)` — bypasses CSRF, no toast, no error handling.

**Fix:** `const result = await api('/products', { method: 'POST', body: data })` — handles CSRF, toast, and errors.

### 2. Importing SQLite directly in a handler

**Wrong:** `import SQLite from '@services/SQLite'` in a handler.

**Fix:** Import query functions from `@queries` — handlers never touch SQLite directly.

### 3. Using `export let` instead of `$props()`

**Wrong:** `export let value: string` — Svelte 4 syntax.

**Fix:** `let { value }: { value: string } = $props()` — Svelte 5 runes.

### 4. Forgetting `try/catch` in a mutation

**Wrong:** Calling `createProduct()` without try/catch — SQLite constraint errors crash the server.

**Fix:** Wrap mutations in try/catch, handle `SQLITE_CONSTRAINT_UNIQUE`, return `jsonServerError()` for unexpected errors.

### 5. Using `onMount()` instead of `$effect()`

**Wrong:** `onMount(() => { ... })` — Svelte 4 lifecycle.

**Fix:** `$effect(() => { ... })` — Svelte 5 runes. Runs after mount AND when dependencies change.

### 6. Not checking `req.user` before using it

**Wrong:** `const userId = req.user.id` — crashes if user is not logged in.

**Fix:** `if (!req.user) return jsonError(res, 'Unauthorized', 401)` at the top of the handler.

### 7. Using `parseInt(req.query.x as string) || 1` for pagination

**Wrong:** Manual parseInt + fallback — verbose, error-prone.

**Fix:** `const page = queryInt(req, 'page')` — handles parsing + default value.

### 8. Forgetting to update `app/handlers/index.ts` after creating a handler

**Wrong:** Creating `app/handlers/products.ts` but not exporting it.

**Result:** `import * as products from '@handlers/products'` fails.

**Fix:** Add `export * as products from './products'` to `app/handlers/index.ts`.

### 9. Using an IN-clause with a single placeholder

**Wrong:** `SQLite.many<User>`SELECT * FROM users WHERE id IN (?)` — better-sqlite3 does not expand an array into a single placeholder.

**Fix:** Interpolate the array directly — it expands to `(?, ?, …)`: `SQLite.many<User>`SELECT * FROM users WHERE id IN (${ids})``.

### 10. Using a language other than English for user-facing messages

**Wrong:** `jsonError(res, 'Email sudah digunakan', 400)` — inconsistent with ADR 0010.

**Fix:** `jsonError(res, 'Email already in use', 400, 'DUPLICATE_EMAIL')` — English for all user-facing messages (ADR 0010).
