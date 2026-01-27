import type { FrontendAdapter, NaraMiddleware, NaraResponse } from "@nara-web/core";
import { inertiaMiddleware, type InertiaConfig } from "./middleware";

/**
 * Options for the Svelte Inertia adapter
 */
export interface SvelteAdapterOptions extends InertiaConfig {}

/**
 * Svelte adapter for Inertia.js in NARA
 *
 * @param options - Configuration for the Inertia middleware
 * @returns A FrontendAdapter instance
 */
export function svelteAdapter(options: SvelteAdapterOptions = {}): FrontendAdapter {
  return {
    name: "svelte-inertia",

    /**
     * Returns the Inertia middleware handler
     */
    middleware: (): NaraMiddleware => {
      return inertiaMiddleware(options) as unknown as NaraMiddleware;
    },

    /**
     * Extension point for the response object
     * Note: The middleware itself attaches the .inertia() method to the response,
     * but we keep this for adapter compatibility.
     */
    extendResponse: (res: NaraResponse): void => {
      // res.inertia is handled by the middleware logic
    },
  };
}
