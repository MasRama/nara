# @nara/inertia-svelte

Svelte 5 + Inertia.js adapter for the NARA framework.

## Installation

```bash
npm install @nara/inertia-svelte
```

## Usage

### 1. Register the Adapter

In your Nara application entry point (e.g., `app/index.ts` or `server.ts`):

```typescript
import { Nara } from '@nara/core';
import { svelteAdapter } from '@nara/inertia-svelte';

const app = new Nara({
  adapter: svelteAdapter({
    title: 'My Nara App',
    version: '1.0.0'
  })
});

app.start();
```

### 2. Configure Vite

In your `vite.config.ts`:

```typescript
import { createViteConfig } from '@nara/inertia-svelte';

export default createViteConfig({
  root: 'resources',
  outDir: '../dist'
});
```

### 3. Using in Controllers

```typescript
export const index = async (req, res) => {
  return res.inertia('Home', {
    message: 'Welcome to NARA!'
  });
};
```

## Features

- **Standardized Inertia Protocol**: Handles `X-Inertia` headers, versioning, and JSON/HTML response switching automatically.
- **Svelte 5 Support**: Optimized for the latest Svelte version.
- **Vite Helper**: Pre-configured Vite settings for NARA directory structure.
- **Automatic Assets Rewriting**: In development mode, automatically rewrites asset paths to point to the Vite dev server.

## License

MIT
