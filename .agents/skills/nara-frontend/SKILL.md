---
name: nara-frontend
description: Writing Vue pages, components, composables, or frontend API clients in Nara v3
---

# Frontend Patterns (Vue 3 + Vite + Router)

How to build browser UI on the fixed Vue 3 + Vite + TypeScript stack with
`vue-router`. Feature-specific browser code belongs to the owning Feature:

```text
src/features/<feature>/web/
├── pages/*.vue
├── components/*.vue
├── composables/*.ts
└── client.ts
```

Application-wide Vue composition belongs under `src/app/`. Keep
`resources/app.ts` as a thin Vite entrypoint that mounts the app-layer
root component. A Feature may omit `web/` when it has no browser surface.

## Application bootstrap

```typescript
// resources/app.ts
import { createApp } from 'vue';
import App from '../src/app/App.vue';
import router from '../src/app/router';

createApp(App).use(router).mount('#app');
```

Use Vue Composition API in single-file components:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';

const open = ref(false);
const label = computed(() => (open.value ? 'Close' : 'Open'));
</script>
```

Use `ref`, `computed`, `watch`, `onMounted`, and `onBeforeUnmount` for
state and lifecycle behavior.

## API clients and responses

Prefer the feature-scoped typed client in the owning Feature's
`web/client.ts`:

```typescript
const response = await authClient.login({ email, password });
if (!response.success) {
  errorMessage.value = response.message;
}
```

Keep request and response types in the Feature contract. Handle loading,
validation, and error state in the page or a Feature-owned composable:
disable the submit control while pending, render field errors from the
contract's error shape, and clear stale errors on input.

Every state-changing `/api/*` request must satisfy the application's
double-submit CSRF middleware. Provider-owned Auth clients may use Auth's CSRF
helpers directly. A reusable Feature must stay provider-neutral: declare the
CSRF capability on its web host and inject it into the typed client, following
`UsersWebHost.csrf` + `createUsersClient({ csrf })`. Do not import Auth web
internals merely to obtain a CSRF token.

Cross-feature browser code uses public Feature exports from
`web/index.ts` — never another Feature's `server/` implementation,
database access, Node-only built-ins, or server-only packages. Never
export server-only symbols through `web/index.ts`.

## Navigation

The canonical browser router lives in `src/app/router.ts` (Vue Router via the
`vue-router` package, `createWebHistory`). App-owned pages sit under
`src/app/pages/`; direct Feature pages are composed through the owning
Feature's `web/index.ts` barrel — never a deep page import. Reusable Feature
assemblies may instead install an application-owned route array under
`src/app/bindings/` (for example `users.web.ts`) which the canonical router
explicitly imports/spreads:

```typescript
import { LoginPage } from '@/features/auth/web';

{ path: '/login', name: 'login', component: LoginPage, meta: { guestOnly: true } },
```

Route guards (`requiresAuth`, `requiresPermission`) are UX only; the Hono
route stays authoritative. In pages, navigate with `<RouterLink>` or
`useRouter()` — not `window.location`.

## UI and accessibility

Use native Vue elements and Tailwind classes by default. Interactive
controls need an accessible name, keyboard behavior, a visible focus
state, and correct disabled/loading state.

## Do / Don't

- **Do** use `<script setup lang="ts">` and direct Vue Composition API state.
- **Do** keep feature pages, components, and composables under the owning Feature's `web/` directory.
- **Do** use feature-scoped typed clients and contracts for API calls.
- **Don't** import another Feature's server internals from browser code.
- **Don't** hide authorization in the UI; server routes remain authoritative.
- **Don't** add a global frontend abstraction to conceal Vue or Hono.
