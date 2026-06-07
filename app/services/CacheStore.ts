/**
 * CacheStore — Bounded In-Memory LRU Cache
 *
 * A generic, zero-dependency LRU cache with:
 * - Max entry count eviction
 * - Max total size (bytes) eviction
 * - Per-entry TTL expiry
 * - Hit/miss statistics
 *
 * Used to replace unbounded `{ [key]: value }` caches that risk
 * uncontrolled memory growth in production.
 *
 * ## Usage
 *
 * ```typescript
 * import { CacheStore } from "@services";
 *
 * const assetCache = new CacheStore<Buffer>({
 *   maxEntries: 100,
 *   maxBytes: 20 * 1024 * 1024,
 *   defaultTtlMs: 60 * 60 * 1000,
 * });
 *
 * assetCache.set("app.css", cssBuffer);
 * const hit = assetCache.get("app.css"); // Buffer | undefined
 * ```
 */

export interface CacheStoreOptions {
  /** Maximum number of entries before LRU eviction kicks in */
  maxEntries: number;

  /** Maximum total size in bytes before LRU eviction kicks in.
   *  Size is measured via `measureFn` (defaults to assuming Buffer). */
  maxBytes: number;

  /** Default time-to-live in milliseconds. Set to 0 to disable TTL. */
  defaultTtlMs: number;

  /** Custom function to measure the byte-size of a value.
   *  Defaults to `(v) => (v as Buffer).byteLength ?? 0` which works for Buffers and strings. */
  measureFn?: (value: any) => number;
}

interface CacheEntry<V> {
  value: V;
  size: number;
  expiresAt: number; // 0 = no expiry
}

export interface CacheStats {
  entries: number;
  totalBytes: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

// Default size measurer — handles Buffer and string
function defaultMeasure<V>(value: V): number {
  if (Buffer.isBuffer(value)) return (value as Buffer).byteLength;
  if (typeof value === "string") return Buffer.byteLength(value as string, "utf8");
  return 0;
}

export class CacheStore<V> {
  private store: Map<string, CacheEntry<V>> = new Map();
  private maxEntries: number;
  private maxBytes: number;
  private defaultTtlMs: number;
  private measure: (value: V) => number;

  private totalBytes = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: CacheStoreOptions) {
    this.maxEntries = options.maxEntries;
    this.maxBytes = options.maxBytes;
    this.defaultTtlMs = options.defaultTtlMs;
    this.measure = (options.measureFn as (value: V) => number) ?? defaultMeasure;
  }

  /**
   * Retrieve a cached value. Returns `undefined` on miss or if the entry has expired.
   * Promotes the entry to most-recently-used on hit.
   */
  get(key: string): V | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // TTL check
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.totalBytes -= entry.size;
      this.misses++;
      return undefined;
    }

    // LRU promote: delete + re-insert moves it to the end (most recent)
    this.store.delete(key);
    this.store.set(key, entry);

    this.hits++;
    return entry.value;
  }

  /**
   * Check whether a non-expired entry exists (does NOT promote in LRU order).
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.totalBytes -= entry.size;
      return false;
    }
    return true;
  }

  /**
   * Store a value. Evicts least-recently-used entries if limits would be exceeded.
   *
   * @param key Cache key
   * @param value Value to cache
   * @param ttlMs Optional per-entry TTL override (ms). 0 = no expiry.
   */
  set(key: string, value: V, ttlMs?: number): void {
    const size = this.measure(value);
    const ttl = ttlMs ?? this.defaultTtlMs;
    const expiresAt = ttl > 0 ? Date.now() + ttl : 0;

    // If the key already exists, remove old entry first
    const existing = this.store.get(key);
    if (existing) {
      this.store.delete(key);
      this.totalBytes -= existing.size;
    }

    // Evict LRU entries until we have room by count
    while (this.store.size >= this.maxEntries && this.store.size > 0) {
      this.evictLru();
    }

    // Evict LRU entries until we have room by bytes
    while (this.totalBytes + size > this.maxBytes && this.store.size > 0) {
      this.evictLru();
    }

    // Insert new entry at the end (most recent)
    this.store.set(key, { value, size, expiresAt });
    this.totalBytes += size;
  }

  /**
   * Remove a specific entry.
   */
  delete(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    this.store.delete(key);
    this.totalBytes -= entry.size;
    return true;
  }

  /**
   * Clear all entries and reset statistics.
   */
  clear(): void {
    this.store.clear();
    this.totalBytes = 0;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Snapshot of current cache statistics.
   */
  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      entries: this.store.size,
      totalBytes: this.totalBytes,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Number of entries currently in the cache.
   */
  get size(): number {
    return this.store.size;
  }

  // ── Private helpers ──

  /**
   * Evict the least-recently-used entry (first entry in the Map).
   */
  private evictLru(): void {
    const firstKey = this.store.keys().next().value;
    if (firstKey === undefined) return;

    const entry = this.store.get(firstKey);
    if (entry) {
      this.totalBytes -= entry.size;
    }
    this.store.delete(firstKey);
    this.evictions++;
  }
}

// ── Pre-built singleton instances ──

import { CACHE } from "@config/constants";

/** Shared cache for compiled dist assets (CSS/JS bundles) */
export const assetCache = new CacheStore<Buffer>({
  maxEntries: CACHE.ASSET_STORE_MAX_ENTRIES,
  maxBytes: CACHE.ASSET_STORE_MAX_BYTES,
  defaultTtlMs: CACHE.ASSET_STORE_TTL_MS,
});

/** Shared cache for HTML view templates */
export const templateCache = new CacheStore<string>({
  maxEntries: CACHE.TEMPLATE_STORE_MAX_ENTRIES,
  maxBytes: CACHE.TEMPLATE_STORE_MAX_ENTRIES * 1024 * 1024, // generous 1MB per template × count
  defaultTtlMs: CACHE.TEMPLATE_STORE_TTL_MS,
  measureFn: (v: string) => Buffer.byteLength(v, "utf8"),
});
