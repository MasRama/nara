import type { FrontendAdapter } from './types';
import { inertiaMiddleware, type VueAdapterOptions } from './middleware';

/**
 * Vue 3 adapter for Inertia.js
 *
 * Provides Inertia.js support for Vue 3 components.
 */
export function vueAdapter(options: VueAdapterOptions = {}): FrontendAdapter {
  return {
    name: 'vue-inertia',

    /**
     * Factory that returns the adapter's global middleware
     */
    middleware: () => inertiaMiddleware(options),

    /**
     * Method called during app initialization to extend the NaraResponse
     */
    extendResponse: (_res) => {
      // Logic is handled in middleware for now, but we could add
      // Vue-specific response extensions here if needed.
    }
  };
}

export type { VueAdapterOptions };
