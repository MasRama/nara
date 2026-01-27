import type { MiddlewareNext } from "hyper-express";
import type { NaraRequest, NaraResponse } from "../types";

/**
 * Handler type for adapter middleware
 */
export type AdapterMiddlewareHandler = (
  req: NaraRequest,
  res: NaraResponse,
  next: MiddlewareNext
) => unknown | Promise<unknown>;

/**
 * Frontend Adapter Interface
 */
export interface FrontendAdapter {
  /**
   * Unique name for the adapter
   */
  name: string;

  /**
   * Factory that returns the adapter's global middleware
   */
  middleware: () => AdapterMiddlewareHandler;

  /**
   * Method called during app initialization to extend the NaraResponse prototype or instance
   */
  extendResponse: (res: NaraResponse) => void;
}
