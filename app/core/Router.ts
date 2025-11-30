/**
 * Nara Router
 * 
 * Type-safe wrapper around HyperExpress.Router.
 * Provides proper TypeScript support for Nara's extended Request/Response types.
 * 
 * @example
 * import { createRouter } from '@core';
 * 
 * const Route = createRouter();
 * 
 * Route.get('/users', [AuthMiddleware], UserController.index);
 * Route.post('/users', [AuthMiddleware, AdminMiddleware], UserController.create);
 */

import HyperExpress from 'hyper-express';
import type { NaraRequest, NaraResponse, NaraMiddleware, NaraHandler, RouteMiddlewares } from './types';

/**
 * HTTP methods supported by the router
 */
type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head';

/**
 * Route handler signature - can be just a handler or middleware array + handler
 */
type RouteArgs = 
  | [NaraHandler]
  | [RouteMiddlewares, NaraHandler];

/**
 * NaraRouter class
 * 
 * Wraps HyperExpress.Router with type-safe methods that accept
 * Nara's extended Request and Response types.
 */
export class NaraRouter {
  private router: HyperExpress.Router;

  constructor() {
    this.router = new HyperExpress.Router();
  }

  /**
   * Get the underlying HyperExpress router
   * Used when mounting the router to the server
   */
  getRouter(): HyperExpress.Router {
    return this.router;
  }

  /**
   * Internal method to register a route
   */
  private registerRoute(method: HttpMethod, path: string, ...args: RouteArgs): this {
    const handler = args[args.length - 1] as NaraHandler;
    const middlewares = args.length > 1 ? args[0] as RouteMiddlewares : [];

    // Normalize middlewares to array
    const middlewareArray = Array.isArray(middlewares) ? middlewares : [middlewares];

    // Cast handlers to HyperExpress types (they're compatible at runtime)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hyperMiddlewares = middlewareArray as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hyperHandler = handler as any;

    // Register route with HyperExpress
    if (middlewareArray.length > 0) {
      this.router[method](path, hyperMiddlewares, hyperHandler);
    } else {
      this.router[method](path, hyperHandler);
    }

    return this;
  }

  /**
   * Register a GET route
   * 
   * @example
   * Route.get('/users', UserController.index);
   * Route.get('/users/:id', [AuthMiddleware], UserController.show);
   */
  get(path: string, handler: NaraHandler): this;
  get(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
  get(path: string, ...args: RouteArgs): this {
    return this.registerRoute('get', path, ...args);
  }

  /**
   * Register a POST route
   * 
   * @example
   * Route.post('/users', [AuthMiddleware], UserController.create);
   */
  post(path: string, handler: NaraHandler): this;
  post(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
  post(path: string, ...args: RouteArgs): this {
    return this.registerRoute('post', path, ...args);
  }

  /**
   * Register a PUT route
   * 
   * @example
   * Route.put('/users/:id', [AuthMiddleware], UserController.update);
   */
  put(path: string, handler: NaraHandler): this;
  put(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
  put(path: string, ...args: RouteArgs): this {
    return this.registerRoute('put', path, ...args);
  }

  /**
   * Register a PATCH route
   * 
   * @example
   * Route.patch('/users/:id', [AuthMiddleware], UserController.partialUpdate);
   */
  patch(path: string, handler: NaraHandler): this;
  patch(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
  patch(path: string, ...args: RouteArgs): this {
    return this.registerRoute('patch', path, ...args);
  }

  /**
   * Register a DELETE route
   * 
   * @example
   * Route.delete('/users/:id', [AuthMiddleware, AdminMiddleware], UserController.destroy);
   */
  delete(path: string, handler: NaraHandler): this;
  delete(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
  delete(path: string, ...args: RouteArgs): this {
    return this.registerRoute('delete', path, ...args);
  }

  /**
   * Register an OPTIONS route
   */
  options(path: string, handler: NaraHandler): this;
  options(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
  options(path: string, ...args: RouteArgs): this {
    return this.registerRoute('options', path, ...args);
  }

  /**
   * Register a HEAD route
   */
  head(path: string, handler: NaraHandler): this;
  head(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
  head(path: string, ...args: RouteArgs): this {
    return this.registerRoute('head', path, ...args);
  }

  /**
   * Register a route for all HTTP methods
   * 
   * @example
   * Route.any('/webhook', WebhookController.handle);
   */
  any(path: string, handler: NaraHandler): this;
  any(path: string, middlewares: RouteMiddlewares, handler: NaraHandler): this;
  any(path: string, ...args: RouteArgs): this {
    const handler = args[args.length - 1] as NaraHandler;
    const middlewares = args.length > 1 ? args[0] as RouteMiddlewares : [];

    const middlewareArray = Array.isArray(middlewares) ? middlewares : [middlewares];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hyperMiddlewares = middlewareArray as any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hyperHandler = handler as any;

    if (middlewareArray.length > 0) {
      this.router.any(path, hyperMiddlewares, hyperHandler);
    } else {
      this.router.any(path, hyperHandler);
    }

    return this;
  }

  /**
   * Apply middleware to all routes in this router
   * 
   * @example
   * Route.use(LoggingMiddleware);
   * Route.use('/api', ApiMiddleware);
   */
  use(middleware: NaraMiddleware): this;
  use(path: string, middleware: NaraMiddleware): this;
  use(pathOrMiddleware: string | NaraMiddleware, middleware?: NaraMiddleware): this {
    if (typeof pathOrMiddleware === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.router.use(pathOrMiddleware as any);
    } else if (middleware) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.router.use(pathOrMiddleware, middleware as any);
    }
    return this;
  }

  /**
   * Mount a sub-router
   * 
   * @example
   * const apiRouter = createRouter();
   * apiRouter.get('/users', UserController.index);
   * 
   * Route.mount('/api', apiRouter);
   */
  mount(path: string, router: NaraRouter): this {
    this.router.use(path, router.getRouter());
    return this;
  }

  /**
   * Create a route group with shared prefix and/or middleware
   * 
   * @example
   * Route.group('/api/v1', [AuthMiddleware], (route) => {
   *   route.get('/users', UserController.index);
   *   route.post('/users', UserController.create);
   * });
   */
  group(prefix: string, callback: (router: NaraRouter) => void): this;
  group(prefix: string, middlewares: RouteMiddlewares, callback: (router: NaraRouter) => void): this;
  group(
    prefix: string,
    middlewaresOrCallback: RouteMiddlewares | ((router: NaraRouter) => void),
    callback?: (router: NaraRouter) => void
  ): this {
    const subRouter = new NaraRouter();

    if (typeof middlewaresOrCallback === 'function') {
      // No middlewares, just callback
      const cb = middlewaresOrCallback as (router: NaraRouter) => void;
      cb(subRouter);
    } else if (callback) {
      // Has middlewares
      const middlewares = Array.isArray(middlewaresOrCallback) 
        ? middlewaresOrCallback 
        : [middlewaresOrCallback];
      
      // Apply middlewares to sub-router
      middlewares.forEach(mw => subRouter.use(mw));
      callback(subRouter);
    }

    this.router.use(prefix, subRouter.getRouter());
    return this;
  }
}

/**
 * Create a new NaraRouter instance
 * 
 * @example
 * import { createRouter } from '@core';
 * 
 * const Route = createRouter();
 * export default Route;
 */
export function createRouter(): NaraRouter {
  return new NaraRouter();
}

/**
 * Default export for convenience
 */
export default NaraRouter;
