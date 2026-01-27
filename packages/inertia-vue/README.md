# @nara/inertia-vue

Vue 3 + Inertia.js adapter for the NARA framework.

## Installation

```bash
pnpm add @nara/inertia-vue @inertiajs/vue3 vue
```

## Usage

### Server-side

Register the Vue adapter in your NARA application:

```typescript
// app/index.ts or server.ts
import { vueAdapter } from '@nara/inertia-vue';

const app = new Nara({
  adapter: vueAdapter({
    rootView: 'inertia.html',
  }),
});
```

### Client-side

Initialize the Inertia app in your client entry point:

```typescript
// resources/js/app.ts
import { initInertiaApp } from '@nara/inertia-vue';

initInertiaApp({
  resolve: (name) => import(`./pages/${name}.vue`),
});
```

### Vite Configuration

Use the provided helper to configure Vite:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { createViteConfig } from '@nara/inertia-vue';

export default defineConfig(
  createViteConfig()
);
```

## License

MIT
