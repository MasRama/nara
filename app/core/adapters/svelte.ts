import type { FrontendAdapter, AdapterMiddlewareHandler } from "./types";
import type { NaraRequest, NaraResponse } from "../types";
import inertiaMiddleware from "../../middlewares/inertia";

/**
 * Svelte adapter for Inertia.js
 *
 * Provides Inertia.js support for Svelte components.
 */
export function svelteAdapter(): FrontendAdapter {
  return {
    name: "svelte-inertia",

    /**
     * Use the existing inertia middleware
     */
    middleware: (): AdapterMiddlewareHandler => {
      return inertiaMiddleware() as unknown as AdapterMiddlewareHandler;
    },

    /**
     * Extend response with inertia method
     * Note: The current inertia middleware already adds res.inertia,
     * but we provide this for consistency and future-proofing.
     */
    extendResponse: (res: NaraResponse): void => {
      // If the middleware didn't already add it (though it does),
      // we could add a placeholder or a secondary implementation here.
      // For now, it's handled by the middleware logic in app/middlewares/inertia.ts
    },
  };
}
