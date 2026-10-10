// A stack frame inside a Feature directory, in source (ts-node, Vitest) or tsc
// output (build/src/features/...).
const FEATURE_FRAME_PATTERN = /[\\/]src[\\/]features[\\/]([a-z0-9]+(?:-[a-z0-9]+)*)[\\/]/;

/**
 * The Feature that owns the innermost stack frame inside a Feature directory,
 * derived from the canonical folder layout rather than declared metadata.
 * Shared or framework frames above it are skipped, so a database error raised
 * from Auth code resolves to `auth`. Undefined when no frame proves ownership
 * (no stack, or no Feature frame within the captured stack depth).
 */
export function featureFromStack(stack: string | undefined): string | undefined {
  if (typeof stack !== 'string') return undefined;
  for (const line of stack.split('\n')) {
    // Only call-site lines: the message line may quote arbitrary paths.
    if (!/^\s+at\s/.test(line) || /[\\/]node_modules[\\/]/.test(line)) continue;
    const match = FEATURE_FRAME_PATTERN.exec(line);
    if (match) return match[1];
  }
  return undefined;
}

export function errorOriginFeature(error: unknown): string | undefined {
  return error instanceof Error ? featureFromStack(error.stack) : undefined;
}
