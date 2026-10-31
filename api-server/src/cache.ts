interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MAX_CACHE_ENTRIES = 500;
const memoryStore = new Map<string, CacheEntry<any>>();
const inFlightPromises = new Map<string, Promise<any>>();

let cacheHits = 0;
let cacheMisses = 0;

export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  options?: { bypassCache?: boolean }
): Promise<T> {
  const now = Date.now();

  if (!options?.bypassCache) {
    const existing = memoryStore.get(key);
    if (existing && existing.expiresAt > now) {
      cacheHits++;
      // Move to end for LRU refresh
      memoryStore.delete(key);
      memoryStore.set(key, existing);
      return existing.value;
    }
  }

  // Deduplicate simultaneous in-flight queries
  const pending = inFlightPromises.get(key);
  if (pending) {
    cacheHits++;
    return pending;
  }

  cacheMisses++;
  const fetchPromise = (async () => {
    try {
      const freshValue = await fetcher();

      // Enforce LRU capacity cap
      if (memoryStore.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = memoryStore.keys().next().value;
        if (oldestKey) memoryStore.delete(oldestKey);
      }

      memoryStore.set(key, {
        value: freshValue,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });

      return freshValue;
    } finally {
      inFlightPromises.delete(key);
    }
  })();

  inFlightPromises.set(key, fetchPromise);
  return fetchPromise;
}

export function invalidateCache(keyPrefix?: string): number {
  if (!keyPrefix) {
    const count = memoryStore.size;
    memoryStore.clear();
    return count;
  }
  let deletedCount = 0;
  for (const key of memoryStore.keys()) {
    if (key.startsWith(keyPrefix)) {
      memoryStore.delete(key);
      deletedCount++;
    }
  }
  return deletedCount;
}

export function getCacheStats() {
  const total = cacheHits + cacheMisses;
  const hitRatio = total > 0 ? (cacheHits / total) * 100 : 0;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRatioPercent: Math.round(hitRatio * 10) / 10,
    activeEntries: memoryStore.size,
    maxEntries: MAX_CACHE_ENTRIES,
  };
}
