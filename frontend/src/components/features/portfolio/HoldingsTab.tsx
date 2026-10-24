import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Box, Typography, Sheet, Button, ButtonGroup, Stack, Chip } from '@mui/joy';
import { Plus } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';
import HoldingsTable from './HoldingsTable';
import type { Holding } from './HoldingsTable';
import { useSettingsStore, type DensityMode } from '../../../store/settingsStore';
import ExpandedRow from '../watchlist/ExpandedRow';
import { useAnalysisCoverage } from '../../../hooks/useAnalysisCoverage';
import { matchesMosFilter, MOS_FILTER_LABELS, type MosFilter } from '../../../utils/marginOfSafety';

interface HoldingsTabProps {
  holdings: Holding[];
  loading: boolean;
  onAddTicker: () => void;
  onDataChange: () => void;
}

export default function HoldingsTab({ holdings, loading, onAddTicker, onDataChange }: HoldingsTabProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string>('total_cost');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const density = useSettingsStore((state) => state.density);
  const [mosFilter, setMosFilter] = useState<MosFilter>('all');

  const symbols = useMemo(() => holdings.map(h => h.symbol), [holdings]);
  const analysisCoverage = useAnalysisCoverage(symbols);

  const sortedHoldings = useMemo(() => {
    return holdings.filter((h) => matchesMosFilter(h, mosFilter)).sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : (aVal as number) - (bVal as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [holdings, sortBy, sortDir, mosFilter]);

  const handleSort = useCallback((column: string) => {
    if (sortBy === column) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir(column === 'total_cost' ? 'desc' : 'asc');
    }
  }, [sortBy]);

  const handleExpandRow = useCallback((symbol: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  }, []);

  return (
    <Box className="tab-pane-active">
      <Sheet sx={{ ...glassStyle, p: 0, overflow: 'hidden' }}>
        {holdings.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap', gap: 1.5 }}>
            <Typography level="title-md" sx={{ fontWeight: 700 }}>
              Positions
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap data-testid="mos-filter-chips">
              <Typography level="body-sm" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>MoS:</Typography>
              {(Object.keys(MOS_FILTER_LABELS) as MosFilter[]).map((f) => (
                <Chip
                  key={f}
                  size="sm"
                  variant={mosFilter === f ? 'solid' : 'outlined'}
                  color={mosFilter === f ? 'primary' : 'neutral'}
                  onClick={() => setMosFilter(f)}
                  sx={{ cursor: 'pointer', fontWeight: 600, transition: 'all 0.3s ease-out' }}
                >
                  {MOS_FILTER_LABELS[f]}
                </Chip>
              ))}
            </Stack>
            <Button variant="outlined" color="neutral" size="sm" startDecorator={<Plus size={16} />}
              onClick={onAddTicker} sx={{ borderRadius: '20px', fontWeight: 600, px: 2 }}>
              Add Ticker
            </Button>
          </Box>
        )}
        <Box sx={{ overflowX: 'auto' }}>
          <HoldingsTable holdings={sortedHoldings} onExpandRow={handleExpandRow} expandedRows={expandedRows}
            sortBy={sortBy} sortDir={sortDir} onSort={handleSort} density={density} analysisCoverage={analysisCoverage}
            expandedContent={(symbol: string, lastPrice: number | null, colSpan: number) => (
              <ExpandedRow symbol={symbol} lastPrice={lastPrice} colSpan={colSpan} onDataChange={onDataChange} />
            )} />
        </Box>
        {holdings.length === 0 && !loading && (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography level="h4" sx={{ mb: 1, opacity: 0.6 }}>No holdings yet</Typography>
            <Typography level="body-sm" sx={{ mb: 3, opacity: 0.4 }}>Add tickers to start tracking your portfolio</Typography>
            <Button variant="solid" color="primary" startDecorator={<Plus size={16} />} onClick={onAddTicker}>
              Add your first ticker
            </Button>
          </Box>
        )}
      </Sheet>
    </Box>
  );
}
