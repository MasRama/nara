import { Router as ExpressRouter } from 'ultimate-express';
import type { NaraMiddleware, NaraHandler, RouteMiddlewares } from './types';

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';
type RouteArgs = [NaraHandler] | [RouteMiddlewares, NaraHandler];

export interface NaraRouter {
  get(path: string, handler: NaraHandler): NaraRouter;
  get(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): NaraRouter;
  post(path: string, handler: NaraHandler): NaraRouter;
  post(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): NaraRouter;
  put(path: string, handler: NaraHandler): NaraRouter;
  put(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): NaraRouter;
  patch(path: string, handler: NaraHandler): NaraRouter;
  patch(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): NaraRouter;
  delete(path: string, handler: NaraHandler): NaraRouter;
  delete(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): NaraRouter;
  options(path: string, handler: NaraHandler): NaraRouter;
  options(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): NaraRouter;
  head(path: string, handler: NaraHandler): NaraRouter;
  head(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): NaraRouter;
  any(path: string, handler: NaraHandler): NaraRouter;
  any(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): NaraRouter;
  use(middleware: NaraMiddleware): NaraRouter;
  use(path: string, middleware: NaraMiddleware): NaraRouter;
  mount(path: string, router: NaraRouter): NaraRouter;
  group(prefix: string, callback: (router: NaraRouter) => void): NaraRouter;
  group(prefix: string, middlewares: RouteMiddlewares, callback: (router: NaraRouter) => void): NaraRouter;
  getRouter(): any;
}

export function createRouter(): NaraRouter {
  const router = ExpressRouter();

  const register = (method: string, path: string, ...args: RouteArgs): NaraRouter => {
    const handler = args[args.length - 1] as NaraHandler;
    const middlewares = args.length > 1 ? args[0] as RouteMiddlewares : [];
    const mw = Array.isArray(middlewares) ? middlewares : [middlewares];

    if (mw.length > 0) {
      (router as any)[method](path, ...(mw as any[]), handler as any);
    } else {
      (router as any)[method](path, handler as any);
    }

    return api;
  };

  const makeMethod = (method: HttpMethod) => (...args: any[]): NaraRouter =>
    register(method, args[0], ...(args.slice(1) as any));

  const api: NaraRouter = {
    get: makeMethod('get') as any,
    post: makeMethod('post') as any,
    put: makeMethod('put') as any,
    patch: makeMethod('patch') as any,
    delete: makeMethod('delete') as any,
    options: makeMethod('options') as any,
    head: makeMethod('head') as any,

    any(path: string, ...args: any[]): NaraRouter {
      const handler = args[args.length - 1] as NaraHandler;
      const middlewares = args.length > 1 ? args[0] as RouteMiddlewares : [];
      const mw = Array.isArray(middlewares) ? middlewares : [middlewares];

      if (mw.length > 0) {
        router.all(path, ...(mw as any[]), handler as any);
      } else {
        router.all(path, handler as any);
      }

      return api;
    },

    use(...args: any[]): NaraRouter {
      router.use(...args);
      return api;
    },

    mount(path: string, subRouter: NaraRouter): NaraRouter {
      router.use(path, subRouter.getRouter());
      return api;
    },

    group(prefix: string, ...args: any[]): NaraRouter {
      const subRouter = createRouter();
      const middlewaresOrCallback = args[0];
      const callback = args[1];

      if (typeof middlewaresOrCallback === 'function') {
        middlewaresOrCallback(subRouter);
      } else if (callback) {
        const middlewares = Array.isArray(middlewaresOrCallback)
          ? middlewaresOrCallback
          : [middlewaresOrCallback];
        middlewares.forEach((mw: NaraMiddleware) => subRouter.use(mw));
        callback(subRouter);
      }

      router.use(prefix, subRouter.getRouter());
      return api;
    },

    getRouter: () => router,
  };

  return api;
}

export default createRouter;
