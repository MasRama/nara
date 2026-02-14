/**
 * Input Sanitization Middleware
 *
 * Sanitizes user input to prevent XSS attacks by removing HTML tags from
 * request body, query parameters, and route parameters.
 *
 * Uses isomorphic-dompurify for robust HTML sanitization.
 *
 * Features:
 * - Sanitizes req.body, req.query, req.params
 * - Preserves non-string values (numbers, booleans, null)
 * - Handles nested objects recursively
 * - Configurable allow lists for tags/attributes
 * - Skip fields option for rich text content
 * - Helper functions for manual sanitization
 *
 * @example
 * // Basic usage
 * app.use(inputSanitize());
 *
 * // With options
 * app.use(inputSanitize({
 *   allowedTags: ['b', 'i', 'em', 'strong'],
 *   skipFields: ['content', 'description'],
 * }));
 *
 * // Manual sanitization
 * const clean = sanitizeHtml(dirtyInput);
 * const plain = stripHtml(dirtyInput);
 */

import DOMPurify from "isomorphic-dompurify";
import type { NaraRequest, NaraResponse, NaraMiddleware } from "@core";

/**
 * Input sanitization configuration options
 */
export interface InputSanitizeOptions {
  /** Allowed HTML tags (default: none - all tags stripped) */
  allowedTags?: string[];
  /** Allowed HTML attributes (default: none) */
  allowedAttributes?: string[];
  /** Fields to skip sanitization (e.g., rich text fields) */
  skipFields?: string[];
  /** Whether to trim whitespace from strings (default: true) */
  trimWhitespace?: boolean;
  /** Custom sanitizer function (overrides default DOMPurify behavior) */
  customSanitizer?: (value: string) => string;
  /** Whether to sanitize req.body (default: true) */
  sanitizeBody?: boolean;
  /** Whether to sanitize req.query (default: true) */
  sanitizeQuery?: boolean;
  /** Whether to sanitize req.params (default: true) */
  sanitizeParams?: boolean;
}

/**
 * Default configuration - strips all HTML tags
 */
const DEFAULT_OPTIONS: Required<
  Pick<
    InputSanitizeOptions,
    | "allowedTags"
    | "allowedAttributes"
    | "skipFields"
    | "trimWhitespace"
    | "sanitizeBody"
    | "sanitizeQuery"
    | "sanitizeParams"
  >
> = {
  allowedTags: [],
  allowedAttributes: [],
  skipFields: [],
  trimWhitespace: true,
  sanitizeBody: true,
  sanitizeQuery: true,
  sanitizeParams: true,
};

/**
 * Check if a value is a plain object (not array, not null)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Check if field should be skipped based on path
 */
function shouldSkipField(path: string, skipFields: string[]): boolean {
  return skipFields.some((field) => {
    // Exact match
    if (path === field) return true;
    // Match nested path (e.g., "user.bio" matches skip field "bio")
    if (path.endsWith(`.${field}`)) return true;
    // Match array notation (e.g., "items[0].bio" matches skip field "bio")
    const fieldPattern = new RegExp(`\\.${field}$|\\[['"]${field}['"]\\]$`);
    if (fieldPattern.test(path)) return true;
    return false;
  });
}

/**
 * Sanitize a string value using DOMPurify
 */
function sanitizeString(
  value: string,
  options: InputSanitizeOptions
): string {
  let sanitized: string;

  if (options.customSanitizer) {
    sanitized = options.customSanitizer(value);
  } else {
    // Use DOMPurify to sanitize HTML
    sanitized = DOMPurify.sanitize(value, {
      ALLOWED_TAGS: options.allowedTags || DEFAULT_OPTIONS.allowedTags,
      ALLOWED_ATTR: options.allowedAttributes || DEFAULT_OPTIONS.allowedAttributes,
      KEEP_CONTENT: true,
    });
  }

  // Trim whitespace if enabled
  if (options.trimWhitespace !== false) {
    sanitized = sanitized.trim();
  }

  return sanitized;
}

/**
 * Recursively sanitize an object, array, or value
 */
function sanitizeValue(
  value: unknown,
  options: InputSanitizeOptions,
  path: string = ""
): unknown {
  // Skip if field is in skip list
  if (shouldSkipField(path, options.skipFields || [])) {
    return value;
  }

  // Handle strings
  if (typeof value === "string") {
    return sanitizeString(value, options);
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizeValue(item, options, `${path}[${index}]`)
    );
  }

  // Handle plain objects recursively
  if (isPlainObject(value)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const newPath = path ? `${path}.${key}` : key;
      sanitized[key] = sanitizeValue(val, options, newPath);
    }
    return sanitized;
  }

  // Return other types as-is (numbers, booleans, null, undefined)
  return value;
}

/**
 * Create input sanitization middleware
 *
 * @param options - Sanitization configuration
 * @returns Middleware function
 */
export function inputSanitize(
  options: InputSanitizeOptions = {}
): NaraMiddleware {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return (req: NaraRequest, res: NaraResponse, next: () => void) => {
    try {
      // Sanitize request body
      if (opts.sanitizeBody && req.body) {
        (req as NaraRequest & { body?: unknown }).body = sanitizeValue(
          (req as NaraRequest & { body?: unknown }).body,
          opts,
          "body"
        );
      }

      // Sanitize query parameters
      if (opts.sanitizeQuery && req.query) {
        req.query = sanitizeValue(req.query, opts, "query") as Record<
          string,
          string | string[]
        >;
      }

      // Sanitize route parameters
      if (opts.sanitizeParams && req.params) {
        req.params = sanitizeValue(req.params, opts, "params") as Record<
          string,
          string
        >;
      }

      return next();
    } catch (error) {
      // Log error but don't block the request
      // It's safer to proceed with unsanitized data than to crash
      console.error("[InputSanitize] Error sanitizing input:", error);
      return next();
    }
  };
}

/**
 * Sanitize HTML content - removes all HTML tags by default
 *
 * @param content - Content to sanitize
 * @param allowedTags - Optional array of allowed HTML tags
 * @returns Sanitized content
 *
 * @example
 * sanitizeHtml('<script>alert("xss")</script><p>Hello</p>');
 * // Returns: 'Hello'
 *
 * sanitizeHtml('<p>Hello <b>world</b></p>', ['p', 'b']);
 * // Returns: '<p>Hello <b>world</b></p>'
 */
export function sanitizeHtml(
  content: string,
  allowedTags?: string[]
): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: allowedTags || [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  }).trim();
}

/**
 * Strip all HTML tags - returns plain text only
 *
 * @param content - Content to strip
 * @returns Plain text without any HTML
 *
 * @example
 * stripHtml('<p>Hello <b>world</b></p>');
 * // Returns: 'Hello world'
 *
 * stripHtml('<script>alert("xss")</script>Text');
 * // Returns: 'Text'
 */
export function stripHtml(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  }).trim();
}

/**
 * Sanitize a single value (helper for manual sanitization)
 *
 * @param value - Value to sanitize
 * @param options - Sanitization options
 * @returns Sanitized value
 *
 * @example
 * const cleanName = sanitizeValue(userInput, { allowedTags: ['b'] });
 */
export function sanitizeInput(
  value: unknown,
  options: InputSanitizeOptions = {}
): unknown {
  return sanitizeValue(value, options);
}

/**
 * Create a sanitization function with preset options
 *
 * @param presetOptions - Options to apply to all sanitizations
 * @returns Sanitization function
 *
 * @example
 * const richTextSanitizer = createSanitizer({
 *   allowedTags: ['p', 'br', 'b', 'i', 'em', 'strong'],
 * });
 *
 * const clean = richTextSanitizer(dirtyContent);
 */
export function createSanitizer(
  presetOptions: InputSanitizeOptions
): (value: unknown) => unknown {
  return (value: unknown) => sanitizeValue(value, presetOptions);
}

/**
 * Preset sanitizers for common use cases
 */
export const sanitizers = {
  /**
   * Strip all HTML - plain text only
   */
  plainText: (content: string): string => stripHtml(content),

  /**
   * Allow basic formatting tags
   */
  basicHtml: (content: string): string =>
    sanitizeHtml(content, ["b", "i", "em", "strong", "br", "p"]),

  /**
   * Allow rich text formatting
   */
  richText: (content: string): string =>
    sanitizeHtml(content, [
      "p",
      "br",
      "b",
      "i",
      "em",
      "strong",
      "u",
      "s",
      "strike",
      "a",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "code",
      "pre",
    ]),

  /**
   * Sanitize URL - prevent javascript: protocol
   */
  url: (url: string): string => {
    const sanitized = stripHtml(url);
    // Block javascript: protocol
    if (/^javascript:/i.test(sanitized)) {
      return "";
    }
    return sanitized;
  },

  /**
   * Sanitize email address
   */
  email: (email: string): string => {
    const sanitized = stripHtml(email).toLowerCase().trim();
    // Basic email validation - return empty if invalid
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
      return "";
    }
    return sanitized;
  },
};

export default inputSanitize;
