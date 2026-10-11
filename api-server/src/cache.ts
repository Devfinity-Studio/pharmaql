interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry<any>>();

export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  const freshValue = await fetcher();
  memoryStore.set(key, {
    value: freshValue,
    expiresAt: now + ttlSeconds * 1000,
  });

  return freshValue;
}

export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    memoryStore.clear();
    return;
  }
  for (const key of memoryStore.keys()) {
    if (key.startsWith(keyPrefix)) {
      memoryStore.delete(key);
    }
  }
}
