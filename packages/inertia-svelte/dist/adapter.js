"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.svelteAdapter = svelteAdapter;
const middleware_1 = require("./middleware");
function svelteAdapter(options = {}) {
    return {
        name: "svelte-inertia",
        middleware: () => {
            return (0, middleware_1.inertiaMiddleware)(options);
        },
        extendResponse: (res) => {
        },
    };
}
//# sourceMappingURL=adapter.js.map