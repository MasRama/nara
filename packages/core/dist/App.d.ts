import HyperExpress from 'hyper-express';
import type { NaraHandler, NaraMiddleware } from './types';
import type { FrontendAdapter } from './adapters';
export interface AppOptions {
    port?: number;
    adapter?: FrontendAdapter;
    routes?: HyperExpress.Router;
}
export declare class NaraApp {
    private server;
    private port;
    private adapter?;
    private routes?;
    constructor(options?: AppOptions);
    use(middleware: NaraMiddleware): this;
    get(path: string, ...handlers: NaraHandler[]): this;
    post(path: string, ...handlers: NaraHandler[]): this;
    put(path: string, ...handlers: NaraHandler[]): this;
    patch(path: string, ...handlers: NaraHandler[]): this;
    delete(path: string, ...handlers: NaraHandler[]): this;
    start(): Promise<void>;
    getServer(): HyperExpress.Server;
}
export declare function createApp(options?: AppOptions): NaraApp;
//# sourceMappingURL=App.d.ts.map