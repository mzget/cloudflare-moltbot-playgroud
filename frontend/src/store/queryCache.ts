import { create } from 'zustand';

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface CacheEntry<T = unknown> {
  data: T | undefined;
  status: QueryStatus;
  error: unknown;
  updatedAt: number; // ms timestamp of last successful fetch
  promise: Promise<T> | null; // in-flight request for deduplication
}

function defaultEntry<T>(): CacheEntry<T> {
  return { data: undefined, status: 'idle', error: null, updatedAt: 0, promise: null };
}

interface QueryCacheStore {
  entries: Record<string, CacheEntry<unknown>>;
  getEntry: <T>(key: string) => CacheEntry<T>;
  setEntry: (key: string, patch: Partial<CacheEntry<unknown>>) => void;
  invalidate: (key: string) => void;
}

export const useQueryCache = create<QueryCacheStore>((set, get) => ({
  entries: {},

  getEntry: <T>(key: string): CacheEntry<T> => {
    return (get().entries[key] as CacheEntry<T>) ?? defaultEntry<T>();
  },

  setEntry: (key, patch) =>
    set(state => ({
      entries: {
        ...state.entries,
        [key]: { ...(state.entries[key] ?? defaultEntry()), ...patch },
      },
    })),

  /** Mark a key stale (updatedAt = 0) so the next subscriber triggers a fetch. */
  invalidate: (key: string) =>
    set(state => {
      const prev = state.entries[key] ?? defaultEntry();
      return {
        entries: {
          ...state.entries,
          [key]: { ...prev, updatedAt: 0, promise: null },
        },
      };
    }),
}));
