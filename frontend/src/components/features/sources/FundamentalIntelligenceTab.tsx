import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Sheet,
  Table,
  Button,
  IconButton,
  Input,
  Chip,
  Stack,
  Grid,
  Alert,
  CircularProgress,
  Link,
  Card,
  CardContent,
} from '@mui/joy';
import {
  Search,
  X,
  RotateCw,
  Copy,
  AlertCircle,
  CheckCircle2,
  Clock,
  Database,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useSettingsStore, type DensityMode } from '../../../store/settingsStore';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';
import { FundamentalFreshnessBadge, type FreshnessStatus } from './FundamentalFreshnessBadge';
import { CopyPromptModal } from './CopyPromptModal';

export interface FundamentalStatusItem {
  symbol: string;
  company_name: string;
  as_of_date: string | null;
  status: FreshnessStatus | string;
  source_count: number;
  theme_tags: string[];
  updated_at: string | null;
}

export interface FundamentalStatusResponse {
  items: FundamentalStatusItem[];
  summary?: {
    total: number;
    active: number;
    stale: number;
    missing: number;
  };
}

export interface FundamentalIntelligenceTabProps {
  /** Optional initial items for SSR testing or preloaded states */
  initialItems?: FundamentalStatusItem[];
  /** Optional flag to suppress auto-fetch on mount (useful in tests) */
  autoFetch?: boolean;
  /** Optional callback when clicking View Analysis */
  onViewAnalysis?: (symbol: string) => void;
  /** Optional table density override */
  density?: DensityMode;
  /** Display layout: classic table (default) or one card per symbol */
  layout?: 'table' | 'cards';
}

export const FundamentalIntelligenceTab: React.FC<FundamentalIntelligenceTabProps> = ({
  initialItems,
  autoFetch = true,
  onViewAnalysis,
  density: propDensity,
  layout = 'table',
}) => {
  let routerNavigate: any = null;
  try {
    routerNavigate = useNavigate();
  } catch {
    routerNavigate = null;
  }

  let storeDensity: DensityMode = 'cozy';
  try {
    storeDensity = useSettingsStore((state) => state.density);
  } catch {
    storeDensity = 'cozy';
  }
  const activeDensity = propDensity || storeDensity || 'cozy';

  const densityStyles = useMemo(() => {
    const config = {
      compact: {
        paddingX: '8px',
        paddingY: '5px',
        fontSize: '0.75rem',
      },
      cozy: {
        paddingX: '12px',
        paddingY: '9px',
        fontSize: '0.8rem',
      },
      comfort: {
        paddingX: '18px',
        paddingY: '14px',
        fontSize: '0.88rem',
      },
    };
    return config[activeDensity] || config.cozy;
  }, [activeDensity]);

  const handleViewAnalysis = useCallback((symbol: string) => {
    if (onViewAnalysis) {
      onViewAnalysis(symbol);
    } else if (routerNavigate) {
      routerNavigate({
        to: '/analysis',
        search: { symbol, tab: 'dossier' },
      });
    } else if (typeof window !== 'undefined') {
      window.location.href = `/analysis?symbol=${encodeURIComponent(symbol)}&tab=dossier`;
    }
  }, [onViewAnalysis, routerNavigate]);

  const [items, setItems] = useState<FundamentalStatusItem[]>(initialItems || []);
  const [loading, setLoading] = useState<boolean>(!initialItems && autoFetch);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'stale' | 'missing'>('all');
  const [selectedStockForPrompt, setSelectedStockForPrompt] = useState<FundamentalStatusItem | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fundamentals/status`);
      if (!res.ok) {
        throw new Error(`Failed to load fundamental status (HTTP ${res.status})`);
      }
      const data: FundamentalStatusResponse = await res.json();
      setItems(data.items || []);
    } catch (err: any) {
      console.error('[FundamentalIntelligenceTab] Fetch error:', err);
      setError(err?.message || 'Failed to fetch fundamental intelligence status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch && !initialItems) {
      fetchStatus();
    }
  }, [autoFetch, initialItems, fetchStatus]);

  // Compute summary stats dynamically
  const summary = useMemo(() => {
    let active = 0;
    let stale = 0;
    let missing = 0;

    items.forEach((item) => {
      const s = String(item.status).toLowerCase();
      if (s === 'active') active++;
      else if (s === 'stale') stale++;
      else missing++;
    });

    return {
      total: items.length,
      active,
      stale,
      missing,
    };
  }, [items]);

  // Filter items by search query and status filter
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      // Status filter
      if (statusFilter !== 'all') {
        const itemStatus = String(item.status).toLowerCase();
        if (itemStatus !== statusFilter) return false;
      }
      // Search filter
      if (q) {
        const matchesSymbol = item.symbol.toLowerCase().includes(q);
        const matchesName = (item.company_name || '').toLowerCase().includes(q);
        const matchesThemes = (item.theme_tags || []).some((t) => t.toLowerCase().includes(q));
        if (!matchesSymbol && !matchesName && !matchesThemes) return false;
      }
      return true;
    });
  }, [items, searchQuery, statusFilter]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1, pb: 4 }}>
      {/* Header Description */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
        <Box>
          <Typography level="h3" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
            Fundamental Intelligence
          </Typography>
          <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
            Track qualitative research freshness, filing dates, and linked themes for watchlist equities.
          </Typography>
        </Box>
        <Button
          variant="soft"
          color="neutral"
          startDecorator={<RotateCw size={16} />}
          loading={loading}
          onClick={fetchStatus}
          sx={{ borderRadius: '10px', fontWeight: 600 }}
        >
          Refresh Status
        </Button>
      </Stack>

      {/* Summary Stat Cards Grid */}
      <Grid container spacing={2}>
        {/* Total Tickers */}
        <Grid xs={12} sm={6} md={3} lg={3} xl={3}>
          <Sheet
            sx={{
              ...glassStyle,
              p: 2.5,
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              height: '100%',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography level="title-sm" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Total Tickers
              </Typography>
              <Database size={18} color="var(--joy-palette-primary-500)" />
            </Stack>
            <Typography level="h2" sx={{ fontWeight: 800 }}>
              {summary.total}
            </Typography>
            <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
              Tracked watchlist securities
            </Typography>
          </Sheet>
        </Grid>

        {/* Active (<90d) */}
        <Grid xs={12} sm={6} md={3} lg={3} xl={3}>
          <Sheet
            sx={{
              ...glassStyle,
              p: 2.5,
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              height: '100%',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography level="title-sm" sx={{ color: 'success.main', fontWeight: 600 }}>
                Active (&lt;90d)
              </Typography>
              <CheckCircle2 size={18} color="var(--joy-palette-success-500)" />
            </Stack>
            <Typography level="h2" sx={{ fontWeight: 800, color: 'success.main' }}>
              {summary.active}
            </Typography>
            <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
              Fresh qualitative filing coverage
            </Typography>
          </Sheet>
        </Grid>

        {/* Stale (≥90d) */}
        <Grid xs={12} sm={6} md={3} lg={3} xl={3}>
          <Sheet
            sx={{
              ...glassStyle,
              p: 2.5,
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              height: '100%',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography level="title-sm" sx={{ color: 'warning.main', fontWeight: 600 }}>
                Stale (≥90d)
              </Typography>
              <Clock size={18} color="var(--joy-palette-warning-500)" />
            </Stack>
            <Typography level="h2" sx={{ fontWeight: 800, color: 'warning.main' }}>
              {summary.stale}
            </Typography>
            <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
              Quarterly update recommended
            </Typography>
          </Sheet>
        </Grid>

        {/* Missing */}
        <Grid xs={12} sm={6} md={3} lg={3} xl={3}>
          <Sheet
            sx={{
              ...glassStyle,
              p: 2.5,
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              height: '100%',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography level="title-sm" sx={{ color: 'danger.main', fontWeight: 600 }}>
                Missing
              </Typography>
              <AlertCircle size={18} color="var(--joy-palette-danger-500)" />
            </Stack>
            <Typography level="h2" sx={{ fontWeight: 800, color: 'danger.main' }}>
              {summary.missing}
            </Typography>
            <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
              Needs fundamental brief ingestion
            </Typography>
          </Sheet>
        </Grid>
      </Grid>

      {/* Error Alert */}
      {error && (
        <Alert
          color="danger"
          variant="soft"
          startDecorator={<AlertCircle size={20} />}
          endDecorator={
            <Button size="sm" variant="soft" color="danger" onClick={fetchStatus}>
              Retry
            </Button>
          }
          sx={{ borderRadius: '12px' }}
        >
          {error}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <Sheet
        sx={{
          ...glassStyle,
          p: 2,
          borderRadius: '16px',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', md: 'center' },
          gap: 2,
        }}
      >
        <Input
          placeholder="Search by symbol, company, or theme..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          startDecorator={<Search size={18} />}
          endDecorator={
            searchQuery ? (
              <IconButton size="sm" variant="plain" color="neutral" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </IconButton>
            ) : null
          }
          sx={{
            minWidth: { xs: '100%', md: 320 },
            borderRadius: '10px',
          }}
        />

        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <Typography level="body-xs" sx={{ fontWeight: 600, color: 'text.tertiary', mr: 0.5 }}>
            Status:
          </Typography>
          <Chip
            variant={statusFilter === 'all' ? 'solid' : 'soft'}
            color="primary"
            onClick={() => setStatusFilter('all')}
            sx={{ cursor: 'pointer', borderRadius: '8px', fontWeight: 600 }}
          >
            {`All (${summary.total})`}
          </Chip>
          <Chip
            variant={statusFilter === 'active' ? 'solid' : 'soft'}
            color="success"
            onClick={() => setStatusFilter('active')}
            sx={{ cursor: 'pointer', borderRadius: '8px', fontWeight: 600 }}
          >
            {`Active (${summary.active})`}
          </Chip>
          <Chip
            variant={statusFilter === 'stale' ? 'solid' : 'soft'}
            color="warning"
            onClick={() => setStatusFilter('stale')}
            sx={{ cursor: 'pointer', borderRadius: '8px', fontWeight: 600 }}
          >
            {`Stale (${summary.stale})`}
          </Chip>
          <Chip
            variant={statusFilter === 'missing' ? 'solid' : 'soft'}
            color="danger"
            onClick={() => setStatusFilter('missing')}
            sx={{ cursor: 'pointer', borderRadius: '8px', fontWeight: 600 }}
          >
            {`Missing (${summary.missing})`}
          </Chip>
        </Stack>
      </Sheet>

      {/* Main Table */}
      {layout === 'table' ? (
      <Sheet
        sx={{
          ...glassStyle,
          borderRadius: '16px',
          overflow: 'auto',
          width: '100%',
        }}
      >
        <Table
          hoverRow
          stripe="odd"
          borderAxis="xBetween"
          sx={{
            '& tr > *': { borderBottom: '1px solid var(--joy-palette-divider)' },
            '--TableCell-paddingX': densityStyles.paddingX,
            '--TableCell-paddingY': densityStyles.paddingY,
            fontSize: densityStyles.fontSize,
            minWidth: 780,
          }}
        >
          <thead>
            <tr>
              <th style={{ width: '12%' }}>Symbol</th>
              <th style={{ width: '22%' }}>Company Name</th>
              <th style={{ width: '14%' }}>As-Of Date</th>
              <th style={{ width: '18%' }}>Freshness</th>
              <th style={{ width: '8%', textAlign: 'center' }}>Sources</th>
              <th style={{ width: '16%' }}>Linked Themes</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px' }}>
                  <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center">
                    <CircularProgress size="sm" />
                    <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                      Loading fundamental status...
                    </Typography>
                  </Stack>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '36px' }}>
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                    {searchQuery || statusFilter !== 'all'
                      ? 'No stocks match your filter criteria.'
                      : 'No stocks found in watchlist.'}
                  </Typography>
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.symbol}>
                  <td>
                    <Link
                      component="a"
                      href={`/analysis?symbol=${encodeURIComponent(item.symbol)}&tab=dossier`}
                      level={activeDensity === 'compact' ? 'body-sm' : 'title-sm'}
                      onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) {
                          e.preventDefault();
                          handleViewAnalysis(item.symbol);
                        }
                      }}
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        color: 'primary.plainColor',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        '&:hover': {
                          color: 'primary.hoverColor',
                          textDecoration: 'underline',
                        },
                        transition: 'all 0.15s ease-out',
                      }}
                    >
                      {item.symbol}
                    </Link>
                  </td>
                  <td>
                    <Typography level="body-sm" sx={{ fontWeight: 500, fontSize: densityStyles.fontSize }} noWrap>
                      {item.company_name}
                    </Typography>
                  </td>
                  <td>
                    <Typography level="body-xs" sx={{ fontFamily: 'monospace', color: item.as_of_date ? 'text.primary' : 'text.tertiary', fontSize: densityStyles.fontSize }}>
                      {item.as_of_date || '—'}
                    </Typography>
                  </td>
                  <td>
                    <FundamentalFreshnessBadge
                      status={item.status}
                      asOfDate={item.as_of_date}
                      format="verbose"
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <Chip size="sm" variant="soft" color="neutral" sx={{ fontWeight: 600 }}>
                      {item.source_count ?? 0}
                    </Chip>
                  </td>
                  <td>
                    {item.theme_tags && item.theme_tags.length > 0 ? (
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {item.theme_tags.map((tag) => (
                          <Chip
                            key={tag}
                            size="sm"
                            variant="outlined"
                            color="primary"
                            startDecorator={<Layers size={12} />}
                            sx={{ fontSize: '0.7rem', my: 0.25 }}
                          >
                            {tag}
                          </Chip>
                        ))}
                      </Stack>
                    ) : (
                      <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                        —
                      </Typography>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Button
                      size="sm"
                      variant="soft"
                      color="primary"
                      startDecorator={<Copy size={14} />}
                      onClick={() => setSelectedStockForPrompt(item)}
                      sx={{ borderRadius: '8px', fontWeight: 600, fontSize: 'xs' }}
                    >
                      Copy Prompt
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Sheet>
      ) : (
        <Grid container spacing={2}>
          {loading && items.length === 0 ? (
            <Grid xs={12}>
              <Stack direction="row" spacing={1.5} justifyContent="center" alignItems="center" sx={{ p: 4 }}>
                <CircularProgress size="sm" />
                <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                  Loading fundamental status...
                </Typography>
              </Stack>
            </Grid>
          ) : filteredItems.length === 0 ? (
            <Grid xs={12}>
              <Typography level="body-sm" sx={{ color: 'text.secondary', textAlign: 'center', p: 4 }}>
                {searchQuery || statusFilter !== 'all'
                  ? 'No stocks match your filter criteria.'
                  : 'No stocks found in watchlist.'}
              </Typography>
            </Grid>
          ) : (
            filteredItems.map((item) => (
              <Grid key={item.symbol} xs={12} sm={12} md={6} lg={6} xl={4}>
                <Card
                  sx={{
                    ...glassStyle,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    transition: 'all 0.3s ease-in-out',
                    height: '100%',
                  }}
                >
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, justifyContent: 'space-between' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Link
                          component="a"
                          href={`/analysis?symbol=${encodeURIComponent(item.symbol)}&tab=dossier`}
                          onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) {
                              e.preventDefault();
                              handleViewAnalysis(item.symbol);
                            }
                          }}
                          level="title-lg"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            color: 'primary.plainColor',
                            textDecoration: 'none',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {item.symbol}
                        </Link>
                        <Typography level="body-sm" sx={{ opacity: 0.7 }} noWrap>
                          {item.company_name}
                        </Typography>
                      </Box>
                      <FundamentalFreshnessBadge
                        status={item.status}
                        asOfDate={item.as_of_date}
                        format="verbose"
                      />
                    </Stack>

                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box>
                        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>As-Of Date</Typography>
                        <Typography level="body-sm" sx={{ fontFamily: 'monospace' }}>
                          {item.as_of_date || '—'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>Sources</Typography>
                        <Chip size="sm" variant="soft" color="neutral" sx={{ fontWeight: 600 }}>
                          {item.source_count ?? 0}
                        </Chip>
                      </Box>
                    </Stack>

                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {item.theme_tags && item.theme_tags.length > 0 ? (
                        item.theme_tags.map((tag) => (
                          <Chip
                            key={tag}
                            size="sm"
                            variant="outlined"
                            color="primary"
                            startDecorator={<Layers size={12} />}
                            sx={{ fontSize: '0.7rem' }}
                          >
                            {tag}
                          </Chip>
                        ))
                      ) : (
                        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>—</Typography>
                      )}
                    </Stack>

                    <Button
                      size="sm"
                      variant="soft"
                      color="primary"
                      startDecorator={<Copy size={14} />}
                      onClick={() => setSelectedStockForPrompt(item)}
                      sx={{ borderRadius: '8px', fontWeight: 600, alignSelf: 'flex-end' }}
                    >
                      Copy Prompt
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {/* Copy Prompt Modal */}
      <CopyPromptModal
        open={!!selectedStockForPrompt}
        onClose={() => setSelectedStockForPrompt(null)}
        symbol={selectedStockForPrompt?.symbol}
        companyName={selectedStockForPrompt?.company_name}
        asOfDate={selectedStockForPrompt?.as_of_date}
      />
    </Box>
  );
};

export default FundamentalIntelligenceTab;
