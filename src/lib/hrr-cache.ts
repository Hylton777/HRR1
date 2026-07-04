type CacheEntry<T> = {
  value: T;
  fetchedAt: number;
  expiresAt: number;
};

/** How long cached HRR results stay fresh before a background refresh. */
export const RESULTS_TTL_MS = 30_000;

/** Timetable HTML changes less often than results during race day. */
export const TIMETABLE_TTL_MS = 60_000;

/** Serve stale data up to this age when HRR is slow or unavailable. */
export const STALE_MAX_MS = 10 * 60_000;

/** Abort HRR fetches that hang longer than this. */
export const HRR_FETCH_TIMEOUT_MS = 15_000;

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function storeEntry<T>(key: string, ttlMs: number, value: T): T {
  const now = Date.now();
  cache.set(key, { value, fetchedAt: now, expiresAt: now + ttlMs });
  return value;
}

async function fetchAndStore<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const stale = cache.get(key) as CacheEntry<T> | undefined;

  try {
    const value = await fetcher();
    return storeEntry(key, ttlMs, value);
  } catch (error) {
    if (stale && Date.now() - stale.fetchedAt < STALE_MAX_MS) {
      return stale.value;
    }
    throw error;
  }
}

function startBackgroundRefresh<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): void {
  if (inflight.has(key)) return;

  const promise = fetchAndStore(key, ttlMs, fetcher).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
}

/**
 * TTL cache with single-flight deduplication, stale-while-revalidate, and
 * stale-if-error fallback when upstream HRR requests fail or time out.
 */
export async function cachedFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;

  if (hit && now < hit.expiresAt) {
    return hit.value;
  }

  if (hit && now - hit.fetchedAt < STALE_MAX_MS) {
    startBackgroundRefresh(key, ttlMs, fetcher);
    return hit.value;
  }

  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetchAndStore(key, ttlMs, fetcher).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

/** @internal Test helper — clears in-memory cache between tests. */
export function clearHrrCacheForTests(): void {
  cache.clear();
  inflight.clear();
}
