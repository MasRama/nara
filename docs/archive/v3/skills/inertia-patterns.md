---
trigger: Never load for v3; historical v2 Inertia/Svelte reference only
status: superseded-v2
superseded_by: V3_SPEC.md §7 Frontend; vue-patterns.md
---

# Inertia Patterns (Superseded — v2)

> **Superseded for Nara v3.** This file is retained as historical v2 context only. Do not use its Inertia, Svelte, or Bits UI instructions for v3 work. Use [`vue-patterns.md`](./vue-patterns.md) and [`V3_SPEC.md`](../../V3_SPEC.md) instead.


## When to use

Any time you write or modify a `.svelte` page or component that needs data from the server or navigates between pages.

## The Two Response Types (critical distinction)

| Route Type | Called By | Backend Returns | Frontend Uses |
|---|---|---|---|
| **Page** | Browser navigation | `res.inertia('pageName', { data })` | `$props()` |
| **Data** | `api()` from Svelte | `jsonSuccess()`, `jsonError()` | `api(path, { method, body })` |

**Never mix these.** A page route returns `res.inertia()`. A data route returns `jsonSuccess()`. The frontend page receives page props via `$props()`, and fetches list data via `api()` to a separate `/data` endpoint.

## HTTP Client: api() wrapper (native fetch, mandatory)

```svelte
<script lang="ts">
  import { api } from '$lib/api';

  // GET - fetch data
  const result = await api('/products/data', { showSuccessToast: false });
  if (result.success) items = result.data;

  // POST - create
  const result = await api('/products', { method: 'POST', body: payload });

  // PUT - update
  const result = await api(`/products/${id}`, { method: 'PUT', body: payload });

  // DELETE - remove
  const result = await api('/products', { method: 'DELETE', body: { ids: [id] } });
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
    const result = await api('/products/data', { showSuccessToast: false });
    if (result.success) items = result.data;
  }

  async function createProduct(payload: object): Promise<void> {
    const result = await api('/products', { method: 'POST', body: payload });
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

## UI Components (Bits UI)

For interactive primitives (dialog, menu, switch, tabs), use [Bits UI](https://www.bits-ui.com/) — headless, Svelte 5 native:

```svelte
<script lang="ts">
  import { Dialog } from "bits-ui";
  let open = $state(false);
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
    <Dialog.Content class="bg-background fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 ...">
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description>...</Dialog.Description>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

Other primitives: `DropdownMenu` (user menus), `Switch` (toggles), `Tabs` (tab navigation). State via props (`open`/`onOpenChange`, `checked`/`onCheckedChange`, `value`/`onValueChange`) or `bind:` the state prop. Style with Tailwind — Bits provides behavior + ARIA only.

## Do / Don't

- **Do** use `api(path, { method, body })` for all HTTP — never raw `fetch()` or `axios` in components
- **Do** use `router.visit()` for page transitions
- **Do** use `$state`, `$derived`, `$effect`, `$props` — Svelte 5 runes
- **Do** fetch list data via separate `/data` endpoint with `api()` — don't pass large lists via `res.inertia()`
- **Do** use Bits UI for interactive UI primitives
- **Don't** use `router.post/put/patch/delete` — bypasses `api()` wrapper (no toast/CSRF)
- **Don't** use `window.location` or `window.location.href` — causes full page reload
- **Don't** use `<a href="/path">` with `target="_self"` for internal navigation — let Inertia handle it
- **Don't** use `onMount`, `$:`, or `export let` — Svelte 5 runes replace them
- **Don't** use `console.log` in frontend — use `Logger` (backend) or `Toast` (user-facing)
