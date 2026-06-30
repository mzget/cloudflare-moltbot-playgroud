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

  // Trigger fetch on mount or when key/enabled/staleTime change.
  // Reads cache state IMPERATIVELY (not reactively) to avoid the needsFetch feedback loop.
  useEffect(() => {
    if (!enabled) return;
    const current = useQueryCache.getState().getEntry<T>(key);
    const isStale = Date.now() - (current.updatedAt ?? 0) > staleTime;
    if ((current.status === 'idle' || isStale) && !current.promise) {
      doFetch();
    }
  }, [key, enabled, staleTime, doFetch, entry?.updatedAt, entry?.status]);

  return {
    data: entry?.data as T | undefined,
    status: entry?.status ?? 'idle',
    isLoading: entry?.status === 'loading',
    isError: entry?.status === 'error',
    error: entry?.error,
    refetch: doFetch,
  };
}
