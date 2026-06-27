---
authority: canon
last_verified: 2026-06-28
trigger: Before writing code — read this to avoid common AI mistakes
---

# Common Pitfalls — Sering Salah di Codebase Ini

> **Authority:** canon — current source of truth for avoiding common mistakes.

Mistakes yang AI agent sering buat di Nara. Baca sebelum coding.

### 1. Lupa register Inertia page

**Salah:** Bikin `resources/Pages/products.svelte` tapi gak daftar di `resources/app.ts`.

**Akibat:** Page blank — Inertia gak ketemu component-nya.

**Fix:** Selalu tambah page baru ke page map di `resources/app.ts`:
```typescript
const pages = {
  // ...existing
  products: () => import('./Pages/products.svelte'),
};
```

### 2. Pakai `router.post()` untuk mutation instead of `api(() => axios.post())`

**Salah:** `router.post('/products', data)` — bypass CSRF, gak ada toast, gak ada error handling.

**Fix:** `const result = await api(() => axios.post('/products', data))` — handle CSRF, toast, error.

### 3. Import SQLite langsung di handler

**Salah:** `import SQLite from '@services/SQLite'` di handler.

**Fix:** Import query functions dari `@queries` — handler gak pernah sentuh SQLite langsung.

### 4. Pakai `export let` instead of `$props()`

**Salah:** `export let value: string` — Svelte 4 syntax.

**Fix:** `let { value }: { value: string } = $props()` — Svelte 5 runes.

### 5. Lupa `try/catch` di mutation

**Salah:** Panggil `createProduct()` tanpa try/catch — SQLite constraint error crash server.

**Fix:** Wrap mutation di try/catch, handle `SQLITE_CONSTRAINT_UNIQUE`, return `jsonServerError()` untuk unexpected error.

### 6. Pakai `onMount()` instead of `$effect()`

**Salah:** `onMount(() => { ... })` — Svelte 4 lifecycle.

**Fix:** `$effect(() => { ... })` — Svelte 5 runes. Jalan setelah mount DAN pas dependency berubah.

### 7. Gak cek `req.user` sebelum pakai

**Salah:** `const userId = req.user.id` — crash kalau user belum login.

**Fix:** `if (!req.user) return jsonError(res, 'Unauthorized', 401)` di atas handler.

### 8. Pakai `parseInt(req.query.x as string) || 1` untuk pagination

**Salah:** Manual parseInt + fallback — panjang, gampang salah.

**Fix:** `const page = queryInt(req, 'page')` — handle parsing + default value.

### 9. Lupa update `app/handlers/index.ts` setelah bikin handler

**Salah:** Bikin `app/handlers/products.ts` tapi gak export.

**Akibat:** `import * as products from '@handlers/products'` gagal.

**Fix:** Tambah `export * as products from './products'` ke `app/handlers/index.ts`.

### 10. Pakai English instead of Indonesian untuk user-facing message

**Salah:** `jsonError(res, 'Email already exists', 400)` — inconsistent UX.

**Fix:** `jsonError(res, 'Email sudah digunakan', 400, 'DUPLICATE_EMAIL')` — lihat ADR 0010.
