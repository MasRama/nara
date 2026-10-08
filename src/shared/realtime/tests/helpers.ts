/** Reads named Server-Sent Events from a streamed response, skipping comments. */
export interface EventReader {
  /** The next event name, `'closed'` when the stream ended, or `'timeout'`. */
  next(timeoutMs?: number): Promise<string>;
  cancel(): Promise<void>;
}

export function readEvents(response: Response): EventReader {
  if (!response.body) throw new Error('Response has no body to stream');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // A read abandoned by a timeout is kept for the next call so no chunk is lost.
  let pending: Promise<ReadableStreamReadResult<Uint8Array>> | undefined;

  return {
    async next(timeoutMs = 2_000) {
      for (;;) {
        const boundary = buffer.indexOf('\n\n');
        if (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const name = /^event: (.+)$/m.exec(block)?.[1];
          if (name) return name;
          continue;
        }
        pending ??= reader.read();
        let timer: NodeJS.Timeout | undefined;
        const timeout = new Promise<'timeout'>((resolve) => {
          timer = setTimeout(() => resolve('timeout'), timeoutMs);
        });
        const result = await Promise.race([pending, timeout]);
        clearTimeout(timer);
        if (result === 'timeout') return 'timeout';
        pending = undefined;
        if (result.done) return 'closed';
        buffer += decoder.decode(result.value, { stream: true });
      }
    },
    cancel: () => reader.cancel(),
  };
}
