import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheStore } from '../../app/services/CacheStore';
import type { CacheStoreOptions } from '../../app/services/CacheStore';

// ── Helpers ──

function makeStore<V = Buffer>(overrides: Partial<CacheStoreOptions> = {}): CacheStore<V> {
  return new CacheStore<V>({
    maxEntries: 5,
    maxBytes: 1024, // 1KB
    defaultTtlMs: 60_000, // 1 min
    ...overrides,
  });
}

function buf(str: string): Buffer {
  return Buffer.from(str, 'utf8');
}

// ── Tests ──

describe('CacheStore', () => {

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Basic get/set ──

  describe('get/set', () => {
    it('returns undefined for missing key', () => {
      const store = makeStore();
      expect(store.get('nope')).toBeUndefined();
    });

    it('stores and retrieves a Buffer value', () => {
      const store = makeStore();
      const data = buf('hello world');
      store.set('key1', data);
      expect(store.get('key1')).toBe(data);
    });

    it('stores and retrieves a string value', () => {
      const store = makeStore<string>({
        maxEntries: 5,
        maxBytes: 10_000,
        defaultTtlMs: 60_000,
        measureFn: (v: string) => Buffer.byteLength(v, 'utf8'),
      });
      store.set('tpl', '<html></html>');
      expect(store.get('tpl')).toBe('<html></html>');
    });

    it('overwrites existing key with new value', () => {
      const store = makeStore();
      store.set('key1', buf('old'));
      store.set('key1', buf('new'));
      expect(store.get('key1')!.toString()).toBe('new');
      expect(store.size).toBe(1);
    });

    it('tracks size correctly on overwrite', () => {
      const store = makeStore({ maxEntries: 100, maxBytes: 10_000, defaultTtlMs: 60_000 });
      store.set('a', buf('aaaa')); // 4 bytes
      store.set('b', buf('bb'));   // 2 bytes
      expect(store.stats().totalBytes).toBe(6);

      store.set('a', buf('x'));    // 1 byte (was 4)
      expect(store.stats().totalBytes).toBe(3); // 1 + 2
    });
  });

  // ── has() ──

  describe('has', () => {
    it('returns false for missing key', () => {
      const store = makeStore();
      expect(store.has('nope')).toBe(false);
    });

    it('returns true for existing key', () => {
      const store = makeStore();
      store.set('k', buf('v'));
      expect(store.has('k')).toBe(true);
    });

    it('returns false for expired key and removes it', () => {
      const store = makeStore({ defaultTtlMs: 1 }); // 1ms TTL
      store.set('k', buf('v'));

      // Advance time past TTL
      vi.useFakeTimers();
      vi.advanceTimersByTime(10);
      expect(store.has('k')).toBe(false);
      vi.useRealTimers();
    });
  });

  // ── LRU eviction by maxEntries ──

  describe('LRU eviction (maxEntries)', () => {
    it('evicts oldest entry when maxEntries exceeded', () => {
      const store = makeStore({ maxEntries: 3, maxBytes: 999_999, defaultTtlMs: 0 });

      store.set('a', buf('a'));
      store.set('b', buf('b'));
      store.set('c', buf('c'));
      store.set('d', buf('d')); // should evict 'a'

      expect(store.has('a')).toBe(false);
      expect(store.has('b')).toBe(true);
      expect(store.has('c')).toBe(true);
      expect(store.has('d')).toBe(true);
      expect(store.size).toBe(3);
    });

    it('promotes accessed entry so it is not evicted', () => {
      const store = makeStore({ maxEntries: 3, maxBytes: 999_999, defaultTtlMs: 0 });

      store.set('a', buf('a'));
      store.set('b', buf('b'));
      store.set('c', buf('c'));

      // Access 'a' to promote it
      store.get('a');

      // Insert 'd' — should evict 'b' (now oldest), not 'a'
      store.set('d', buf('d'));

      expect(store.has('a')).toBe(true);  // was accessed, promoted
      expect(store.has('b')).toBe(false); // evicted (oldest after 'a' promoted)
      expect(store.has('c')).toBe(true);
      expect(store.has('d')).toBe(true);
    });

    it('counts evictions in stats', () => {
      const store = makeStore({ maxEntries: 2, maxBytes: 999_999, defaultTtlMs: 0 });

      store.set('a', buf('a'));
      store.set('b', buf('b'));
      store.set('c', buf('c')); // evicts 'a'
      store.set('d', buf('d')); // evicts 'b'

      expect(store.stats().evictions).toBe(2);
    });
  });

  // ── LRU eviction by maxBytes ──

  describe('LRU eviction (maxBytes)', () => {
    it('evicts entries when total size exceeds maxBytes', () => {
      const store = makeStore({ maxEntries: 999, maxBytes: 10, defaultTtlMs: 0 });

      store.set('a', buf('12345')); // 5 bytes
      store.set('b', buf('12345')); // 5 bytes → total 10
      expect(store.size).toBe(2);

      store.set('c', buf('12345')); // 5 bytes → need room, evict 'a'
      expect(store.has('a')).toBe(false);
      expect(store.has('b')).toBe(true);
      expect(store.has('c')).toBe(true);
    });

    it('evicts multiple entries if needed for a large insert', () => {
      const store = makeStore({ maxEntries: 999, maxBytes: 15, defaultTtlMs: 0 });

      store.set('a', buf('12345')); // 5 → total 5
      store.set('b', buf('12345')); // 5 → total 10
      store.set('c', buf('12345')); // 5 → total 15

      // Insert 10 bytes → need room, evict 'a' (5), total 10, still need: 10+10=20 > 15
      // → evict 'b' (5), total 5, now 5+10=15 ≤ 15 → done
      store.set('d', buf('1234567890'));
      expect(store.has('a')).toBe(false);
      expect(store.has('b')).toBe(false);
      expect(store.has('c')).toBe(true);
      expect(store.has('d')).toBe(true);
    });
  });

  // ── TTL expiry ──

  describe('TTL expiry', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('returns undefined after TTL expires', () => {
      const store = makeStore({ defaultTtlMs: 100 });
      store.set('k', buf('v'));
      expect(store.get('k')).toBeDefined();

      vi.advanceTimersByTime(101);
      expect(store.get('k')).toBeUndefined();
    });

    it('respects per-entry TTL override', () => {
      const store = makeStore({ defaultTtlMs: 60_000 });

      store.set('short', buf('a'), 50);   // 50ms TTL
      store.set('long', buf('b'), 5000);  // 5s TTL

      vi.advanceTimersByTime(100);

      expect(store.get('short')).toBeUndefined(); // expired
      expect(store.get('long')).toBeDefined();     // still valid
    });

    it('TTL of 0 means no expiry', () => {
      const store = makeStore({ defaultTtlMs: 0 }); // no TTL
      store.set('k', buf('v'));

      vi.advanceTimersByTime(999_999_999);
      expect(store.get('k')).toBeDefined();
    });

    it('expired entries on has() are cleaned up', () => {
      const store = makeStore({ defaultTtlMs: 10 });
      store.set('k', buf('v'));

      vi.advanceTimersByTime(20);
      expect(store.has('k')).toBe(false);
      expect(store.size).toBe(0);
    });
  });

  // ── delete / clear ──

  describe('delete / clear', () => {
    it('delete removes a specific entry', () => {
      const store = makeStore();
      store.set('a', buf('a'));
      store.set('b', buf('b'));

      expect(store.delete('a')).toBe(true);
      expect(store.has('a')).toBe(false);
      expect(store.has('b')).toBe(true);
      expect(store.size).toBe(1);
    });

    it('delete returns false for missing key', () => {
      const store = makeStore();
      expect(store.delete('nope')).toBe(false);
    });

    it('delete adjusts totalBytes', () => {
      const store = makeStore();
      store.set('a', buf('12345')); // 5 bytes
      store.set('b', buf('123'));   // 3 bytes
      expect(store.stats().totalBytes).toBe(8);

      store.delete('a');
      expect(store.stats().totalBytes).toBe(3);
    });

    it('clear removes everything and resets stats', () => {
      const store = makeStore();
      store.set('a', buf('a'));
      store.set('b', buf('b'));
      store.get('a'); // hit
      store.get('z'); // miss

      store.clear();

      expect(store.size).toBe(0);
      const stats = store.stats();
      expect(stats.entries).toBe(0);
      expect(stats.totalBytes).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
    });
  });

  // ── Statistics ──

  describe('stats', () => {
    it('tracks hits and misses correctly', () => {
      const store = makeStore();
      store.set('a', buf('a'));

      store.get('a'); // hit
      store.get('a'); // hit
      store.get('z'); // miss

      const stats = store.stats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3);
    });

    it('hitRate is 0 when no requests made', () => {
      const store = makeStore();
      expect(store.stats().hitRate).toBe(0);
    });

    it('reports correct totalBytes', () => {
      const store = makeStore({ maxEntries: 999, maxBytes: 999_999, defaultTtlMs: 0 });
      store.set('a', buf('hello')); // 5
      store.set('b', buf('world!')); // 6
      expect(store.stats().totalBytes).toBe(11);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles maxEntries of 1', () => {
      const store = makeStore({ maxEntries: 1, maxBytes: 999_999, defaultTtlMs: 0 });

      store.set('a', buf('a'));
      store.set('b', buf('b')); // evicts 'a'

      expect(store.has('a')).toBe(false);
      expect(store.has('b')).toBe(true);
      expect(store.size).toBe(1);
    });

    it('value larger than maxBytes still gets stored (after evicting everything)', () => {
      const store = makeStore({ maxEntries: 999, maxBytes: 10, defaultTtlMs: 0 });

      store.set('a', buf('12345')); // 5 bytes
      // Insert 15 bytes — evicts 'a', then stores (even though > maxBytes alone)
      store.set('big', buf('123456789012345'));

      expect(store.has('a')).toBe(false);
      expect(store.has('big')).toBe(true);
    });

    it('size getter returns correct count', () => {
      const store = makeStore({ maxEntries: 999, maxBytes: 999_999, defaultTtlMs: 0 });
      expect(store.size).toBe(0);

      store.set('a', buf('a'));
      store.set('b', buf('b'));
      expect(store.size).toBe(2);

      store.delete('a');
      expect(store.size).toBe(1);
    });
  });
});
