import HyperExpress from 'hyper-express';
import type { NaraHandler } from './types';
export interface RouterOptions {
    prefix?: string;
}
export declare class NaraRouter {
    private router;
    private prefix;
    constructor(prefix?: string);
    get(path: string, ...handlers: NaraHandler[]): this;
    post(path: string, ...handlers: NaraHandler[]): this;
    put(path: string, ...handlers: NaraHandler[]): this;
    patch(path: string, ...handlers: NaraHandler[]): this;
    delete(path: string, ...handlers: NaraHandler[]): this;
    group(callback: (router: NaraRouter) => void): this;
    getRouter(): HyperExpress.Router;
}
export declare function createRouter(prefix?: string): NaraRouter;
//# sourceMappingURL=Router.d.ts.map