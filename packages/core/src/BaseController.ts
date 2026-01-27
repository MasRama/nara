import type { NaraRequest, NaraResponse } from './types';

export class BaseController {
  protected json(res: NaraResponse, data: any, status = 200) {
    return res.status(status).json(data);
  }

  protected success(res: NaraResponse, data: any, message = 'Success') {
    return res.json({ success: true, message, data });
  }

  protected error(res: NaraResponse, message: string, status = 400) {
    return res.status(status).json({ success: false, message });
  }
}
