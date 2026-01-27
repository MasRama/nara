"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NaraRouter = void 0;
exports.createRouter = createRouter;
const hyper_express_1 = __importDefault(require("hyper-express"));
class NaraRouter {
    constructor() {
        this.router = new hyper_express_1.default.Router();
    }
    getRouter() {
        return this.router;
    }
    registerRoute(method, path, ...args) {
        const handler = args[args.length - 1];
        const middlewares = args.length > 1 ? args[0] : [];
        const middlewareArray = Array.isArray(middlewares) ? middlewares : [middlewares];
        const hyperMiddlewares = middlewareArray;
        const hyperHandler = handler;
        if (middlewareArray.length > 0) {
            this.router[method](path, hyperMiddlewares, hyperHandler);
        }
        else {
            this.router[method](path, hyperHandler);
        }
        return this;
    }
    get(path, ...args) {
        return this.registerRoute('get', path, ...args);
    }
    post(path, ...args) {
        return this.registerRoute('post', path, ...args);
    }
    put(path, ...args) {
        return this.registerRoute('put', path, ...args);
    }
    patch(path, ...args) {
        return this.registerRoute('patch', path, ...args);
    }
    delete(path, ...args) {
        return this.registerRoute('delete', path, ...args);
    }
    options(path, ...args) {
        return this.registerRoute('options', path, ...args);
    }
    head(path, ...args) {
        return this.registerRoute('head', path, ...args);
    }
    any(path, ...args) {
        const handler = args[args.length - 1];
        const middlewares = args.length > 1 ? args[0] : [];
        const middlewareArray = Array.isArray(middlewares) ? middlewares : [middlewares];
        const hyperMiddlewares = middlewareArray;
        const hyperHandler = handler;
        if (middlewareArray.length > 0) {
            this.router.any(path, hyperMiddlewares, hyperHandler);
        }
        else {
            this.router.any(path, hyperHandler);
        }
        return this;
    }
    use(pathOrMiddleware, middleware) {
        if (typeof pathOrMiddleware === 'function') {
            this.router.use(pathOrMiddleware);
        }
        else if (middleware) {
            this.router.use(pathOrMiddleware, middleware);
        }
        return this;
    }
    mount(path, router) {
        this.router.use(path, router.getRouter());
        return this;
    }
    group(prefix, middlewaresOrCallback, callback) {
        const subRouter = new NaraRouter();
        if (typeof middlewaresOrCallback === 'function') {
            const cb = middlewaresOrCallback;
            cb(subRouter);
        }
        else if (callback) {
            const middlewares = Array.isArray(middlewaresOrCallback)
                ? middlewaresOrCallback
                : [middlewaresOrCallback];
            middlewares.forEach(mw => subRouter.use(mw));
            callback(subRouter);
        }
        this.router.use(prefix, subRouter.getRouter());
        return this;
    }
}
exports.NaraRouter = NaraRouter;
function createRouter() {
    return new NaraRouter();
}
exports.default = NaraRouter;
//# sourceMappingURL=Router.js.map