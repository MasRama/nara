import { randomUUID } from "crypto";
import type { NaraRequest, NaraResponse, NaraMiddleware } from "@core/types";

const REQUEST_ID_HEADER = "x-request-id";

export function requestId(): NaraMiddleware {
  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    const incomingId = req.headers[REQUEST_ID_HEADER] as string | undefined;
    const id = incomingId || randomUUID();

    req.requestId = id;
    res.header(REQUEST_ID_HEADER, id);

    return next();
  };
}

export default requestId;
