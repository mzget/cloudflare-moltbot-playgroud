import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../../../../config';

export interface MarketEvent {
  id: string;
  symbol: string;
  event_type: 'news' | 'dividend' | 'split' | 'earnings';
  event_date: string;
  title: string;
  description: string;
  url?: string;
  metadata?: string; // JSON string
  created_at: number;
}

export function useMarketEvents(symbol: string, eventType: string) {
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWatchlistSymbols = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/watchlist`);
      if (res.ok) {
        const data = (await res.json()) as any;
        const activeSymbols = data
          .filter((item: any) => item.is_active === 1)
          .map((item: any) => item.symbol);
        setSymbols(activeSymbols);
      }
    } catch (e) {
      console.error('Failed to fetch watchlist symbols', e);
    }
  }, []);

  const fetchEvents = useCallback(async (sym: string, type: string, isInitial = false) => {
    if (isInitial) setLoading(true);
    else setFetching(true);
    try {
      const params = new URLSearchParams();
      if (sym !== 'ALL') params.set('symbol', sym);
      if (type !== 'ALL') params.set('event_type', type);
      const url = `${API_BASE_URL}/api/market-events${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (res.ok) setEvents(await res.json());
    } catch (e) {
      console.error('Failed to fetch market events', e);
    } finally {
      if (isInitial) setLoading(false);
      else setFetching(false);
    }
  }, []);

  const triggerCrawl = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch(`${API_BASE_URL}/api/crawl-events`);
      setTimeout(async () => {
        await fetchEvents(symbol, eventType);
        setRefreshing(false);
      }, 3000);
    } catch (e) {
      console.error('Failed to trigger events crawl', e);
      setRefreshing(false);
    }
  }, [symbol, eventType, fetchEvents]);

  // Initial fetch on mount
  const isMounted = useRef(false);
  useEffect(() => {
    fetchWatchlistSymbols();
    fetchEvents('ALL', 'ALL', true);
    isMounted.current = true;
  }, [fetchWatchlistSymbols, fetchEvents]);

  // Re-fetch on filters change
  useEffect(() => {
    if (!isMounted.current) return;
    fetchEvents(symbol, eventType, false);
  }, [symbol, eventType, fetchEvents]);

  return {
    events,
    symbols,
    loading,
    fetching,
    refreshing,
    triggerCrawl
  };
}
