import HyperExpress from 'hyper-express';
import type { NaraRequest, NaraResponse, NaraHandler, NaraMiddleware } from './types';
import type { FrontendAdapter } from './adapters';

export interface AppOptions {
  port?: number;
  adapter?: FrontendAdapter;
  routes?: HyperExpress.Router;
}

export class NaraApp {
  private server: HyperExpress.Server;
  private port: number;
  private adapter?: FrontendAdapter;
  private routes?: HyperExpress.Router;

  constructor(options: AppOptions = {}) {
    this.server = new HyperExpress.Server();
    this.port = options.port || 3000;
    this.adapter = options.adapter;
    this.routes = options.routes;

    if (this.adapter) {
      this.server.use(this.adapter.middleware());
    }
  }

  use(middleware: NaraMiddleware) {
    this.server.use(middleware);
    return this;
  }

  get(path: string, ...handlers: NaraHandler[]) {
    this.server.get(path, ...handlers as any);
    return this;
  }

  post(path: string, ...handlers: NaraHandler[]) {
    this.server.post(path, ...handlers as any);
    return this;
  }

  put(path: string, ...handlers: NaraHandler[]) {
    this.server.put(path, ...handlers as any);
    return this;
  }

  patch(path: string, ...handlers: NaraHandler[]) {
    this.server.patch(path, ...handlers as any);
    return this;
  }

  delete(path: string, ...handlers: NaraHandler[]) {
    this.server.delete(path, ...handlers as any);
    return this;
  }

  async start() {
    if (this.routes) {
      this.server.use(this.routes);
    }
    await this.server.listen(this.port);
    console.log(`🚀 Server running on http://localhost:${this.port}`);
  }

  getServer() {
    return this.server;
  }
}

export function createApp(options?: AppOptions): NaraApp {
  return new NaraApp(options);
}
