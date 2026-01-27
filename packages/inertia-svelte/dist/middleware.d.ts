import type { NaraRequest, NaraResponse } from "@nara/core";
export interface InertiaConfig {
    version?: string;
    rootView?: string;
    title?: string;
}
export declare const inertiaMiddleware: (config?: InertiaConfig) => (req: NaraRequest, res: NaraResponse, next: () => void) => void;
export default inertiaMiddleware;
//# sourceMappingURL=middleware.d.ts.map