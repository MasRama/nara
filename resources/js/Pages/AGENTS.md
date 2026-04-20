# Pages

## Overview

Inertia.js pages rendered by Svelte 5. Each page is a route destination — the server renders the page shell, the page fetches its data via separate JSON endpoints.

## Structure

| File | Purpose |
|------|---------|
| `dashboard.svelte` | Admin dashboard with stats |
| `landing.svelte` | Public landing page |
| `profile.svelte` | User profile + password change |
| `users.svelte` | User management (CRUD table) |
| `auth/login.svelte` | Login form |
| `auth/register.svelte` | Registration form |
| `auth/forgot-password.svelte` | Forgot password |
| `auth/reset-password.svelte` | Password reset |

## Page Pattern (Svelte 5 + Inertia + axios)

```svelte
<script lang="ts">
  import { page as inertiaPage, router } from "@inertiajs/svelte";
  import axios from "axios";
  import Header from "../Components/Header.svelte";
  import { api, Toast } from "../Components/helper";
  import type { User } from "../types";

  // Props from server (passed by res.inertia("PageName", { prop }))
  let { someServerProp } = $props();

  // Current user from Inertia shared props
  const currentUser = $derived(inertiaPage.props.user as User | undefined);

  // Local UI state
  let items = $state<ItemType[]>([]);
  let loading = $state(false);

  // Fetch data from JSON endpoint (called by fetch() pattern — use axios)
  async function loadData(): Promise<void> {
    loading = true;
    const result = await api(() => axios.get("/resource/data"), { showSuccessToast: false });
    if (result.success) items = result.data as ItemType[];
    loading = false;
  }

  // CRUD via axios (NOT router.visit, NOT raw fetch)
  async function createItem(payload: Record<string, unknown>): Promise<void> {
    const result = await api(() => axios.post("/resource", payload));
    if (result.success) await loadData();
    // Toast shown automatically by api()
  }

  async function updateItem(id: string, payload: Record<string, unknown>): Promise<void> {
    const result = await api(() => axios.put(`/resource/${id}`, payload));
    if (result.success) await loadData();
  }

  async function deleteItem(id: string): Promise<void> {
    const result = await api(() => axios.delete(`/resource/${id}`));
    if (result.success) await loadData();
  }

  // Page navigation — use router.visit, never fetch/axios
  function goToOtherPage(): void {
    router.visit("/other-page");
  }

  $effect(() => {
    loadData();
  });
</script>

<Header group="section-name" />

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
  <!-- page content -->
</div>
```

## CRITICAL: Pages vs Data

| Concept | How it works |
|---------|-------------|
| **Page props** | Passed by `res.inertia("PageName", { prop })` in controller — static, server-side |
| **CRUD data** | Fetched via `api(() => axios.get('/resource/data'))` from a JSON endpoint — dynamic, client-side |
| **Navigation** | `router.visit('/path')` for Inertia page transitions |
| **Mutations** | `api(() => axios.post/put/delete('/resource', ...))` for create/update/delete |

**NEVER** pass CRUD list data from `res.inertia()` — it gets stale. Always fetch via a separate JSON endpoint.

## HTTP Client: axios (NOT fetch)

All CRUD operations use **axios** wrapped in `api()`. Do NOT use raw `fetch()` for mutations.

```typescript
// ✅ Correct — axios via api() wrapper
import axios from 'axios';
import { api } from '../Components/helper';

const result = await api(() => axios.post('/posts', data));
const result = await api(() => axios.put(`/posts/${id}`, data));
const result = await api(() => axios.delete(`/posts/${id}`));
const result = await api(() => axios.get('/posts/data'), { showSuccessToast: false });

// ❌ Wrong — raw fetch() won't work with api() wrapper
const result = await api(() => fetch('/posts', { method: 'POST', body: ... })); // api() expects axios response shape { data: ... }
```

CSRF is handled automatically via `configureAxiosCSRF(axios)` called once in `app.js`.

## Conventions

- Every page includes `<Header group="..." />`
- Svelte 5 runes: `let x = $state()`, `let y = $derived()`, `$effect(() => {...})` — NEVER `onMount`, NEVER `$:`
- Page props via `$props()` rune: `let { propName } = $props()` — NEVER `export let propName`
- User access: `$derived(inertiaPage.props.user as User)`
- CRUD mutations: use `api(() => axios.method(...))` — NOT raw `fetch()`
- CSRF: handled automatically by `configureAxiosCSRF(axios)` in `app.js` — no manual header needed
- Auth pages don't include Header
- Component path: `../Components/ComponentName.svelte` (relative)
- Types from: `../types` (relative)
