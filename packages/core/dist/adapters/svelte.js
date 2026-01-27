"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.svelteAdapter = svelteAdapter;
const inertia_1 = __importDefault(require("../../middlewares/inertia"));
function svelteAdapter() {
    return {
        name: "svelte-inertia",
        middleware: () => {
            return (0, inertia_1.default)();
        },
        extendResponse: (res) => {
        },
    };
}
//# sourceMappingURL=svelte.js.map