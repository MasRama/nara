# resources/js - Svelte 5 Frontend

## OVERVIEW

Svelte 5 frontend powered by Inertia.js for server-side rendering with client-side hydration.

**Related docs:**
- [`Pages/AGENTS.md`](./Pages/AGENTS.md) - Page component patterns
- [`Components/AGENTS.md`](./Components/AGENTS.md) - Reusable components
- [`types/AGENTS.md`](./types/AGENTS.md) - TypeScript type definitions
- [`../../routes/AGENTS.md`](../../routes/AGENTS.md) - Backend route definitions
- [`../../app/AGENTS.md`](../../app/AGENTS.md) - Backend handlers & services

## STRUCTURE

```
resources/js/
├── app.js                 # Inertia app initialization (entry point)
├── lib/                   # Utilities & UI components
│   ├── api.ts             # HTTP client wrapper (axios + toast)
│   ├── csrf.ts            # CSRF token handling
│   ├── toast.ts           # Toast notifications (svelte-sonner)
│   ├── utils.ts           # Helper functions (cn, debounce, etc)
│   └── components/ui/     # shadcn-svelte UI components
├── Components/            # Reusable UI components (Header, Pagination, etc)
├── Pages/                 # Route pages (dashboard, users, auth/*)
└── types/                 # TypeScript definitions
```

## FRAMEWORK

- **Svelte 5** with runes: `$state`, `$derived`, `$effect` for reactivity
- **Inertia.js** adapter for SSR + client navigation via `router` helper
- **TypeScript** for type safety (`<script lang="ts">`)
- **axios** for HTTP requests (wrapped in `api()` helper)

## KEY PATTERNS

### HTTP Client: axios + api() wrapper

**ALWAYS use `api()` wrapper with axios** for all CRUD operations. This handles:
- Toast notifications (success/error)
- CSRF token injection
- Error response parsing

```svelte
<script lang="ts">
  import axios from 'axios';
  import { api } from '$lib/api';

  // ✅ GET - fetch data
  const result = await api(() => axios.get('/posts/data'), { showSuccessToast: false });
  if (result.success) items = result.data;

  // ✅ POST - create
  const result = await api(() => axios.post('/posts', payload));

  // ✅ PUT - update
  const result = await api(() => axios.put(`/posts/${id}`, payload));

  // ✅ DELETE - remove
  const result = await api(() => axios.delete(`/posts/${id}`));

  // ❌ NEVER use raw fetch() - won't work with api() wrapper
  // ❌ NEVER use axios directly without api() wrapper - no toast/CSRF handling
</script>
```

### Receiving Inertia Props (from controller)

```svelte
<script lang="ts">
  import { page as inertiaPage } from "@inertiajs/svelte";

  // Props passed by res.inertia("PageName", { user, count })
  let { user, count } = $props();

  // Access current user from shared Inertia props
  const currentUser = $derived(inertiaPage.props.user as User | undefined);
</script>
```

### Navigation (between pages)

```svelte
<script lang="ts">
  import { router } from "@inertiajs/svelte";

  // Navigate to another Inertia page (NOT for CRUD)
  function goToDashboard() {
    router.visit("/dashboard");
  }

  // With options
  router.visit("/users", {
    preserveState: true,
    preserveScroll: true
  });
</script>
```

## API Response Shape

The `api()` wrapper expects this response format from backend:

```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  code?: string;
  errors?: Record<string, string[]>;  // validation errors
}
```

This matches the backend response helpers: `jsonSuccess`, `jsonCreated`, `jsonPaginated`, `jsonError`, `jsonValidationError`.

## CONVENTIONS

- **HTTP client**: Always `api(() => axios.method(...))` — never raw `fetch()` or bare `axios`
- **CSRF**: Auto-handled by `configureAxiosCSRF(axios)` in `app.js` — no manual headers needed
- **Components**: Use `.svelte` extension with `<script lang="ts">`
- **Entry point**: `app.js` (JavaScript, not TypeScript)
- **State management**: Use `$state()` runes — avoid legacy stores
- **CRUD data**: Always fetch via `api(() => axios.get(...))` — never pass via `res.inertia()`
- **Navigation**: Use `router.visit()` for page transitions
- **Authorization**: `<Can permission="users.edit">` component wraps gated UI sections
- **Dark mode**: Use `dark:` Tailwind prefix on all elements
- **Types**: Import from `$lib/types` or `../types` (relative)
- **UI components**: Use shadcn-svelte from `$lib/components/ui/`
