import React from 'react';
import { Box, Typography, Sheet, Chip } from '@mui/joy';
import { TrendingUp } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';
import { formatCurrency, formatPct } from './YahooPortfolio';
import type { PortfolioSummary } from './YahooPortfolio';

interface SummaryTabProps {
  summary: PortfolioSummary;
  holdingsCount: number;
  openPositionsCount: number;
}

export default function SummaryTab({ summary, holdingsCount, openPositionsCount }: SummaryTabProps) {
  return (
    <Box className="tab-pane-active">
      <Sheet sx={{ ...glassStyle, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
          <Typography level="h4" sx={{ fontWeight: 700 }}>Portfolio Summary</Typography>
          <Sheet
            sx={{
              ...glassStyle,
              px: 2,
              py: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              borderRadius: '12px'
            }}
          >
            <Typography level="body-xs" sx={{ opacity: 0.7 }}>
              Portfolio Sentiment
            </Typography>
            <Chip
              variant="soft"
              color="success"
              size="sm"
              startDecorator={<TrendingUp size={14} />}
            >
              Bullish
            </Chip>
          </Sheet>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          {[
            { label: 'Total Market Value', value: formatCurrency(summary.total_market_value, false) },
            { label: 'Total Cost Basis', value: formatCurrency(summary.total_cost, false) },
            { label: 'Day Change', value: formatCurrency(summary.day_change_amt), cls: summary.day_change_amt >= 0 ? 'yf-positive' : 'yf-negative' },
            { label: 'Unrealized G/L', value: formatCurrency(summary.unrealized_gain_amt), cls: summary.unrealized_gain_amt >= 0 ? 'yf-positive' : 'yf-negative' },
          ].map(card => (
            <Box key={card.label} sx={{ p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
              <Typography level="body-xs" sx={{ opacity: 0.6, mb: 0.5 }}>{card.label}</Typography>
              <Typography level="h4" sx={{ fontWeight: 800 }} className={card.cls || ''}>{card.value}</Typography>
            </Box>
          ))}
        </Box>
        <Typography level="body-sm" sx={{ opacity: 0.5, mt: 2 }}>
          {holdingsCount} holdings · {openPositionsCount} open positions
        </Typography>
      </Sheet>
    </Box>
  );
}
