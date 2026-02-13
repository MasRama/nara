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
}
