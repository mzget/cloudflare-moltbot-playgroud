import React, { useState } from 'react';
import MarketBreakouts from './MarketBreakouts';
import MyWatchlist from './MyWatchlist';
import { Box, Typography, Tabs, TabList, Tab } from '@mui/joy';

export default function Watchlist() {
  const [activeSubTab, setActiveSubTab] = useState<'my-watchlist' | 'market-breakouts'>('my-watchlist');

  return (
    <Box sx={{ p: 2 }}>
      <Typography level="h3" sx={{ mb: 3 }}>Investment Watchlist</Typography>

      <Tabs
        value={activeSubTab}
        onChange={(_, val) => setActiveSubTab(val as 'my-watchlist' | 'market-breakouts')}
        sx={{ bgcolor: 'transparent', mb: 3 }}
      >
        <TabList variant="soft">
          <Tab disableIndicator value="my-watchlist">My Watchlist</Tab>
          <Tab disableIndicator value="market-breakouts">Market Breakouts</Tab>
        </TabList>
      </Tabs>

      {activeSubTab === 'market-breakouts' ? (
        <MarketBreakouts />
      ) : (
        <MyWatchlist />
      )}
    </Box>
  );
}
