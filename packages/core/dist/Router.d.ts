import HyperExpress from 'hyper-express';
import type { NaraMiddleware, NaraHandler, RouteMiddlewares } from './types';
export declare class NaraRouter {
    private router;
    constructor();
    getRouter(): HyperExpress.Router;
    private registerRoute;
    get(path: string, handler: NaraHandler): this;
    get(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
    post(path: string, handler: NaraHandler): this;
    post(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
    put(path: string, handler: NaraHandler): this;
    put(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
    patch(path: string, handler: NaraHandler): this;
    patch(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
    delete(path: string, handler: NaraHandler): this;
    delete(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
    options(path: string, handler: NaraHandler): this;
    options(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
    head(path: string, handler: NaraHandler): this;
    head(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
    any(path: string, handler: NaraHandler): this;
    any(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
    use(middleware: NaraMiddleware): this;
    use(path: string, middleware: NaraMiddleware): this;
    mount(path: string, router: NaraRouter): this;
    group(prefix: string, callback: (router: NaraRouter) => void): this;
    group(prefix: string, middlewares: RouteMiddlewares, callback: (router: NaraRouter) => void): this;
}
export declare function createRouter(): NaraRouter;
export default NaraRouter;
//# sourceMappingURL=Router.d.ts.map