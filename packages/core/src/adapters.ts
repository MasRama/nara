import type { NaraMiddleware, NaraResponse } from './types';

export interface FrontendAdapter {
  name: string;
  middleware: () => NaraMiddleware;
  extendResponse?: (res: NaraResponse) => void;
}
