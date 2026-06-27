---
authority: canon
owner: masrama
last_verified: 2026-06-28
trigger: Writing frontend pages, using Inertia.js navigation, or making API calls from Svelte
---

# Inertia Patterns (Frontend)

> **Authority:** canon — current source of truth for frontend Inertia.js patterns.

## When to use

Any time you write or modify a `.svelte` page or component that needs data from the server or navigates between pages.

## The Two Response Types (critical distinction)

| Route Type | Called By | Backend Returns | Frontend Uses |
|---|---|---|---|
| **Page** | Browser navigation | `res.inertia('pageName', { data })` | `$props()` |
| **Data** | `axios` from Svelte | `jsonSuccess()`, `jsonError()` | `api(() => axios.method())` |

**Never mix these.** A page route returns `res.inertia()`. A data route returns `jsonSuccess()`. The frontend page receives page props via `$props()`, and fetches list data via `axios` to a separate `/data` endpoint.

## HTTP Client: api() + axios (mandatory)

```svelte
<script lang="ts">
  import axios from 'axios';
  import { api } from '$lib/api';

  // GET - fetch data
  const result = await api(() => axios.get('/products/data'), { showSuccessToast: false });
  if (result.success) items = result.data;

  // POST - create
  const result = await api(() => axios.post('/products', payload));

  // PUT - update
  const result = await api(() => axios.put(`/products/${id}`, payload));

  // DELETE - remove
  const result = await api(() => axios.delete(`/products/${id}`));
</script>
```

The `api()` wrapper handles:
- Toast notifications (success/error)
- CSRF token injection
- Error response parsing

## Navigation

```svelte
<script lang="ts">
  import { router } from '@inertiajs/svelte';

  function goToDashboard() {
    router.visit('/dashboard');
  }

  // With options
  router.visit('/users', {
    preserveState: true,
    preserveScroll: true,
  });
</script>
```

## Receiving Inertia Props

```svelte
<script lang="ts">
  import { page as inertiaPage } from '@inertiajs/svelte';

  // Props passed by res.inertia("PageName", { users, permissions })
  let { users = [], permissions, total } = $props();

  // Current user from shared Inertia props
  const currentUser = $derived(inertiaPage.props.user as User | undefined);
</script>
```

## State Management (Svelte 5 Runes)

```svelte
<script lang="ts">
  let items = $state([]);                    // local state
  const filtered = $derived(items.filter()); // derived
  $effect(() => { loadData(); });            // side effect on mount/dep change
</script>
```

## Full Page Pattern

```svelte
<script lang="ts">
  import { fly } from 'svelte/transition';
  import { page as inertiaPage, router } from '@inertiajs/svelte';
  import Header from '../Components/Header.svelte';
  import axios from 'axios';
  import { api } from '$lib/api';
  import { Toast } from '$lib/toast';
  import type { Product } from '../types';
  import Button from '../Components/Button.svelte';

  interface Props {
    products?: Product[];
    total?: number;
    page?: number;
  }

  let { products = [], total = 0, page = 1 }: Props = $props();
  const currentUser = $derived(inertiaPage.props.user as User | undefined);

  let items = $state<Product[]>(products);
  let isLoading = $state(false);

  async function loadData(): Promise<void> {
    const result = await api(() => axios.get('/products/data'), { showSuccessToast: false });
    if (result.success) items = result.data;
  }

  async function createProduct(payload: object): Promise<void> {
    const result = await api(() => axios.post('/products', payload));
    if (result.success) await loadData();
  }

  function goTo(path: string): void {
    router.visit(path, { preserveScroll: true });
  }
</script>

<Header group="products" />

<div class="min-h-[100dvh] bg-background text-foreground font-body">
  <section class="px-6 sm:px-10 lg:px-16 pt-28 pb-16">
    <!-- page content -->
  </section>
</div>
```

## UI Components (Zag JS)

For interactive primitives (dialog, menu, switch, tabs), use Zag JS:

```svelte
<script lang="ts">
  import * as dialog from "@zag-js/dialog";
  import { useMachine, normalizeProps } from "@zag-js/svelte";

  const dialogService = useMachine(dialog.machine, { id: "my-dialog" });
  const dialogApi = $derived(dialog.connect(dialogService, normalizeProps));
</script>

<div {...dialogApi.getRootProps()}>
  <button {...dialogApi.getTriggerProps()}>Open</button>
  <div {...dialogApi.getBackdropProps()} />
  <div {...dialogApi.getPositionerProps()}>
    <div {...dialogApi.getContentProps()}>...</div>
  </div>
</div>
```

## Do / Don't

- **Do** use `api(() => axios.method(...))` for all HTTP — never raw `fetch()` or bare `axios`
- **Do** use `router.visit()` for page transitions
- **Do** use `$state`, `$derived`, `$effect`, `$props` — Svelte 5 runes
- **Do** fetch list data via separate `/data` endpoint with `axios` — don't pass large lists via `res.inertia()`
- **Do** use Zag JS for interactive UI primitives
- **Don't** use `router.post/put/patch/delete` — bypasses `api()` wrapper (no toast/CSRF)
- **Don't** use `window.location` or `window.location.href` — causes full page reload
- **Don't** use `<a href="/path">` with `target="_self"` for internal navigation — let Inertia handle it
- **Don't** use `onMount`, `$:`, or `export let` — Svelte 5 runes replace them
- **Don't** use `console.log` in frontend — use `Logger` (backend) or `Toast` (user-facing)
