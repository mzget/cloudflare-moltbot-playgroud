import { useCallback } from 'react';
import { API_BASE_URL } from '../../../../config';
import type { Holding } from '../HoldingsTable';
import type { PortfolioSummary } from '../YahooPortfolio';
import { useSettingsStore } from '../../../../store/settingsStore';
import { useQuery } from '../../../../utils/useQuery';
import { invalidateQueries } from '../../../../utils/invalidateQueries';

const HOLDINGS_KEY = 'holdings';
const WATCHLIST_KEY = 'watchlist';

export function usePortfolio() {
  const usdThbRate = useSettingsStore(state => state.usdThbRate);

  const { data: holdings = [], status: holdingsStatus } = useQuery<Holding[]>(
    HOLDINGS_KEY,
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/holdings`);
      if (!res.ok) throw new Error('Failed to fetch holdings');
      return res.json();
    }
  );

  const { data: summary = null, status: summaryStatus } = useQuery<PortfolioSummary | null>(
    `summary-${usdThbRate}`,
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/summary?rate=${usdThbRate}`);
      if (!res.ok) throw new Error('Failed to fetch summary');
      return res.json();
    }
  );

  const { data: watchlist = [] } = useQuery<any[]>(
    WATCHLIST_KEY,
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/watchlist`);
      if (!res.ok) throw new Error('Failed to fetch watchlist');
      return res.json();
    }
  );

  const loading = holdingsStatus === 'loading' || summaryStatus === 'loading';

  const fetchAll = useCallback(() => {
    invalidateQueries([HOLDINGS_KEY, `summary-${usdThbRate}`, WATCHLIST_KEY]);
  }, [usdThbRate]);

  return {
    holdings,
    summary,
    loading,
    watchlist,
    fetchAll,
  };
}

export type UsePortfolioReturn = ReturnType<typeof usePortfolio>;
