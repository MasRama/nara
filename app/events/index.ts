type Listener<T = any> = (payload: T) => void | Promise<void>;

const listeners = new Map<string, Set<Listener>>();

export const on = <T = any>(event: string, fn: Listener<T>): void => {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(fn);
};

export const off = <T = any>(event: string, fn: Listener<T>): void => {
  listeners.get(event)?.delete(fn);
};

export const emit = async <T = any>(event: string, payload: T): Promise<void> => {
  const fns = listeners.get(event);
  if (!fns) return;
  for (const fn of fns) {
    await fn(payload);
  }
};

export const once = <T = any>(event: string, fn: Listener<T>): void => {
  const wrapper: Listener<T> = async (payload) => {
    off(event, wrapper);
    await fn(payload);
  };
  on(event, wrapper);
};
