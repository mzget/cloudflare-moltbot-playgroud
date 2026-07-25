import * as React from 'react';
import { Box, Sheet, Typography, Stack, Divider } from '@mui/joy';
import { BarChart3 } from 'lucide-react';
import CompanyStatsTable, { ALL_COLUMNS } from '../watchlist/CompanyStatsTable';
import CompanyStatsToolbar from '../watchlist/CompanyStatsToolbar';
import { useSettingsStore, type DensityMode } from '../../../store/settingsStore';
import { API_BASE_URL } from '../../../config';
import type { CompanyStats } from '../../../types/companyStats';
import { glassStyle } from '../../../styles/glass';
import { useAnalysisCoverage } from '../../../hooks/useAnalysisCoverage';

// ─── Default visible columns (spec: 6 on first load) ─────────────────────────

const DEFAULT_VISIBLE: Array<keyof CompanyStats> = ALL_COLUMNS.map(c => c.id);

// ─── Component ────────────────────────────────────────────────────────────────

export default function FundamentalDashboard() {
  const [data, setData] = React.useState<CompanyStats[]>([]);
  const [loading, setLoading] = React.useState(true);

  const density = useSettingsStore((state) => state.density);
  const storeColumns = useSettingsStore((state) => state.fundamentalVisibleColumns);
  const setStoreColumns = useSettingsStore((state) => state.setFundamentalVisibleColumns);

  const visibleColumnIds = React.useMemo<Array<keyof CompanyStats>>(() => {
    if (storeColumns && storeColumns.length > 0) {
      return storeColumns as Array<keyof CompanyStats>;
    }
    return DEFAULT_VISIBLE;
  }, [storeColumns]);

  const symbols = React.useMemo(() => data.map(d => d.symbol), [data]);
  const analysisCoverage = useAnalysisCoverage(symbols);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/market-intelligence`);
        if (res.ok) {
          const fetchedData = (await res.json()) as any;
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

  // Toggle a column on / off while preserving original column order and saving to user preferences
  const handleToggleColumn = (id: keyof CompanyStats) => {
    let next: Array<keyof CompanyStats>;
    if (visibleColumnIds.includes(id)) {
      if (visibleColumnIds.length === 1) return;
      next = visibleColumnIds.filter(c => c !== id);
    } else {
      const allIds = ALL_COLUMNS.map(c => c.id);
      const combined = [...visibleColumnIds, id];
      next = allIds.filter(colId => combined.includes(colId));
    }
    setStoreColumns(next);
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
            analysisCoverage={analysisCoverage}
          />
        )}
      </Sheet>
    </Box>
  );
}
