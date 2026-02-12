import HyperExpress from 'hyper-express';
import type { NaraHandler, NaraMiddleware } from './types';

export interface RouterOptions {
  prefix?: string;
}

export class NaraRouter {
  private router: HyperExpress.Router;
  private prefix: string;

  constructor(prefix: string = '') {
    this.router = new HyperExpress.Router();
    this.prefix = prefix;
  }

  get(path: string, ...handlers: NaraHandler[]) {
    this.router.get(this.prefix + path, ...handlers as any);
    return this;
  }

  post(path: string, ...handlers: NaraHandler[]) {
    this.router.post(this.prefix + path, ...handlers as any);
    return this;
  }

  put(path: string, ...handlers: NaraHandler[]) {
    this.router.put(this.prefix + path, ...handlers as any);
    return this;
  }

  patch(path: string, ...handlers: NaraHandler[]) {
    this.router.patch(this.prefix + path, ...handlers as any);
    return this;
  }

  delete(path: string, ...handlers: NaraHandler[]) {
    this.router.delete(this.prefix + path, ...handlers as any);
    return this;
  }

  group(callback: (router: NaraRouter) => void) {
    callback(this);
    return this;
  }

  getRouter(): HyperExpress.Router {
    return this.router;
  }
}

export function createRouter(prefix?: string): NaraRouter {
  return new NaraRouter(prefix);
}
