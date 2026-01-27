import type { Request, Response, MiddlewareHandler } from 'hyper-express';

export interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
}

export interface NaraRequest extends Request {
  user?: User;
}

export interface NaraResponse extends Response {
  inertia?: (component: string, props?: Record<string, any>) => void;
}

export type NaraHandler = (req: NaraRequest, res: NaraResponse) => void | Promise<void>;
export type NaraMiddleware = MiddlewareHandler;
