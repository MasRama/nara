export interface CacheStoreOptions {
  maxEntries: number;
  maxBytes: number;
  defaultTtlMs: number;
  measureFn?: (value: any) => number;
}

interface CacheEntry<V> {
  value: V;
  size: number;
  expiresAt: number;
}

export interface CacheStats {
  entries: number;
  totalBytes: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

export interface CacheStore<V> {
  get(key: string): V | undefined;
  has(key: string): boolean;
  set(key: string, value: V, ttlMs?: number): void;
  delete(key: string): boolean;
  clear(): void;
  stats(): CacheStats;
  readonly size: number;
}

const defaultMeasure = (value: any): number => {
  if (Buffer.isBuffer(value)) return value.byteLength;
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8');
  return 0;
};

export const createCacheStore = <V>(options: CacheStoreOptions): CacheStore<V> => {
  const store = new Map<string, CacheEntry<V>>();
  const measure = options.measureFn ?? defaultMeasure;
  let totalBytes = 0;
  let hits = 0;
  let misses = 0;
  let evictions = 0;

  const evictLru = (): void => {
    const firstKey = store.keys().next().value;
    if (firstKey === undefined) return;
    const entry = store.get(firstKey);
    if (entry) totalBytes -= entry.size;
    store.delete(firstKey);
    evictions++;
  };

  const get = (key: string): V | undefined => {
    const entry = store.get(key);
    if (!entry) { misses++; return undefined; }
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      store.delete(key);
      totalBytes -= entry.size;
      misses++;
      return undefined;
    }
    store.delete(key);
    store.set(key, entry);
    hits++;
    return entry.value;
  };

  const has = (key: string): boolean => {
    const entry = store.get(key);
    if (!entry) return false;
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      store.delete(key);
      totalBytes -= entry.size;
      return false;
    }
    return true;
  };

  const set = (key: string, value: V, ttlMs?: number): void => {
    const sz = measure(value);
    const ttl = ttlMs ?? options.defaultTtlMs;
    const expiresAt = ttl > 0 ? Date.now() + ttl : 0;

    const existing = store.get(key);
    if (existing) {
      store.delete(key);
      totalBytes -= existing.size;
    }

    while (store.size >= options.maxEntries && store.size > 0) evictLru();
    while (totalBytes + sz > options.maxBytes && store.size > 0) evictLru();

    store.set(key, { value, size: sz, expiresAt });
    totalBytes += sz;
  };

  const del = (key: string): boolean => {
    const entry = store.get(key);
    if (!entry) return false;
    store.delete(key);
    totalBytes -= entry.size;
    return true;
  };

  const clear = (): void => {
    store.clear();
    totalBytes = 0;
    hits = 0;
    misses = 0;
    evictions = 0;
  };

  const stats = (): CacheStats => {
    const total = hits + misses;
    return {
      entries: store.size,
      totalBytes,
      hits,
      misses,
      evictions,
      hitRate: total > 0 ? hits / total : 0,
    };
  };

  return {
    get,
    has,
    set,
    delete: del,
    clear,
    stats,
    get size() { return store.size; },
  };
};

import { CACHE } from "@config/constants";

export const assetCache = createCacheStore<Buffer>({
  maxEntries: CACHE.ASSET_STORE_MAX_ENTRIES,
  maxBytes: CACHE.ASSET_STORE_MAX_BYTES,
  defaultTtlMs: CACHE.ASSET_STORE_TTL_MS,
});

export const templateCache = createCacheStore<string>({
  maxEntries: CACHE.TEMPLATE_STORE_MAX_ENTRIES,
  maxBytes: CACHE.TEMPLATE_STORE_MAX_ENTRIES * 1024 * 1024,
  defaultTtlMs: CACHE.TEMPLATE_STORE_TTL_MS,
  measureFn: (v: string) => Buffer.byteLength(v, "utf8"),
});
