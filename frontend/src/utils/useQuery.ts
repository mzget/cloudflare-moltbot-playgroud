import { useEffect, useCallback, useRef } from 'react';
import { useQueryCache } from '../store/queryCache';
import type { CacheEntry } from '../store/queryCache';

export interface UseQueryOptions {
  /** Milliseconds the cached data is considered fresh. Default: 60_000 (1 min). */
  staleTime?: number;
  /** Set to false to skip fetching (useful for conditional queries). */
  enabled?: boolean;
}

export interface UseQueryResult<T> {
  data: T | undefined;
  status: 'idle' | 'loading' | 'success' | 'error';
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => Promise<void>;
}

const DEFAULT_STALE_TIME = 60_000;

export function useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseQueryOptions = {}
): UseQueryResult<T> {
  const { staleTime = DEFAULT_STALE_TIME, enabled = true } = options;

  // Keep the latest fetcher in a ref so doFetch doesn't need it as a dep.
  const fetcherRef = useRef(fetcher);
  useEffect(() => { fetcherRef.current = fetcher; });

  // Stable fetch function — reads cache imperatively to avoid reactive feedback loops.
  const doFetch = useCallback(async (): Promise<void> => {
    const { getEntry, setEntry } = useQueryCache.getState();
    const current = getEntry<T>(key);
    // Deduplication: skip if already in-flight.
    if (current.promise) return;

    const promise = fetcherRef.current();
    setEntry(key, { status: 'loading', promise: promise as Promise<unknown> });
    try {
      const data = await promise;
      useQueryCache.getState().setEntry(key, {
        data: data as unknown,
        status: 'success',
        error: null,
        updatedAt: Date.now(),
        promise: null,
      });
    } catch (error) {
      useQueryCache.getState().setEntry(key, { status: 'error', error, promise: null });
    }
  }, [key]); // Only depends on key; fetcher is via ref.

  // Reactive subscription — subscribe directly to entries[key] (not via getEntry)
  // to avoid new object references when the key is missing.
  const entry = useQueryCache(state => state.entries[key] as CacheEntry<T> | undefined);

  // Track explicit invalidation (updatedAt === 0)
  const isInvalidated = entry?.updatedAt === 0;

  // Trigger fetch on mount, when key/enabled/staleTime change, or when explicitly invalidated.
  // Reads cache state IMPERATIVELY to prevent infinite feedback loops.
  useEffect(() => {
    if (!enabled) return;
    const current = useQueryCache.getState().getEntry<T>(key);
    if (current.promise) return;

    const timeSinceUpdate = Date.now() - (current.updatedAt ?? 0);
    const isStale = (current.updatedAt ?? 0) === 0 || timeSinceUpdate > Math.max(staleTime, 100);

    if (current.status === 'idle' || isStale || isInvalidated) {
      doFetch();
    }
  }, [key, enabled, staleTime, doFetch, isInvalidated]);

  return {
    data: entry?.data as T | undefined,
    status: entry?.status ?? 'idle',
    isLoading: entry?.status === 'loading',
    isError: entry?.status === 'error',
    error: entry?.error,
    refetch: doFetch,
  };
}
