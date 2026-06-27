import { useQueryCache } from '../store/queryCache';

/**
 * Mark one or more query cache keys as stale.
 * Any mounted `useQuery` subscriber for those keys will immediately re-fetch.
 *
 * Usage:
 *   invalidateQueries('watchlist');
 *   invalidateQueries(['holdings', 'summary']);
 */
export function invalidateQueries(keys: string | string[]): void {
  const { invalidate } = useQueryCache.getState();
  const keyArray = Array.isArray(keys) ? keys : [keys];
  keyArray.forEach(k => invalidate(k));
}
