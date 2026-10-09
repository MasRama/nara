import { PRESENCE_RENEW_MS } from './protocol';

/**
 * Three-way merge of a form against a record that changed while it was open.
 * `base` is what the form loaded, `mine` what it holds now, `theirs` the
 * record as saved elsewhere. A field only one side changed takes that side; a
 * field both changed to different values is a conflict and keeps `mine`.
 * Array fields are sets: additions and removals from both sides combine, so
 * they never conflict.
 */
export interface EditMerge<T> {
  merged: T;
  /** Fields both sides changed differently; `merged` holds `mine` for them. */
  conflicts: Array<keyof T & string>;
  /** Fields taken from `theirs`. */
  adopted: Array<keyof T & string>;
}

/** Equality for form values; arrays compare as sets. */
export function sameValue(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item) => right.includes(item));
  }
  return left === right;
}

function mergeSet(base: unknown[], mine: unknown[], theirs: unknown[]): unknown[] {
  const removed = new Set([...base.filter((item) => !mine.includes(item)), ...base.filter((item) => !theirs.includes(item))]);
  const merged = [...mine, ...theirs.filter((item) => !mine.includes(item))];
  return [...new Set(merged)].filter((item) => !removed.has(item));
}

export function mergeEdit<T extends Record<string, unknown>>(base: T, mine: T, theirs: T): EditMerge<T> {
  const merged = { ...mine };
  const conflicts: Array<keyof T & string> = [];
  const adopted: Array<keyof T & string> = [];
  for (const field of Object.keys(mine) as Array<keyof T & string>) {
    const [was, ours, now] = [base[field], mine[field], theirs[field]];
    if (sameValue(was, now) || sameValue(ours, now)) continue;
    if (Array.isArray(was) && Array.isArray(ours) && Array.isArray(now)) {
      merged[field] = mergeSet(was, ours, now) as T[typeof field];
      adopted.push(field);
    } else if (sameValue(was, ours)) {
      merged[field] = now;
      adopted.push(field);
    } else {
      conflicts.push(field);
    }
  }
  return { merged, conflicts, adopted };
}

export interface EditingClient {
  startEditing(id: string): Promise<unknown>;
  stopEditing(id: string): Promise<unknown>;
}

/**
 * Keeps the caller listed as editing `id` while a form is open: announces at
 * once, renews every `PRESENCE_RENEW_MS`, and leaves when the returned
 * function runs or the page goes away. Presence is advisory, so a failed
 * announcement is only logged; the entry lapses on the server by itself.
 */
export function keepEditing(id: string, client: EditingClient): () => void {
  const report = (error: unknown) => console.warn('Editing presence was not updated', error);
  const announce = () => void client.startEditing(id).catch(report);
  announce();
  const timer = setInterval(announce, PRESENCE_RENEW_MS);
  const leave = () => {
    clearInterval(timer);
    window.removeEventListener('pagehide', leave);
    void client.stopEditing(id).catch(report);
  };
  window.addEventListener('pagehide', leave);
  return leave;
}
