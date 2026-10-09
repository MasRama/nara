/**
 * Who is editing what, kept in this process. A page re-enters every few
 * seconds while its form is open and leaves when it closes; an entry that is
 * not renewed expires, so a closed tab or a lost connection drops out on its
 * own. `onChange` runs whenever the set of editors changes, which is where a
 * Feature publishes its topic.
 */
export interface Editor {
  id: string;
  name: string;
}

export interface Presence {
  /** Lists `editor` on `key` until `ttlMs` passes without another call. */
  enter(key: string, editor: Editor): void;
  leave(key: string, editorId: string): void;
  /** Current editors per key, one entry per account, in the order they arrived. */
  editors(): Record<string, Editor[]>;
}

export interface PresenceOptions {
  onChange(): void;
  /** How long an entry lasts without being renewed; a few times `PRESENCE_RENEW_MS`. */
  ttlMs?: number;
  /** Most keys tracked at once; entering beyond it is ignored. */
  maxKeys?: number;
}

export function createPresence(options: PresenceOptions): Presence {
  const ttlMs = options.ttlMs ?? 30_000;
  const maxKeys = options.maxKeys ?? 10_000;
  const entries = new Map<string, Map<string, Editor & { expiresAt: number }>>();
  let sweeper: NodeJS.Timeout | undefined;

  function sweep(): void {
    const now = Date.now();
    let changed = false;
    for (const [key, holders] of entries) {
      for (const [id, holder] of holders) {
        if (holder.expiresAt > now) continue;
        holders.delete(id);
        changed = true;
      }
      if (holders.size === 0) entries.delete(key);
    }
    if (entries.size === 0 && sweeper) {
      clearInterval(sweeper);
      sweeper = undefined;
    }
    if (changed) options.onChange();
  }

  return {
    enter(key, editor) {
      const holders = entries.get(key) ?? new Map();
      if (!entries.has(key) && entries.size >= maxKeys) return;
      const known = holders.get(editor.id);
      holders.set(editor.id, { id: editor.id, name: editor.name, expiresAt: Date.now() + ttlMs });
      entries.set(key, holders);
      if (!sweeper) {
        sweeper = setInterval(sweep, Math.max(1_000, Math.floor(ttlMs / 3)));
        sweeper.unref?.();
      }
      if (!known || known.name !== editor.name) options.onChange();
    },
    leave(key, editorId) {
      const holders = entries.get(key);
      if (!holders?.delete(editorId)) return;
      if (holders.size === 0) entries.delete(key);
      options.onChange();
    },
    editors() {
      const now = Date.now();
      const result: Record<string, Editor[]> = {};
      for (const [key, holders] of entries) {
        const live = [...holders.values()].filter((holder) => holder.expiresAt > now);
        if (live.length > 0) result[key] = live.map((holder) => ({ id: holder.id, name: holder.name }));
      }
      return result;
    },
  };
}
