import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../../../config';
import type { Holding } from '../HoldingsTable';
import type { PortfolioSummary } from '../YahooPortfolio';

import { useSettingsStore } from '../../../../store/settingsStore';

export function usePortfolio() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const usdThbRate = useSettingsStore(state => state.usdThbRate);

  const fetchHoldings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/holdings`);
      if (res.ok) setHoldings(await res.json());
    } catch (e) { console.error('Failed to fetch holdings:', e); }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/summary?rate=${usdThbRate}`);
      if (res.ok) setSummary(await res.json());
    } catch (e) { console.error('Failed to fetch summary:', e); }
  }, [usdThbRate]);

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/watchlist`);
      if (res.ok) setWatchlist(await res.json());
    } catch (e) { console.error('Failed to fetch watchlist:', e); }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchHoldings(), fetchSummary(), fetchWatchlist()]);
    setLoading(false);
  }, [fetchHoldings, fetchSummary, fetchWatchlist]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 180000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return {
    holdings,
    summary,
    loading,
    watchlist,
    fetchAll,
  };
}
export type UsePortfolioReturn = ReturnType<typeof usePortfolio>;
