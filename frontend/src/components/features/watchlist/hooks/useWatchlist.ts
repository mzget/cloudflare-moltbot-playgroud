import { useCallback } from 'react';
import { API_BASE_URL } from '../../../../config';
import { useQuery } from '../../../../utils/useQuery';
import { useMutation } from '../../../../utils/useMutation';
import { invalidateQueries } from '../../../../utils/invalidateQueries';
import { useQueryCache } from '../../../../store/queryCache';

export interface WatchlistItem {
  symbol: string;
  name: string;
  is_active: number;
  in_portfolio: number;
  type: string;
  active_alerts_count?: number;
}

const WATCHLIST_KEY = 'watchlist';
const MARKET_STATS_KEY = 'market-stats';

async function fetchWatchlistFn(): Promise<WatchlistItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/watchlist`);
  if (!res.ok) throw new Error('Failed to fetch watchlist');
  return res.json();
}

async function fetchMarketStatsFn(): Promise<any[]> {
  const res = await fetch(`${API_BASE_URL}/api/market-intelligence`);
  if (!res.ok) throw new Error('Failed to fetch market stats');
  return res.json();
}

export function useWatchlist() {
  const { data: watchlist = [], refetch: fetchWatchlist } = useQuery<WatchlistItem[]>(
    WATCHLIST_KEY,
    fetchWatchlistFn
  );

  const { data: marketStats = [], refetch: fetchMarketStats } = useQuery<any[]>(
    MARKET_STATS_KEY,
    fetchMarketStatsFn
  );

  // --- addWatchlist ---
  const { mutateAsync: addWatchlist } = useMutation(
    async ({ symbol, name, type }: { symbol: string; name: string; type: string }) => {
      const res = await fetch(`${API_BASE_URL}/api/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: symbol.toUpperCase(), name, type }),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: ({ symbol, name, type }) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<WatchlistItem[]>(WATCHLIST_KEY).data ?? [];
        setEntry(WATCHLIST_KEY, {
          data: [...prev, { symbol: symbol.toUpperCase(), name, is_active: 1, in_portfolio: 0, type }] as unknown[],
        });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(WATCHLIST_KEY, { data: snapshot as unknown[] });
      },
      onSuccess: () => invalidateQueries(WATCHLIST_KEY),
    }
  );

  // --- updateWatchlistDetails ---
  const { mutateAsync: updateWatchlistDetails } = useMutation(
    async ({ symbol, name, type }: { symbol: string; name: string; type: string }) => {
      const res = await fetch(`${API_BASE_URL}/api/watchlist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, name, type }),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: ({ symbol, name, type }) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<WatchlistItem[]>(WATCHLIST_KEY).data ?? [];
        setEntry(WATCHLIST_KEY, {
          data: prev.map(item =>
            item.symbol === symbol ? { ...item, name, type } : item
          ) as unknown[],
        });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(WATCHLIST_KEY, { data: snapshot as unknown[] });
      },
      onSuccess: () => invalidateQueries(WATCHLIST_KEY),
    }
  );

  // --- deleteWatchlist ---
  const { mutateAsync: deleteWatchlist } = useMutation(
    async (symbol: string) => {
      const res = await fetch(`${API_BASE_URL}/api/watchlist?symbol=${symbol}`, { method: 'DELETE' });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: (symbol) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<WatchlistItem[]>(WATCHLIST_KEY).data ?? [];
        setEntry(WATCHLIST_KEY, {
          data: prev.filter(item => item.symbol !== symbol) as unknown[],
        });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(WATCHLIST_KEY, { data: snapshot as unknown[] });
      },
      onSuccess: () => invalidateQueries(WATCHLIST_KEY),
    }
  );

  // --- toggleActive ---
  const { mutateAsync: _toggleActive } = useMutation(
    async ({ symbol, currentStatus }: { symbol: string; currentStatus: number }) => {
      const res = await fetch(`${API_BASE_URL}/api/watchlist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, is_active: !currentStatus ? 1 : 0 }),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: ({ symbol, currentStatus }) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<WatchlistItem[]>(WATCHLIST_KEY).data ?? [];
        setEntry(WATCHLIST_KEY, {
          data: prev.map(item =>
            item.symbol === symbol ? { ...item, is_active: !currentStatus ? 1 : 0 } : item
          ) as unknown[],
        });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(WATCHLIST_KEY, { data: snapshot as unknown[] });
      },
      onSuccess: () => invalidateQueries(WATCHLIST_KEY),
    }
  );

  const toggleActive = useCallback(
    (symbol: string, currentStatus: number) => _toggleActive({ symbol, currentStatus }),
    [_toggleActive]
  );

  // --- togglePortfolioStatus ---
  const { mutateAsync: _togglePortfolioStatus } = useMutation(
    async ({ symbol, currentPortfolioStatus }: { symbol: string; currentPortfolioStatus: number }) => {
      const res = await fetch(`${API_BASE_URL}/api/watchlist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, in_portfolio: !currentPortfolioStatus ? 1 : 0 }),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: ({ symbol, currentPortfolioStatus }) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<WatchlistItem[]>(WATCHLIST_KEY).data ?? [];
        setEntry(WATCHLIST_KEY, {
          data: prev.map(item =>
            item.symbol === symbol ? { ...item, in_portfolio: !currentPortfolioStatus ? 1 : 0 } : item
          ) as unknown[],
        });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(WATCHLIST_KEY, { data: snapshot as unknown[] });
      },
      onSuccess: () => invalidateQueries(WATCHLIST_KEY),
    }
  );

  const togglePortfolioStatus = useCallback(
    (symbol: string, currentPortfolioStatus: number) =>
      _togglePortfolioStatus({ symbol, currentPortfolioStatus }),
    [_togglePortfolioStatus]
  );

  const addWatchlistFn = useCallback((symbol: string, name: string, type: string) => {
    return addWatchlist({ symbol, name, type });
  }, [addWatchlist]);

  const updateWatchlistDetailsFn = useCallback((symbol: string, name: string, type: string) => {
    return updateWatchlistDetails({ symbol, name, type });
  }, [updateWatchlistDetails]);

  return {
    watchlist,
    marketStats,
    addWatchlist: addWatchlistFn,
    updateWatchlistDetails: updateWatchlistDetailsFn,
    deleteWatchlist,
    toggleActive,
    togglePortfolioStatus,
    fetchWatchlist,
    fetchMarketStats,
  };
}
