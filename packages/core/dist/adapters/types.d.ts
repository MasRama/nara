import type { MiddlewareNext } from "hyper-express";
import type { NaraRequest, NaraResponse } from "../types";
export type AdapterMiddlewareHandler = (req: NaraRequest, res: NaraResponse, next: MiddlewareNext) => unknown | Promise<unknown>;
export interface FrontendAdapter {
    name: string;
    middleware: () => AdapterMiddlewareHandler;
    extendResponse: (res: NaraResponse) => void;
}
//# sourceMappingURL=types.d.ts.map