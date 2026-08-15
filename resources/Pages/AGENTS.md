---
description: "Inertia.js pages rendered by Svelte 5. Each page is a route destination — server renders shell, page fetches data via api() to /data endpoints"
tags: [pages, inertia, svelte, routes, frontend, dashboard, landing, auth]
---

# Pages


## Overview

Inertia.js pages rendered by Svelte 5. Each page is a route destination — the server renders the page shell, the page fetches its data via separate JSON endpoints.

## Structure

| File | Purpose |
|------|---------|
| `dashboard.svelte` | Admin dashboard with user stats + user list |
| `landing.svelte` | Public landing page |
| `profile.svelte` | User profile + password change (Zag JS tabs) |
| `roles.svelte` | Role management (CRUD table + permissions) |
| `users.svelte` | User management (CRUD table + role assignment) |
| `auth/login.svelte` | Login form |
| `auth/register.svelte` | Registration form |
| `errors/NotFound.svelte` | 404 page (catch-all route) |

## Page Pattern (Svelte 5 + Inertia + api())

```svelte
<script lang="ts">
  import { page as inertiaPage, router } from "@inertiajs/svelte";
  import Header from "../Components/Header.svelte";
  import { api } from '$lib/api';
  import { Toast } from '$lib/toast';
  import type { User } from "../types";

  // Props from server (passed by res.inertia("PageName", { data }))
  let { items = [], permissions, total }: Props = $props();

  // Current user from Inertia shared props
  const currentUser = $derived(inertiaPage.props.user as User | undefined);

  // CRUD via api() mutations, then router.visit() to refresh page data
  async function createItem(payload: Record<string, unknown>): Promise<void> {
    const result = await api("/resource", { method: "POST", body: payload });
    if (result.success) router.visit("/resource", { preserveScroll: true });
  }

  async function updateItem(id: string, payload: Record<string, unknown>): Promise<void> {
    const result = await api(`/resource/${id}`, { method: "PUT", body: payload });
    if (result.success) router.visit("/resource", { preserveScroll: true });
  }

  async function deleteItem(id: string): Promise<void> {
    const result = await api(`/resource/${id}`, { method: "DELETE" });
    if (result.success) router.visit("/resource", { preserveScroll: true });
  }

  // ❌ NEVER use router.post/put/patch/delete — use api(path, { method, body }) instead
  // ❌ NEVER use window.location — bypasses Inertia, causes full page reload

  // Page navigation — use router.visit, never window.location
  function goToOtherPage(): void {
    router.visit("/other-page");
  }
</script>

<Header group="section-name" />

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
  <!-- page content -->
</div>
```

## CRITICAL: Pages vs Data

| Concept | How it works |
|---------|-------------|
| **Page props** | Passed by `res.inertia("PageName", { data })` in handler — includes lists, permissions, metadata |
| **Mutations** | `api(path, { method, body })` then `router.visit()` to refresh — NEVER `router.post/put/patch/delete` |
| **Navigation** | `router.visit('/path')` for Inertia page transitions — NEVER `window.location` or native `<a>` |

**Page handlers pass ALL data via `res.inertia()`** — including CRUD lists. After mutations, use `router.visit()` to reload the page with fresh data.

## HTTP Client: api() wrapper (native fetch)

All CRUD operations go through **`api()`** (native fetch wrapper). Do NOT use raw `fetch()` or `axios` in pages.

```typescript
// ✅ Correct — api() wrapper
import { api } from '$lib/api';

const result = await api('/posts/data', { showSuccessToast: false });
const result = await api('/posts', { method: 'POST', body: data });
const result = await api(`/posts/${id}`, { method: 'PUT', body: data });
const result = await api(`/posts/${id}`, { method: 'DELETE' });

// ❌ Wrong — raw fetch()/axios in pages bypasses CSRF + toast handling
```

CSRF: `api()` attaches `X-CSRF-Token` (from the `csrf_token` cookie) automatically for non-GET requests.

## Conventions

- Every page includes `<Header group="..." />`
- Svelte 5 runes: `let x = $state()`, `let y = $derived()`, `$effect(() => {...})` — NEVER `onMount`, NEVER `$:`
- Page props via `$props()` rune: `let { propName } = $props()` — NEVER `export let propName`
- User access: `$derived(inertiaPage.props.user as User)` — import `page as inertiaPage` from `@inertiajs/svelte`
- CRUD mutations: use `api(path, { method, body })` then `router.visit()` to refresh — NOT raw `fetch()`, NOT `router.post/put/patch/delete`
- Navigation: use `router.visit()` — NEVER `window.location` or native `<a>` for internal navigation
- CSRF: handled automatically by `api()` (`X-CSRF-Token` from cookie) — no manual header needed
- Auth pages don't include Header
- Component path: `../Components/ComponentName.svelte` (relative)
- Types from: `../types` (relative)
