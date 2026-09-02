---
trigger: Writing Vue pages, components, composables, or frontend API clients in Nara v3
status: active-v3
---

# Vue Patterns (Frontend)

## When to use

Load this skill when adding or modifying browser code in Nara v3. The frontend stack is intentionally fixed to Vue 3 + Vite + TypeScript.

## Ownership

Feature-specific browser code belongs to the owning Feature:

```text
src/features/<feature>/web/
├── pages/*.vue
├── components/*.vue
├── composables/*.ts
└── client.ts
```

Application-wide Vue composition belongs under `src/app/`. Keep `resources/app.ts` as a thin Vite entrypoint that mounts the app-layer root component. A Feature may omit `web/` when it has no browser surface.

Cross-feature browser code uses public Feature exports. Never import another Feature's `server/` implementation, database access, Node-only built-ins, or server-only packages.

## Application bootstrap

```typescript
// resources/app.ts
import { createApp } from 'vue';
import App from '../src/app/App.vue';

createApp(App).mount('#app');
```

Use Vue Composition API in single-file components:

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';

const open = ref(false);
const label = computed(() => (open.value ? 'Close' : 'Open'));
</script>
```

Use `ref`, `computed`, `watch`, `onMounted`, and `onBeforeUnmount` for state and lifecycle behavior. Keep application-wide concerns in `src/app/`; keep capability-specific behavior in its Feature.

## API clients and responses

Prefer the feature-scoped typed client in the owning Feature's `web/client.ts`:

```typescript
const response = await authClient.login({ email, password });
if (!response.success) {
  errorMessage.value = response.message;
}
```

Keep request and response types in the Feature contract. Handle loading, validation, and error state in the page or a Feature-owned composable. Do not create a global RPC type or a Nara frontend transport abstraction.

## Navigation

Use ordinary links for browser navigation unless a later specification adds a router:

```html
<a href="/dashboard">Dashboard</a>
```

Do not add Inertia navigation, server-rendered page props, or a second routing framework. SSR is out of scope unless a later specification explicitly enables it.

## UI and accessibility

Use native Vue elements and Tailwind classes by default. Interactive controls must provide an accessible name, keyboard behavior, visible focus state, and correct disabled/loading state. Keep styling decisions in the existing Tailwind/CSS system. Do not add a Svelte-only primitive library or build a custom Nara UI framework.

## Do / Don't

- **Do** use `<script setup lang="ts">` and direct Vue Composition API state.
- **Do** keep feature pages, components, and composables under the owning Feature's `web/` directory.
- **Do** use feature-scoped typed clients and contracts for API calls.
- **Do** preserve useful existing behavior while changing only the framework implementation.
- **Don't** add React, Svelte, Nuxt, Inertia, SSR, or multi-framework dependencies.
- **Don't** import another Feature's server internals from browser code.
- **Don't** hide authorization in the UI; server routes remain authoritative.
- **Don't** add a global frontend abstraction to conceal Vue or Hono.
