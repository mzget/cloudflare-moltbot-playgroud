import React from 'react';
import { Box, Typography, Sheet, Chip, Divider, Stack } from '@mui/joy';
import { TrendingUp } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';
import { formatCurrency, formatPct } from './YahooPortfolio';
import type { PortfolioSummary } from './YahooPortfolio';
import PortfolioChart from './PortfolioChart';

interface SummaryTabProps {
  summary: PortfolioSummary;
  holdingsCount: number;
  openPositionsCount: number;
}

export default function SummaryTab({ summary, holdingsCount, openPositionsCount }: SummaryTabProps) {
  return (
    <Box className="tab-pane-active">
      <Sheet sx={{ ...glassStyle, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 3 }}>
          <Box sx={{ minWidth: 260 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
              <Typography level="h2" sx={{ fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.02em' }}>
                {formatCurrency(summary.total_market_value, false)}
              </Typography>
              <Chip
                variant="soft"
                color="success"
                size="sm"
                startDecorator={<TrendingUp size={14} />}
                sx={{ borderRadius: '8px', fontWeight: 600 }}
              >
                Bullish
              </Chip>
            </Box>
            <Typography level="body-sm" sx={{ opacity: 0.6, display: 'flex', alignItems: 'center' }}>
              <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', bgcolor: 'var(--yf-positive)', mr: 0.75 }} />
              Market Value
            </Typography>
            <Divider sx={{ my: 1.5, opacity: 0.15 }} />
            <Stack spacing={0.75}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                <Typography level="body-sm" sx={{ opacity: 0.7 }}>Total Cost</Typography>
                <Typography level="body-sm" sx={{ fontWeight: 700 }}>
                  {formatCurrency(summary.total_cost, false)}
                </Typography>
              </Box>
              {[
                { label: 'Day Change', val: summary.day_change_amt, pct: summary.day_change_pct },
                { label: 'Unrealized G/L', val: summary.unrealized_gain_amt, pct: summary.unrealized_gain_pct },
              ].map(item => (
                <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                  <Typography level="body-sm" sx={{ opacity: 0.7 }}>{item.label}</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 700 }} className={item.val >= 0 ? 'yf-positive' : 'yf-negative'}>
                    {formatCurrency(item.val)} ({formatPct(item.pct)})
                  </Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                <Typography level="body-sm" sx={{ opacity: 0.7 }}>Realized G/L</Typography>
                <Typography level="body-sm" sx={{ fontWeight: 700 }} className={summary.realized_gain_amt >= 0 ? 'yf-positive' : 'yf-negative'}>
                  {formatCurrency(summary.realized_gain_amt)}
                </Typography>
              </Box>
            </Stack>
            <Divider sx={{ my: 1.5, opacity: 0.15 }} />
            <Typography level="body-xs" sx={{ opacity: 0.5, fontWeight: 500 }}>
              {holdingsCount} holdings · {openPositionsCount} open positions
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 300, maxWidth: 600, width: '100%', display: 'block' }}>
            <PortfolioChart />
          </Box>
        </Box>
      </Sheet>
    </Box>
  );
}
