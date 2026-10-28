import React, { useState, useEffect } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';
import MarketBreakouts from './MarketBreakouts';
import MyWatchlist from './MyWatchlist';
import FundamentalDashboard from '../portfolio/FundamentalDashboard';
import NotFoundPage from '../error/NotFoundPage';
import { Box, Typography, Tabs, TabList, Tab } from '@mui/joy';

const VALID_TABS = ['my-watchlist', 'fundamentals', 'market-breakouts'] as const;
type WatchlistSubTab = (typeof VALID_TABS)[number];

export default function Watchlist() {
  const search = useSearch({ strict: false }) as any;
  const navigate = useNavigate();

  // If tab parameter is explicitly provided, validate it.
  const hasTabParam = typeof search?.tab === 'string' && search.tab.trim().length > 0;
  const isTabValid = !hasTabParam || VALID_TABS.includes(search.tab as WatchlistSubTab);

  const activeSubTab: WatchlistSubTab = (hasTabParam && VALID_TABS.includes(search.tab))
    ? (search.tab as WatchlistSubTab)
    : 'my-watchlist';

  const [optimisticTab, setOptimisticTab] = useState<WatchlistSubTab>(activeSubTab);

  useEffect(() => {
    setOptimisticTab(activeSubTab);
  }, [activeSubTab]);

  if (!isTabValid) {
    return <NotFoundPage />;
  }

  const handleTabChange = (val: WatchlistSubTab) => {
    setOptimisticTab(val);
    React.startTransition(() => {
      navigate({
        search: {
          ...search,
          tab: val,
        },
      });
    });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography level="h3" sx={{ mb: 3 }}>Investment Watchlist</Typography>

      <Tabs
        value={optimisticTab}
        onChange={(_, val) => handleTabChange(val as WatchlistSubTab)}
        sx={{ bgcolor: 'transparent', mb: 3 }}
      >
        <TabList variant="soft">
          <Tab disableIndicator value="my-watchlist">My Watchlist</Tab>
          <Tab disableIndicator value="fundamentals">Fundamentals</Tab>
          <Tab disableIndicator value="market-breakouts">Watchlist Breakouts</Tab>
        </TabList>
      </Tabs>

      {optimisticTab === 'market-breakouts' && <MarketBreakouts />}
      {optimisticTab === 'fundamentals' && <FundamentalDashboard />}
      {optimisticTab === 'my-watchlist' && <MyWatchlist />}
    </Box>
  );
}
