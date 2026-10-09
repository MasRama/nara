import type { Context, MiddlewareHandler } from 'hono';
import type { z } from 'zod';

/**
 * Request validation as route middleware. Declaring the schema on the route
 * lets Hono's typed client (`hc`) check what the browser sends, while the
 * route keeps the standard 422 refusal. Handlers read the parsed value with
 * `context.req.valid('json' | 'query')`.
 */
export function validationErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    errors[key] ??= [];
    errors[key].push(issue.message);
  }
  return errors;
}

export function validationFailed(context: Context, error: z.ZodError) {
  return context.json(
    { success: false as const, message: 'Validation failed', code: 'VALIDATION_ERROR' as const, errors: validationErrors(error) },
    422,
  );
}

/** Validates the JSON body; a missing or malformed body is validated as `{}`. */
export function jsonInput<S extends z.ZodType>(
  schema: S,
): MiddlewareHandler<any, string, { in: { json: z.input<S> }; out: { json: z.output<S> } }> {
  return async (context, next) => {
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      body = {};
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationFailed(context, parsed.error);
    context.req.addValidatedData('json', parsed.data as object);
    await next();
  };
}

/** Validates the query string; empty values count as absent. The client sends every field as a string. */
export function queryInput<S extends z.ZodObject>(
  schema: S,
): MiddlewareHandler<any, string, { in: { query: { [K in keyof z.output<S>]?: string } }; out: { query: z.output<S> } }> {
  return async (context, next) => {
    const query = Object.fromEntries(Object.entries(context.req.query()).filter(([, value]) => value !== ''));
    const parsed = schema.safeParse(query);
    if (!parsed.success) return validationFailed(context, parsed.error);
    context.req.addValidatedData('query', parsed.data as object);
    await next();
  };
}
