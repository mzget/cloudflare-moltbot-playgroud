import * as React from 'react';
import { Box, Sheet, Typography, Stack, Chip, Divider } from '@mui/joy';
import { BarChart3, TrendingUp } from 'lucide-react';
import CompanyStatsTable, { ALL_COLUMNS } from './CompanyStatsTable';
import CompanyStatsToolbar from './CompanyStatsToolbar';
import { API_BASE_URL } from '../config';
import type { ScaleUnit } from './CompanyStatsTable';
import type { CompanyStats } from '../types/companyStats';
import { glassStyle } from '../styles/glass';

// ─── Default visible columns (spec: 6 on first load) ─────────────────────────

const DEFAULT_VISIBLE: Array<keyof CompanyStats> = ALL_COLUMNS.map(c => c.id);

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarketIntelligenceTable() {
  const [data, setData] = React.useState<CompanyStats[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [visibleColumnIds, setVisibleColumnIds] =
    React.useState<Array<keyof CompanyStats>>(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('visible_columns');
        if (saved) return JSON.parse(saved);
      }
      return DEFAULT_VISIBLE;
    });
  const [scale, setScale] = React.useState<ScaleUnit>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('table_scale');
      if (saved) return saved as ScaleUnit;
    }
    return 'B';
  });

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/market-intelligence`);
        if (res.ok) {
          const fetchedData = await res.json();
          // Ensure name exists for display and normalize types
          const normalizedData = fetchedData.map((item: any) => ({
            ...item,
            name: item.name || item.symbol || 'Unknown',
            exchange: item.exchange || 'N/A'
          }));
          setData(normalizedData);
        }
      } catch (e) {
        console.error("Failed to fetch market intelligence data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  React.useEffect(() => {
    localStorage.setItem('visible_columns', JSON.stringify(visibleColumnIds));
  }, [visibleColumnIds]);

  React.useEffect(() => {
    localStorage.setItem('table_scale', scale);
  }, [scale]);

  // Toggle a column on / off while preserving original column order
  const handleToggleColumn = (id: keyof CompanyStats) => {
    setVisibleColumnIds(prev => {
      if (prev.includes(id)) {
        // Don't allow hiding all columns
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== id);
      } else {
        // Re-insert in spec order
        const allIds = ALL_COLUMNS.map(c => c.id);
        const next = [...prev, id];
        return allIds.filter(colId => next.includes(colId));
      }
    });
  };

  return (
    <Box>
      {/* ── Page header ───────────────────────────────────────── */}
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 4 }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
            <BarChart3 size={28} color="#2ecc71" />
            <Typography level="h2" sx={{ fontWeight: 700 }}>
              Market Intelligence
            </Typography>
          </Stack>
          <Typography level="body-md" sx={{ opacity: 0.6, pl: 0.5 }}>
            Fundamental financial metrics · {data.length} companies
          </Typography>
        </Box>

        <Sheet
          sx={{
            ...glassStyle,
            px: 3,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography level="body-sm" sx={{ opacity: 0.7 }}>
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
      </Stack>

      {/* ── Stats table card ──────────────────────────────────── */}
      <Sheet sx={{ ...glassStyle, p: { xs: 2, md: 3 }, overflow: 'hidden' }}>
        {/* Toolbar */}
        <CompanyStatsToolbar
          visibleColumnIds={visibleColumnIds}
          onToggleColumn={handleToggleColumn}
          scale={scale}
          onScaleChange={setScale}
        />

        <Divider sx={{ mb: 2, opacity: 0.1 }} />

        {/* Table */}
        {loading ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <Typography level="body-md" sx={{ opacity: 0.5 }}>
              Loading intelligence data...
            </Typography>
          </Box>
        ) : data.length === 0 ? (
          <Box sx={{ py: 10, textAlign: 'center' }}>
            <Typography level="body-md" sx={{ opacity: 0.5 }}>
              No active watchlist items found.
            </Typography>
          </Box>
        ) : (
          <CompanyStatsTable
            data={data}
            visibleColumnIds={visibleColumnIds}
            scale={scale}
          />
        )}
      </Sheet>
    </Box>
  );
}
