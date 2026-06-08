import type { FrontendAdapter, AdapterMiddlewareHandler } from "./types";
import type { NaraRequest, NaraResponse } from "../types";
import inertiaMiddleware from "../../middlewares/inertia";

export function svelteAdapter(): FrontendAdapter {
  return {
    name: "svelte-inertia",

    middleware: (): AdapterMiddlewareHandler => {
      return inertiaMiddleware();
    },

    extendResponse: (res: NaraResponse): void => {
    },
  };
}
