---
authority: canon
trigger: Before writing code — read this to avoid common AI mistakes
---

# Common Pitfalls

> **Authority:** canon — current source of truth for avoiding common mistakes.

Mistakes AI agents make in Nara. Read before coding.

### 1. Pakai `router.post()` untuk mutation instead of `api(() => axios.post())`

**Salah:** `router.post('/products', data)` — bypass CSRF, gak ada toast, gak ada error handling.

**Fix:** `const result = await api(() => axios.post('/products', data))` — handle CSRF, toast, error.

### 2. Import SQLite langsung di handler

**Salah:** `import SQLite from '@services/SQLite'` di handler.

**Fix:** Import query functions dari `@queries` — handler gak pernah sentuh SQLite langsung.

### 3. Pakai `export let` instead of `$props()`

**Salah:** `export let value: string` — Svelte 4 syntax.

**Fix:** `let { value }: { value: string } = $props()` — Svelte 5 runes.

### 4. Lupa `try/catch` di mutation

**Salah:** Panggil `createProduct()` tanpa try/catch — SQLite constraint error crash server.

**Fix:** Wrap mutation di try/catch, handle `SQLITE_CONSTRAINT_UNIQUE`, return `jsonServerError()` untuk unexpected error.

### 5. Pakai `onMount()` instead of `$effect()`

**Salah:** `onMount(() => { ... })` — Svelte 4 lifecycle.

**Fix:** `$effect(() => { ... })` — Svelte 5 runes. Jalan setelah mount DAN pas dependency berubah.

### 6. Gak cek `req.user` sebelum pakai

**Salah:** `const userId = req.user.id` — crash kalau user belum login.

**Fix:** `if (!req.user) return jsonError(res, 'Unauthorized', 401)` di atas handler.

### 7. Pakai `parseInt(req.query.x as string) || 1` untuk pagination

**Salah:** Manual parseInt + fallback — panjang, gampang salah.

**Fix:** `const page = queryInt(req, 'page')` — handle parsing + default value.

### 8. Lupa update `app/handlers/index.ts` setelah bikin handler

**Salah:** Bikin `app/handlers/products.ts` tapi gak export.

**Akibat:** `import * as products from '@handlers/products'` gagal.

**Fix:** Tambah `export * as products from './products'` ke `app/handlers/index.ts`.

### 9. Pakai IN-clause dengan single placeholder

**Salah:** `SQLite.all('DELETE FROM products WHERE id IN (?)', ids)` — better-sqlite3 tidak expand array ke 1 placeholder.

**Fix:** Build placeholders manual: `const placeholders = ids.map(() => '?').join(','); SQLite.run(\`DELETE FROM products WHERE id IN (${placeholders})\`, ids)`.

### 10. Pakai bahasa selain English untuk user-facing message

**Salah:** `jsonError(res, 'Email sudah digunakan', 400)` — inconsistent dengan ADR 0010.

**Fix:** `jsonError(res, 'Email already in use', 400, 'DUPLICATE_EMAIL')` — English untuk semua user-facing message (ADR 0010).
