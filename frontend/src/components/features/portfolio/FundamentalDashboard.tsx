import * as React from 'react';
import { Box, Sheet, Typography, Stack, Divider } from '@mui/joy';
import { BarChart3 } from 'lucide-react';
import CompanyStatsTable, { ALL_COLUMNS } from '../watchlist/CompanyStatsTable';
import CompanyStatsToolbar from '../watchlist/CompanyStatsToolbar';
import type { DensityMode } from '../watchlist/CompanyStatsToolbar';
import { API_BASE_URL } from '../../../config';
import type { CompanyStats } from '../../../types/companyStats';
import { glassStyle } from '../../../styles/glass';

// ─── Default visible columns (spec: 6 on first load) ─────────────────────────

const DEFAULT_VISIBLE: Array<keyof CompanyStats> = ALL_COLUMNS.map(c => c.id);

// ─── Component ────────────────────────────────────────────────────────────────

export default function FundametalDashboard() {
  const [data, setData] = React.useState<CompanyStats[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [visibleColumnIds, setVisibleColumnIds] =
    React.useState<Array<keyof CompanyStats>>(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('visible_columns');
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as Array<keyof CompanyStats>;
            if (!parsed.includes('price')) {
              return ['price', ...parsed];
            }
            return parsed;
          } catch (e) {
            console.error("Failed to parse visible_columns", e);
          }
        }
      }
      return DEFAULT_VISIBLE;
    });
  const [density, setDensity] = React.useState<DensityMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('table_density');
      if (saved && ['compact', 'cozy', 'comfort'].includes(saved)) {
        return saved as DensityMode;
      }
    }
    return 'cozy';
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
    localStorage.setItem('table_density', density);
  }, [density]);

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
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
          <BarChart3 size={28} color="#2ecc71" />
          <Typography level="h2" sx={{ fontWeight: 700 }}>
            Fundamental Dashboard
          </Typography>
        </Stack>
        <Typography level="body-md" sx={{ opacity: 0.6, pl: 0.5 }}>
          Fundamental financial metrics · {data.length} companies
        </Typography>
      </Box>

      {/* ── Stats table card ──────────────────────────────────── */}
      <Sheet sx={{ ...glassStyle, p: { xs: 2, md: 3 }, overflow: 'hidden' }}>
        {/* Toolbar with controls and actions */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <CompanyStatsToolbar
            visibleColumnIds={visibleColumnIds}
            onToggleColumn={handleToggleColumn}
            density={density}
            onDensityChange={setDensity}
          />
        </Stack>

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
            scale="B"
            density={density}
          />
        )}
      </Sheet>
    </Box>
  );
}
