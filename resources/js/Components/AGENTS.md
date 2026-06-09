# Components

## Overview

Reusable Svelte 5 UI components shared across pages. All use TypeScript and Tailwind CSS with dark mode support.

## Structure

| File | Purpose |
|------|---------|
| `Badge.svelte` | Inline status/label badge |
| `Button.svelte` | Reusable button with variant support |
| `Can.svelte` | Authorization wrapper — shows/hides content based on user permissions/roles |
| `DarkModeToggle.svelte` | Dark mode toggle, persists to localStorage |
| `Header.svelte` | Top navigation bar with user menu (Zag JS menu + dialog) |
| `Input.svelte` | Styled text input |
| `Label.svelte` | Form label |
| `NaraIcon.svelte` | Logo/icon SVG component |
| `Pagination.svelte` | Page navigation for paginated lists |
| `RoleModal.svelte` | Modal for create/edit role form (Zag JS dialog) |
| `Switch.svelte` | Toggle switch (Zag JS switch) |
| `UserModal.svelte` | Modal for create/edit user form (Zag JS dialog) |

## $lib/* Exports (replaces helper.ts)

```typescript
import { api } from '$lib/api';
import type { ApiResponse } from '$lib/api';
import { buildCSRFHeaders, getCSRFToken, configureAxiosCSRF } from '$lib/csrf';
import { Toast } from '$lib/toast';
import { debounce } from '$lib/utils/debounce';
import { password_generator } from '$lib/utils/password';
import { clickOutside } from '$lib/hooks/click-outside';
```

### `api()` — axios wrapper with auto-toast

> ⚠️ `api()` wraps **axios** calls, NOT `fetch()`. The callback must return an axios promise.

```typescript
import axios from 'axios';
import { api } from '$lib/api';

// POST
const result = await api(() => axios.post('/users', payload));

// PUT
const result = await api(() => axios.put(`/users/${id}`, payload));

// DELETE
const result = await api(() => axios.delete('/users', { data: { ids: [id] } }));

// GET (suppress success toast)
const result = await api(() => axios.get('/users/data'), { showSuccessToast: false });

// result is ApiResponse<T>
if (result.success) {
  console.log(result.data);    // response payload
} else {
  console.log(result.errors);  // validation errors Record<string, string[]>
  // Toast already shown automatically
}
```

`api()` automatically shows/hides Toasts — pass `{ showSuccessToast: false }` or `{ showErrorToast: false }` to suppress.

### `Toast()` — notification function

> ⚠️ `Toast` is a **function**, NOT an object. Do NOT use `Toast.success()` — it will throw `TypeError`.

```typescript
Toast("User created!", "success");   // ✅ correct
Toast("Something went wrong", "error");
Toast("Please wait...", "info");
Toast("Check your input", "warning");

// Toast.success("msg") — ❌ WRONG: TypeError: Toast.success is not a function
```

Signature: `Toast(text: string, type: 'success' | 'error' | 'warning' | 'info' = 'success', duration?: number)`

### CSRF helpers

```typescript
// For axios — call ONCE at app init (in app.js), NOT per-request
import axios from 'axios';
import { configureAxiosCSRF } from '$lib/csrf';
configureAxiosCSRF(axios);  // sets interceptor — CSRF auto-included in POST/PUT/DELETE

// For manual fetch() (rare — prefer axios + configureAxiosCSRF)
const headers = buildCSRFHeaders();  // { 'X-CSRF-Token': '...' } or {}
```

### Other utilities

```typescript
// Click outside action for modals/dropdowns
<div use:clickOutside on:click_outside={closeModal}>

// Debounce for search inputs
const debouncedSearch = debounce((term: string) => loadData(term), 300);

// Password generator
const pwd = password_generator(12); // 12-char random password string
```

## Can Component

Accepts `permission` OR `role` prop. Admin bypasses all checks.

```svelte
<Can permission="users.edit">
  <button>Edit User</button>
</Can>

<Can role="admin">
  <button>Admin Only</button>
</Can>
```

## Pagination Component

Takes a `meta: PaginationMeta` prop (from server). Handles navigation via `router.visit()`.

```svelte
<Pagination meta={paginationMeta} />
```

## Zag JS Components

Interactive UI components use [Zag JS](https://zagjs.com/) — a headless, framework-agnostic state machine library. Zag provides behavior; styling is done with Tailwind.

**Installed packages:** `@zag-js/dialog`, `@zag-js/menu`, `@zag-js/pagination`, `@zag-js/switch`, `@zag-js/tabs`, `@zag-js/svelte`

### Pattern

Every Zag JS component follows the same 3-step pattern:

```svelte
<script lang="ts">
  // 1. Import the machine + Svelte adapter
  import * as dialog from "@zag-js/dialog";
  import { useMachine, normalizeProps, portal } from "@zag-js/svelte";

  // 2. Connect the machine to Svelte reactivity
  const service = useMachine(dialog.machine, { id: crypto.randomUUID() });
  const api = $derived(dialog.connect(service, normalizeProps));
</script>

<!-- 3. Spread props onto elements -->
<div {...api.getPositionerProps()}>
  <div {...api.getContentProps()}>
    <button {...api.getCloseTriggerProps()}>Close</button>
  </div>
</div>
```

### Which components use Zag JS

| Component | Zag Package | Used For |
|-----------|-------------|----------|
| `Header.svelte` | `@zag-js/menu` + `@zag-js/dialog` | User dropdown menu + logout confirmation |
| `UserModal.svelte` | `@zag-js/dialog` | Create/edit user modal |
| `RoleModal.svelte` | `@zag-js/dialog` | Create/edit role modal |
| `Switch.svelte` | `@zag-js/switch` | Toggle switch (e.g. active/inactive) |
| `profile.svelte` (page) | `@zag-js/tabs` | Profile tab navigation |

### Rules

- **Always** use `crypto.randomUUID()` for the machine `id` (required by Zag)
- **Always** derive the API: `const api = $derived(xxx.connect(service, normalizeProps))`
- **Always** spread Zag props onto elements: `{...api.getRootProps()}`
- Use `portal` from `@zag-js/svelte` for dialogs/menus that need portal rendering
- Style with Tailwind — Zag provides no styles, only behavior + ARIA attributes
- Access state via `api.*` (e.g. `api.checked`, `api.open`) — never reach into the service directly

## Svelte 5 Component Pattern

```svelte
<script lang="ts">
  import { fly, fade } from "svelte/transition";
  import type { SomeType } from "../types";

  // Props — Svelte 5 runes syntax (NOT "export let prop")
  let { prop, optional = "default" }: { prop: SomeType; optional?: string } = $props();

  let localState = $state(initialValue);
  let derived = $derived(someComputation);

  $effect(() => {
    // replaces onMount + $: reactive — runs after mount and on dep change
    return () => { /* cleanup */ };
  });

  function handleAction(): void {
    // logic
  }
</script>

<div class="bg-background text-foreground" transition:fade={{ duration: 200 }}>
  <!-- content -->
</div>
```

## Conventions

- **Svelte 5 runes**: `$state`, `$derived`, `$effect`, `$props()` — NEVER use `export let`, `writable()` stores, or `onMount`
- `<script lang="ts">` on all components
- Tailwind classes with `dark:` variant for dark mode
- Transitions from `svelte/transition` (fly, fade, scale)
- **Interactive components**: Use Zag JS (`@zag-js/*`) for dialogs, menus, switches, tabs — NOT raw HTML or custom implementations
- Authorization: use `<Can>` component, never manual role checks in templates
- CRUD mutations: use `api(() => axios.method(...))` — NOT raw `fetch()`
- CSRF for axios: `configureAxiosCSRF(axios)` called once in `app.js` — interceptor handles all requests automatically
- All component files `.svelte` extension (no `.js` components)
