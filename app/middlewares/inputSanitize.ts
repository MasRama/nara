import type { NaraRequest, NaraResponse, NaraMiddleware } from "@core";

const stripTags = (value: string): string =>
  value.replace(/<[^>]*>/g, '').trim();

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') return stripTags(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeValue(v);
    return out;
  }
  return value;
}

export function inputSanitize(): NaraMiddleware {
  return (req: NaraRequest, _res: NaraResponse, next: () => void) => {
    if (req.body) req.body = sanitizeValue(req.body) as Record<string, unknown>;
    if (req.query) req.query = sanitizeValue(req.query) as Record<string, string>;
    return next();
  };
}

export const stripHtml = (content: string): string => stripTags(content);

export default inputSanitize;
