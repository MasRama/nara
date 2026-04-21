# resources/js - Svelte 5 Frontend

## OVERVIEW

Svelte 5 frontend powered by Inertia.js for server-side rendering with client-side hydration.

## STRUCTURE

```
resources/js/
├── Components/       # Reusable UI components
│   ├── Can.svelte         # Auth gating wrapper
│   ├── DarkModeToggle.svelte
│   ├── Header.svelte      # Top navigation
│   ├── NaraIcon.svelte    # Logo SVG
│   ├── Pagination.svelte  # List pagination
│   ├── UserModal.svelte   # User form modal
│   └── helper.ts          # API utils, CSRF, Toast
├── Pages/            # Route pages (dashboard, landing, profile, users, auth/*)
├── types/            # TypeScript definitions and generated types
└── app.js            # Inertia app initialization
```

## FRAMEWORK

- **Svelte 5** with runes: `$state`, `$derived`, `$effect` for reactivity
- **Inertia.js** adapter for SSR + client navigation via `router` helper
- **TypeScript** for type safety (`<script lang="ts">`)

## KEY PATTERNS

### Receiving Inertia Props (from controller)

```svelte
<script lang="ts">
  // Props passed by res.inertia("PageName", { user, count })
  let { user, count } = $props();
</script>
```

### Fetching CRUD Data (from JSON endpoints)

```svelte
<script lang="ts">
  import { buildCSRFHeaders } from '$lib/csrf';

  let items = $state([]);

  async function loadItems() {
    const res = await fetch("/items/data");
    const json = await res.json();
    items = json.data;
  }

  async function createItem(data) {
    await fetch("/items", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...buildCSRFHeaders() },
      body: JSON.stringify(data),
    });
    await loadItems();
  }
</script>
```

### Navigation (between pages)

```svelte
<script lang="ts">
  import { router } from "@inertiajs/svelte";

  function goToDashboard() {
    router.visit("/dashboard");
  }
</script>
```

## CONVENTIONS

- Components use `.svelte` extension with `<script lang="ts">`
- Entry point is `app.js` (JavaScript, not TypeScript)
- State management via `$state()` runes — avoid legacy stores
- **CRUD data**: always `fetch()` from JSON endpoint — never pass via `res.inertia()`
- **Navigation**: use `router.visit()` for page transitions
- **CSRF**: use `buildCSRFHeaders()` from `helper.ts` for all mutating requests
- Authorization component `<Can />` wraps gated UI sections
- Dark mode: `dark:` Tailwind prefix on all elements
- Types in `types/index.ts` and auto-generated `types/generated.ts`
