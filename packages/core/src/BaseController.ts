import type { NaraRequest, NaraResponse } from './types';

export class BaseController {
  constructor() {
    const prototype = Object.getPrototypeOf(this);
    const propertyNames = Object.getOwnPropertyNames(prototype);

    for (const name of propertyNames) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
      if (name !== 'constructor' && descriptor && typeof descriptor.value === 'function') {
        (this as any)[name] = (this as any)[name].bind(this);
      }
    }
  }

  protected json(res: NaraResponse, data: any, status = 200) {
    return res.status(status).json(data);
  }

  protected success(res: NaraResponse, data: any, message = 'Success') {
    return res.json({ success: true, message, data });
  }

  protected error(res: NaraResponse, message: string, status = 400) {
    return res.status(status).json({ success: false, message });
  }

  protected requireInertia(res: NaraResponse): void {
    if (typeof (res as any).inertia !== 'function') {
      throw new Error('Inertia support is not enabled. Please provide a FrontendAdapter.');
    }
  }

  protected requireAuth(req: NaraRequest): void {
    if (!req.user) {
      throw new Error('Unauthorized');
    }
  }

  protected requireAdmin(req: NaraRequest): void {
    this.requireAuth(req);
    if (!(req.user as any).is_admin) {
      throw new Error('Forbidden');
    }
  }

  protected async getBody<T = any>(req: NaraRequest, _schema?: any): Promise<T> {
    return await req.json() as T;
  }

  protected getPaginationParams(req: NaraRequest) {
    const page = parseInt(req.query.page as string) || 1;
    const rawLimit = parseInt(req.query.limit as string) || 10;
    const limit = Math.min(rawLimit, 100);
    const search = (req.query.search as string) || '';
    return { page, limit, search };
  }

  protected getQueryParam(req: NaraRequest, key: string, defaultValue: string = ''): string {
    return (req.query[key] as string) || defaultValue;
  }

  protected getParam(req: NaraRequest, key: string): string | undefined {
    return req.params[key];
  }

  protected getRequiredParam(req: NaraRequest, key: string): string {
    const value = req.params[key];
    if (!value) {
      throw new Error(`Parameter '${key}' is required`);
    }
    return value;
  }
}
