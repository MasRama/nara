import type { NaraRequest, NaraResponse, NaraMiddleware } from "@core";

export interface InputSanitizeOptions {
  skipFields?: string[];
  trimWhitespace?: boolean;
  sanitizeBody?: boolean;
  sanitizeQuery?: boolean;
  sanitizeParams?: boolean;
}

const DEFAULT_OPTIONS = {
  skipFields: [] as string[],
  trimWhitespace: true,
  sanitizeBody: true,
  sanitizeQuery: true,
  sanitizeParams: true,
};

const stripTags = (value: string): string =>
  value.replace(/<[^>]*>/g, '');

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shouldSkipField(path: string, skipFields: string[]): boolean {
  return skipFields.some((field) => {
    if (path === field) return true;
    if (path.endsWith(`.${field}`)) return true;
    return false;
  });
}

function sanitizeString(value: string, options: InputSanitizeOptions): string {
  let sanitized = stripTags(value);
  if (options.trimWhitespace !== false) {
    sanitized = sanitized.trim();
  }
  return sanitized;
}

function sanitizeValue(
  value: unknown,
  options: InputSanitizeOptions,
  path: string = ""
): unknown {
  if (shouldSkipField(path, options.skipFields || [])) return value;
  if (typeof value === "string") return sanitizeString(value, options);
  if (Array.isArray(value)) return value.map((item, i) => sanitizeValue(item, options, `${path}[${i}]`));
  if (isPlainObject(value)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(val, options, path ? `${path}.${key}` : key);
    }
    return sanitized;
  }
  return value;
}

export function inputSanitize(options: InputSanitizeOptions = {}): NaraMiddleware {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    try {
      if (opts.sanitizeBody && req.body) {
        (req as any).body = sanitizeValue((req as any).body, opts, "body");
      }

      if (opts.sanitizeQuery && req.query) {
        const sanitized = sanitizeValue(req.query, opts, "query") as Record<string, unknown>;
        for (const key of Object.keys(req.query)) delete (req.query as any)[key];
        for (const [key, value] of Object.entries(sanitized)) (req.query as any)[key] = value;
      }

      if (opts.sanitizeParams && req.params) {
        const sanitized = sanitizeValue(req.params, opts, "params") as Record<string, unknown>;
        for (const key of Object.keys(req.params)) delete (req.params as any)[key];
        for (const [key, value] of Object.entries(sanitized)) (req.params as any)[key] = value;
      }

      return next();
    } catch {
      return next();
    }
  };
}

export const stripHtml = (content: string): string => stripTags(content).trim();

export default inputSanitize;
