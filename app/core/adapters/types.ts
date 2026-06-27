import type { NextFunction } from "express";
import type { NaraRequest, NaraResponse } from "../types";

export type AdapterMiddlewareHandler = (
  req: NaraRequest,
  res: NaraResponse,
  next: NextFunction
) => unknown | Promise<unknown>;

export interface FrontendAdapter {
  name: string;

  middleware: () => AdapterMiddlewareHandler;

  extendResponse?: (res: NaraResponse) => void;
}
