import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../../../config';

export interface WatchlistItem {
  symbol: string;
  name: string;
  is_active: number;
  in_portfolio: number;
  active_alerts_count?: number;
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [marketStats, setMarketStats] = useState<any[]>([]);

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/watchlist`);
      if (res.ok) setWatchlist(await res.json());
    } catch (e) {
      console.error("Failed to fetch watchlist", e);
    }
  }, []);

  const fetchMarketStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/market-intelligence`);
      if (res.ok) setMarketStats(await res.json());
    } catch (e) {
      console.error("Failed to fetch market stats", e);
    }
  }, []);

  const addWatchlist = async (symbol: string, name: string) => {
    const res = await fetch(`${API_BASE_URL}/api/watchlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: symbol.toUpperCase(), name })
    });
    if (res.ok) {
      await fetchWatchlist();
    }
    return res;
  };

  const deleteWatchlist = async (symbol: string) => {
    const res = await fetch(`${API_BASE_URL}/api/watchlist?symbol=${symbol}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchWatchlist();
    }
    return res;
  };

  const toggleActive = async (symbol: string, currentStatus: number) => {
    const res = await fetch(`${API_BASE_URL}/api/watchlist`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, is_active: !currentStatus ? 1 : 0 })
    });
    if (res.ok) {
      await fetchWatchlist();
    }
    return res;
  };

  const togglePortfolioStatus = async (symbol: string, currentPortfolioStatus: number) => {
    const res = await fetch(`${API_BASE_URL}/api/watchlist`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, in_portfolio: !currentPortfolioStatus ? 1 : 0 })
    });
    if (res.ok) {
      await fetchWatchlist();
    }
    return res;
  };

  useEffect(() => {
    fetchWatchlist();
    fetchMarketStats();
  }, [fetchWatchlist, fetchMarketStats]);

  return {
    watchlist,
    marketStats,
    addWatchlist,
    deleteWatchlist,
    toggleActive,
    togglePortfolioStatus,
    fetchWatchlist,
    fetchMarketStats
  };
}
