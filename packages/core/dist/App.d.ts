import HyperExpress from "hyper-express";
import type { Env } from "@config";
import type { NaraRequest, NaraResponse } from "./types";
import type { FrontendAdapter } from "./adapters/types";
export interface AppOptions {
    port?: number;
    https?: boolean;
    cors?: boolean;
    adapter?: FrontendAdapter;
    securityHeaders?: boolean;
    requestLogging?: boolean;
    rateLimit?: boolean;
    csrf?: boolean;
    routes?: HyperExpress.Router;
    shutdownTimeout?: number;
    errorHandler?: (req: NaraRequest, res: NaraResponse, error: unknown) => void;
}
export declare class NaraApp {
    private server;
    private env;
    private options;
    private isShuttingDown;
    private isStarted;
    constructor(options?: AppOptions);
    private logEnvSummary;
    private createServer;
    private applyDefaultMiddlewares;
    private setupErrorHandler;
    private setupSignalHandlers;
    private gracefulShutdown;
    use(middleware: Parameters<HyperExpress.Server["use"]>[0]): this;
    use(path: string, middleware: Parameters<HyperExpress.Server["use"]>[0]): this;
    mount(router: HyperExpress.Router, prefix?: string): this;
    start(): Promise<void>;
    close(): Promise<void>;
    getServer(): HyperExpress.Server;
    getEnv(): Env;
    isRunning(): boolean;
}
export declare function createApp(options?: AppOptions): NaraApp;
//# sourceMappingURL=App.d.ts.map