import * as React from 'react';
import {
  Box,
  Sheet,
  Typography,
  Stack,
  Button,
  IconButton,
  Chip,
  Grid,
  CircularProgress,
  Tooltip,
} from '@mui/joy';
import { RotateCw, AlertTriangle, Layers, Building, Globe, ExternalLink, Info } from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';

export interface FinancialBarPeriod {
  period: string;
  asOfDate: string;
  totalRevenue: number | null;
  grossProfit: number | null;
  operatingProfit: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
}

export interface CompanyStatisticsItem {
  label: string;
  value: string;
  raw?: number | null;
  highlight?: 'positive' | 'negative' | 'neutral';
}

export interface CompanyStatisticsGroup {
  category: string;
  items: CompanyStatisticsItem[];
}

export interface CompanyOverviewPayload {
  symbol: string;
  name: string;
  logo: string | null;
  sector: string;
  industry: string;
  exchange: string;
  ipoDate: string | null;
  currency: string;
  quarterly: FinancialBarPeriod[];
  annual: FinancialBarPeriod[];
  companyStatistics: {
    profileMarginsReturns: CompanyStatisticsGroup[];
    valuationHealth: CompanyStatisticsGroup[];
    growthDividends: CompanyStatisticsGroup[];
  };
  updatedAt: string;
}

interface StockOverviewProps {
  symbol: string;
  initialData?: CompanyOverviewPayload | null;
}

type MetricKey = 'totalRevenue' | 'grossProfit' | 'operatingProfit' | 'operatingCashFlow' | 'freeCashFlow';

interface MetricConfig {
  key: MetricKey;
  label: string;
  color: string;
}

const METRIC_CONFIGS: MetricConfig[] = [
  { key: 'totalRevenue', label: 'Total Revenues', color: '#3b82f6' },
  { key: 'grossProfit', label: 'Gross Profit', color: '#f97316' },
  { key: 'operatingProfit', label: 'Operating Profit', color: '#a855f7' },
  { key: 'operatingCashFlow', label: 'Cash from Operating Activities', color: '#ef4444' },
  { key: 'freeCashFlow', label: 'Free Cash Flow', color: '#eab308' },
];

function formatNumWithCommas(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return val.toLocaleString('en-US');
}

export default function StockOverview({ symbol, initialData = null }: StockOverviewProps) {
  const [data, setData] = React.useState<CompanyOverviewPayload | null>(initialData);
  const [loading, setLoading] = React.useState(!initialData);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [frequency, setFrequency] = React.useState<'quarterly' | 'annual'>('quarterly');
  const [hiddenMetrics, setHiddenMetrics] = React.useState<Record<MetricKey, boolean>>({
    totalRevenue: false,
    grossProfit: false,
    operatingProfit: false,
    operatingCashFlow: false,
    freeCashFlow: false,
  });
  const [hoveredPeriodIndex, setHoveredPeriodIndex] = React.useState<number | null>(null);

  const fetchOverview = React.useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}/api/analysis/overview?symbol=${encodeURIComponent(symbol)}${forceRefresh ? '&refresh=true' : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as any;
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }
      const json = (await res.json()) as CompanyOverviewPayload;
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Failed to load financial overview data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [symbol]);

  React.useEffect(() => {
    if (!initialData) {
      fetchOverview(false);
    }
  }, [fetchOverview, initialData]);

  const toggleMetric = (key: MetricKey) => {
    setHiddenMetrics(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activePeriods: FinancialBarPeriod[] = React.useMemo(() => {
    if (!data) return [];
    return frequency === 'quarterly' ? data.quarterly : data.annual;
  }, [data, frequency]);

  // SVG Chart dimensions and calculations
  const chartHeight = 340;
  const chartWidth = 720;
  const padding = { top: 30, right: 65, bottom: 40, left: 15 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const { minVal, maxVal, yZero, yScale } = React.useMemo(() => {
    let min = 0;
    let max = 0;

    const visibleConfigs = METRIC_CONFIGS.filter(c => !hiddenMetrics[c.key]);

    for (const p of activePeriods) {
      for (const c of visibleConfigs) {
        const v = p[c.key];
        if (typeof v === 'number' && !isNaN(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }

    if (max === 0 && min === 0) {
      max = 1000;
    }

    // Add 15% headroom for top data labels
    const rangeSpan = max - min;
    const adjustedMax = max > 0 ? max + rangeSpan * 0.15 : 0;
    const adjustedMin = min < 0 ? min - rangeSpan * 0.1 : 0;

    const totalRange = adjustedMax - adjustedMin || 1;

    const scale = (val: number) => {
      return padding.top + plotHeight - ((val - adjustedMin) / totalRange) * plotHeight;
    };

    const zeroY = scale(0);

    return { minVal: adjustedMin, maxVal: adjustedMax, yZero: zeroY, yScale: scale };
  }, [activePeriods, hiddenMetrics, plotHeight, padding.top]);

  // Compute legend statistics dynamically from active periods
  const legendStats = React.useMemo(() => {
    return METRIC_CONFIGS.map(cfg => {
      const validPoints = activePeriods
        .map(p => p[cfg.key])
        .filter((v): v is number => typeof v === 'number' && !isNaN(v));

      if (validPoints.length < 2) {
        return {
          ...cfg,
          totalChangePct: null,
          cagrPct: null,
        };
      }

      const first = validPoints[0];
      const last = validPoints[validPoints.length - 1];

      let totalChangePct: number | null = null;
      if (first !== 0) {
        totalChangePct = Number((((last - first) / Math.abs(first)) * 100).toFixed(2));
      }

      let cagrPct: number | null = null;
      if (first > 0 && last > 0) {
        const periodsCount = validPoints.length;
        const nYears = frequency === 'quarterly' ? periodsCount / 4 : periodsCount;
        if (nYears > 0) {
          cagrPct = Number(((Math.pow(last / first, 1 / nYears) - 1) * 100).toFixed(1));
        }
      }

      return {
        ...cfg,
        totalChangePct,
        cagrPct,
      };
    });
  }, [activePeriods, frequency]);

  if (loading) {
    return (
      <Sheet sx={{ ...glassStyle, p: 6, minHeight: '450px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <CircularProgress size="lg" color="primary" />
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>
          Loading financial overview for {symbol}...
        </Typography>
      </Sheet>
    );
  }

  if (error || !data) {
    return (
      <Sheet sx={{ ...glassStyle, p: 5, minHeight: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textAlign: 'center' }}>
        <AlertTriangle size={44} color="#f43f5e" />
        <Typography level="h4">Unable to Load Financial Overview</Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary', maxWidth: '480px' }}>
          {error || 'Financial metrics are not currently available for this symbol.'}
        </Typography>
        <Button variant="solid" color="primary" onClick={() => fetchOverview(true)} startDecorator={<RotateCw size={16} />}>
          Try Again
        </Button>
      </Sheet>
    );
  }

  const visibleConfigs = METRIC_CONFIGS.filter(c => !hiddenMetrics[c.key]);
  const numVisible = visibleConfigs.length;
  const numPeriods = activePeriods.length;
  const groupWidth = numPeriods > 0 ? plotWidth / numPeriods : 0;
  const barMargin = 2;
  const barWidth = numVisible > 0 ? Math.min(22, Math.max(6, (groupWidth * 0.75 - (numVisible - 1) * barMargin) / numVisible)) : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Top Header Summary Strip */}
      <Sheet sx={{ ...glassStyle, p: 2, px: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
          {data.logo ? (
            <Box
              component="img"
              src={data.logo}
              alt={data.name}
              sx={{ width: 32, height: 32, borderRadius: '8px', objectFit: 'contain', bgcolor: 'rgba(255,255,255,0.08)', p: 0.5 }}
            />
          ) : (
            <Building size={24} color="#60a5fa" />
          )}
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography level="title-lg" sx={{ fontWeight: 800, color: 'text.primary' }}>
                {data.name}
              </Typography>
              <Chip size="sm" variant="soft" color="primary" sx={{ fontWeight: 700 }}>
                {data.symbol}
              </Chip>
            </Stack>
            <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
              {data.exchange} {data.ipoDate ? `• IPO ${data.ipoDate}` : ''}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Chip size="sm" variant="outlined" color="neutral" startDecorator={<Globe size={13} />}>
            {data.sector}
          </Chip>
          <Chip size="sm" variant="outlined" color="neutral" startDecorator={<Layers size={13} />}>
            {data.industry}
          </Chip>
        </Stack>
      </Sheet>

      {/* Main 2-Column Responsive Split Panel */}
      <Grid container spacing={2.5}>
        {/* Left Panel: Company Statistics (Curated 3 Columns) */}
        <Grid xs={12} xl={5}>
          <Sheet sx={{ ...glassStyle, p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography level="title-md" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                Company Statistics
              </Typography>
              <Chip size="sm" variant="soft" color="neutral" sx={{ fontSize: '11px', fontWeight: 600 }}>
                USD
              </Chip>
            </Stack>

            {/* 3-Column Layout inside Company Statistics */}
            <Grid container spacing={2} sx={{ flex: 1 }}>
              {/* Col 1: Profile, Margins, Returns */}
              <Grid xs={12} sm={4}>
                <Stack spacing={2}>
                  {data.companyStatistics.profileMarginsReturns.map((group, gIdx) => (
                    <Box key={gIdx}>
                      <Typography level="body-xs" sx={{ fontWeight: 700, color: 'primary.400', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.8, fontSize: '10px' }}>
                        {group.category}
                      </Typography>
                      <Stack spacing={0.5}>
                        {group.items.map((item, iIdx) => (
                          <Box key={iIdx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', py: 0.2 }}>
                            <Typography level="body-xs" sx={{ color: 'text.secondary', fontSize: '11px' }}>
                              {item.label}
                            </Typography>
                            <Typography level="body-xs" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '11px', textAlign: 'right' }}>
                              {item.value}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Grid>

              {/* Col 2: Valuation, Valuation Forward & Intrinsic, Financial Health */}
              <Grid xs={12} sm={4}>
                <Stack spacing={2}>
                  {data.companyStatistics.valuationHealth.map((group, gIdx) => (
                    <Box key={gIdx}>
                      <Typography level="body-xs" sx={{ fontWeight: 700, color: 'primary.400', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.8, fontSize: '10px' }}>
                        {group.category}
                      </Typography>
                      <Stack spacing={0.5}>
                        {group.items.map((item, iIdx) => {
                          const isPos = item.highlight === 'positive';
                          const isNeg = item.highlight === 'negative';
                          const color = isPos ? '#10b981' : isNeg ? '#f43f5e' : 'text.primary';
                          return (
                            <Box key={iIdx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', py: 0.2 }}>
                              <Typography level="body-xs" sx={{ color: 'text.secondary', fontSize: '11px' }}>
                                {item.label}
                              </Typography>
                              <Typography level="body-xs" sx={{ fontWeight: 600, color, fontSize: '11px', textAlign: 'right' }}>
                                {item.value}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Grid>

              {/* Col 3: Growth, Dividends & R&D Efficiency */}
              <Grid xs={12} sm={4}>
                <Stack spacing={2}>
                  {data.companyStatistics.growthDividends.map((group, gIdx) => (
                    <Box key={gIdx}>
                      <Typography level="body-xs" sx={{ fontWeight: 700, color: 'primary.400', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.8, fontSize: '10px' }}>
                        {group.category}
                      </Typography>
                      <Stack spacing={0.5}>
                        {group.items.map((item, iIdx) => (
                          <Box key={iIdx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', py: 0.2 }}>
                            <Typography level="body-xs" sx={{ color: 'text.secondary', fontSize: '11px' }}>
                              {item.label}
                            </Typography>
                            <Typography level="body-xs" sx={{ fontWeight: 600, color: 'text.primary', fontSize: '11px', textAlign: 'right' }}>
                              {item.value}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Sheet>
        </Grid>

        {/* Right Panel: Financial Performance Grouped Bar Chart */}
        <Grid xs={12} xl={7}>
          <Sheet sx={{ ...glassStyle, p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Chart Control Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
              <Typography level="title-md" sx={{ fontWeight: 700 }}>
                Financial Performance
              </Typography>

              <Stack direction="row" alignItems="center" spacing={1}>
                {/* Quarterly / Annual Switcher */}
                <Stack direction="row" sx={{ bgcolor: 'background.level1', p: 0.5, borderRadius: '8px', border: '1px solid', borderColor: 'divider' }}>
                  <Button
                    size="sm"
                    variant={frequency === 'quarterly' ? 'solid' : 'plain'}
                    color={frequency === 'quarterly' ? 'primary' : 'neutral'}
                    onClick={() => setFrequency('quarterly')}
                    sx={{ px: 1.5, py: 0.4, minHeight: '28px', fontSize: '12px', fontWeight: 600 }}
                  >
                    Quarterly
                  </Button>
                  <Button
                    size="sm"
                    variant={frequency === 'annual' ? 'solid' : 'plain'}
                    color={frequency === 'annual' ? 'primary' : 'neutral'}
                    onClick={() => setFrequency('annual')}
                    sx={{ px: 1.5, py: 0.4, minHeight: '28px', fontSize: '12px', fontWeight: 600 }}
                  >
                    Annual
                  </Button>
                </Stack>

                {/* Refresh Button with Loading Spinner */}
                <IconButton
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  loading={refreshing}
                  onClick={() => fetchOverview(true)}
                  title="Refresh overview from Finnhub & Yahoo Finance"
                  sx={{ borderRadius: '8px' }}
                >
                  <RotateCw size={15} />
                </IconButton>
              </Stack>
            </Stack>

            {/* SVG Grouped Bar Chart Container */}
            <Box sx={{ width: '100%', height: `${chartHeight}px`, position: 'relative', overflow: 'hidden' }}>
              {activePeriods.length === 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                    No time-series financial records available for {symbol}.
                  </Typography>
                </Box>
              ) : (
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  style={{ width: '100%', height: '100%', display: 'block' }}
                >
                  {/* Grid lines and Y-axis scale */}
                  {(() => {
                    const numTicks = 5;
                    const ticks = [];
                    for (let i = 0; i <= numTicks; i++) {
                      const val = minVal + (i / numTicks) * (maxVal - minVal);
                      const y = yScale(val);
                      ticks.push({ val, y });
                    }
                    return ticks.map((t, idx) => (
                      <g key={idx}>
                        <line
                          x1={padding.left}
                          y1={t.y}
                          x2={chartWidth - padding.right}
                          y2={t.y}
                          stroke="rgba(255, 255, 255, 0.08)"
                          strokeDasharray={t.val === 0 ? 'none' : '3 3'}
                          strokeWidth={t.val === 0 ? 1.5 : 1}
                        />
                        <text
                          x={chartWidth - padding.right + 8}
                          y={t.y + 3}
                          fill="rgba(255, 255, 255, 0.45)"
                          fontSize="10"
                          textAnchor="start"
                          fontFamily="sans-serif"
                        >
                          {Math.abs(t.val) >= 1000
                            ? `${(t.val / 1000).toFixed(0)}B`
                            : `${Math.round(t.val)}M`}
                        </text>
                      </g>
                    ));
                  })()}

                  {/* Baseline Zero Axis */}
                  <line
                    x1={padding.left}
                    y1={yZero}
                    x2={chartWidth - padding.right}
                    y2={yZero}
                    stroke="rgba(255, 255, 255, 0.25)"
                    strokeWidth={1.5}
                  />

                  {/* Grouped Bars per Period */}
                  {activePeriods.map((period, pIdx) => {
                    const groupCenterX = padding.left + pIdx * groupWidth + groupWidth / 2;
                    const totalBarsWidth = numVisible * barWidth + (numVisible - 1) * barMargin;
                    const groupStartX = groupCenterX - totalBarsWidth / 2;

                    return (
                      <g
                        key={pIdx}
                        onMouseEnter={() => setHoveredPeriodIndex(pIdx)}
                        onMouseLeave={() => setHoveredPeriodIndex(null)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Hover highlight column background */}
                        {hoveredPeriodIndex === pIdx && (
                          <rect
                            x={padding.left + pIdx * groupWidth}
                            y={padding.top}
                            width={groupWidth}
                            height={plotHeight}
                            fill="rgba(255, 255, 255, 0.04)"
                            rx={4}
                          />
                        )}

                        {/* Period X-Axis Label */}
                        <text
                          x={groupCenterX}
                          y={chartHeight - 12}
                          fill={hoveredPeriodIndex === pIdx ? '#60a5fa' : 'rgba(255, 255, 255, 0.7)'}
                          fontSize="11"
                          fontWeight={hoveredPeriodIndex === pIdx ? 700 : 500}
                          textAnchor="middle"
                          fontFamily="sans-serif"
                        >
                          {period.period}
                        </text>

                        {/* Individual Metric Bars */}
                        {visibleConfigs.map((cfg, cIdx) => {
                          const val = period[cfg.key];
                          if (val === null || val === undefined || isNaN(val)) return null;

                          const barX = groupStartX + cIdx * (barWidth + barMargin);
                          const barY = val >= 0 ? yScale(val) : yZero;
                          const height = Math.abs(yScale(val) - yZero);

                          const labelY = val >= 0 ? barY - 4 : barY + height + 10;

                          return (
                            <g key={cfg.key}>
                              <rect
                                x={barX}
                                y={barY}
                                width={barWidth}
                                height={Math.max(1, height)}
                                fill={cfg.color}
                                rx={2}
                                opacity={hoveredPeriodIndex === null || hoveredPeriodIndex === pIdx ? 1 : 0.65}
                              />
                              {/* Numeric value label on top/bottom of bar */}
                              <text
                                x={barX + barWidth / 2}
                                y={labelY}
                                fill={val >= 0 ? 'rgba(255, 255, 255, 0.85)' : '#f87171'}
                                fontSize="8.5"
                                fontWeight={600}
                                textAnchor="middle"
                                fontFamily="sans-serif"
                              >
                                {val.toLocaleString('en-US')}
                              </text>
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Hover Floating Tooltip */}
              {hoveredPeriodIndex !== null && activePeriods[hoveredPeriodIndex] && (
                <Sheet
                  sx={{
                    position: 'absolute',
                    top: 10,
                    right: 80,
                    p: 1.5,
                    bgcolor: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    pointerEvents: 'none',
                    zIndex: 10,
                    minWidth: 200,
                  }}
                >
                  <Typography level="title-sm" sx={{ color: '#60a5fa', fontWeight: 700, mb: 0.8 }}>
                    {activePeriods[hoveredPeriodIndex].period} ({activePeriods[hoveredPeriodIndex].asOfDate})
                  </Typography>
                  <Stack spacing={0.4}>
                    {METRIC_CONFIGS.map(cfg => {
                      const val = activePeriods[hoveredPeriodIndex][cfg.key];
                      return (
                        <Box key={cfg.key} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, fontSize: '11px' }}>
                          <Stack direction="row" alignItems="center" spacing={0.8}>
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cfg.color }} />
                            <Typography level="body-xs" sx={{ color: 'text.secondary', fontSize: '11px' }}>
                              {cfg.label}:
                            </Typography>
                          </Stack>
                          <Typography level="body-xs" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '11px' }}>
                            {formatNumWithCommas(val)} M
                          </Typography>
                        </Box>
                      );
                    })}

                    {/* Calculated Margins inside Tooltip */}
                    {(() => {
                      const p = activePeriods[hoveredPeriodIndex];
                      if (!p.totalRevenue || p.totalRevenue <= 0) return null;
                      const gm = p.grossProfit !== null ? ((p.grossProfit / p.totalRevenue) * 100).toFixed(1) : null;
                      const om = p.operatingProfit !== null ? ((p.operatingProfit / p.totalRevenue) * 100).toFixed(1) : null;
                      const fm = p.freeCashFlow !== null ? ((p.freeCashFlow / p.totalRevenue) * 100).toFixed(1) : null;
                      return (
                        <Box sx={{ pt: 0.8, mt: 0.8, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', color: 'text.tertiary' }}>
                          {gm && <Typography level="body-xs" sx={{ fontSize: '10px' }}>Gross Margin: <b style={{ color: '#f97316' }}>{gm}%</b></Typography>}
                          {om && <Typography level="body-xs" sx={{ fontSize: '10px' }}>Operating Margin: <b style={{ color: '#a855f7' }}>{om}%</b></Typography>}
                          {fm && <Typography level="body-xs" sx={{ fontSize: '10px' }}>FCF Margin: <b style={{ color: '#eab308' }}>{fm}%</b></Typography>}
                        </Box>
                      );
                    })()}
                  </Stack>
                </Sheet>
              )}
            </Box>

            {/* Interactive Legend with Toggle & CAGR Stats */}
            <Box sx={{ pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Grid container spacing={1.5}>
                {legendStats.map((item) => {
                  const isHidden = hiddenMetrics[item.key];
                  const totalChangeSign = item.totalChangePct !== null && item.totalChangePct > 0 ? '+' : '';
                  const cagrSign = item.cagrPct !== null && item.cagrPct > 0 ? '+' : '';

                  return (
                    <Grid key={item.key} xs={12} sm={6}>
                      <Box
                        onClick={() => toggleMetric(item.key)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 0.8,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          bgcolor: isHidden ? 'transparent' : 'rgba(255,255,255,0.03)',
                          opacity: isHidden ? 0.45 : 1,
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.07)',
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: isHidden ? 'transparent' : item.color,
                            border: `2px solid ${item.color}`,
                            flexShrink: 0,
                          }}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography level="body-xs" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '11.5px', lineHeight: 1.2 }}>
                            {item.label}
                          </Typography>
                          <Typography level="body-xs" sx={{ color: 'text.tertiary', fontSize: '10px' }}>
                            ({frequency === 'quarterly' ? 'Quarterly' : 'Annual'}) (Millions)
                            {item.totalChangePct !== null && (
                              <span style={{ marginLeft: 6, color: item.totalChangePct >= 0 ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
                                (Total Change: {totalChangeSign}{item.totalChangePct}%)
                              </span>
                            )}
                            {item.cagrPct !== null && (
                              <span style={{ marginLeft: 6, color: '#38bdf8', fontWeight: 600 }}>
                                (CAGR: {cagrSign}{item.cagrPct}%)
                              </span>
                            )}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          </Sheet>
        </Grid>
      </Grid>
    </Box>
  );
}
