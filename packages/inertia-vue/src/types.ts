/**
 * Nara Request and Response minimal interfaces for the adapter
 */

export interface NaraRequest {
  protocol: string;
  get(header: string): string | undefined;
  header(header: string): string | undefined;
  originalUrl: string;
  cookies: Record<string, any>;
  [key: string]: any;
}

export interface NaraResponse {
  type(type: string): this;
  send(body: any): any;
  json(body: any): any;
  setHeader(name: string, value: string): this;
  status(code: number): this;
  cookie(name: string, value: any, options?: any): this;
  clearCookie(name: string): this;
  inertia?: (component: string, props?: Record<string, any>, viewProps?: Record<string, any>) => Promise<any>;
  [key: string]: any;
}

export type AdapterMiddlewareHandler = (
  req: NaraRequest,
  res: NaraResponse,
  next: () => void
) => unknown | Promise<unknown>;

export interface FrontendAdapter {
  name: string;
  middleware: () => AdapterMiddlewareHandler;
  extendResponse: (res: NaraResponse) => void;
}
