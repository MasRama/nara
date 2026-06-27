import type { FrontendAdapter, AdapterMiddlewareHandler } from "./types";
import renderer from "../../middlewares/renderer";

export function svelteAdapter(): FrontendAdapter {
  return {
    name: "svelte-inertia",

    middleware: (): AdapterMiddlewareHandler => {
      return renderer();
    },
  };
}
