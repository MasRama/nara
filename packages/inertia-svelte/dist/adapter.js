import { inertiaMiddleware } from "./middleware";
export function svelteAdapter(options = {}) {
    return {
        name: "svelte-inertia",
        middleware: () => {
            return inertiaMiddleware(options);
        },
        extendResponse: (res) => {
        },
    };
}
//# sourceMappingURL=adapter.js.map