import * as React from 'react';
import {
  Box,
  Sheet,
  Typography,
  Stack,
  Button,
  Chip,
  Grid,
  Tooltip,
  LinearProgress,
} from '@mui/joy';
import {
  Layers,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Info,
  DollarSign,
  Activity,
  Compass,
  FileText,
} from 'lucide-react';
import { glassStyle } from '../../../styles/glass';
import { API_BASE_URL } from '../../../config';
import CopyPromptModal from '../sources/CopyPromptModal';

export interface RevenueSegmentItem {
  readonly name: string;
  readonly sharePct: number | null;
  readonly revenueMillions: number | null;
  readonly revenueDisplay: string | null;
  readonly isImpliedRevenue?: boolean;
  readonly yoyGrowthPct: number | null;
  readonly marginPct: number | null;
  readonly marginType?: 'Gross Margin' | 'Operating Margin' | 'EBITDA Margin' | null;
  readonly drivers?: string | null;
}

export interface UnitEconomicMetricItem {
  readonly label: string;
  readonly value: string;
  readonly changeDisplay: string | null;
  readonly changeDirection?: 'up' | 'down' | 'neutral';
  readonly progressPct?: number | null;
  readonly category?: 'volume' | 'monetization' | 'retention' | 'efficiency';
  readonly context?: string | null;
}

export interface BusinessModelMatrix {
  readonly archetype: string | null;
  readonly summary: string | null;
  readonly periodLabel: string | null;
  readonly asOfDate: string | null;
  readonly segments: readonly RevenueSegmentItem[];
  readonly unitEconomics: readonly UnitEconomicMetricItem[];
  readonly source: 'mcp' | 'ai_extracted' | 'parsed';
}

interface BusinessModelUnitEconomicsCardProps {
  symbol: string;
  initialMatrix?: BusinessModelMatrix | null;
  onMatrixUpdated?: (matrix: BusinessModelMatrix) => void;
}

// Color palette for segments
const SEGMENT_PALETTES = [
  { barColor: '#3b82f6', bgLevel: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)' },
  { barColor: '#f97316', bgLevel: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)' },
  { barColor: '#10b981', bgLevel: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' },
  { barColor: '#a855f7', bgLevel: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)' },
  { barColor: '#06b6d4', bgLevel: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)' },
];

export default function BusinessModelUnitEconomicsCard({
  symbol,
  initialMatrix = null,
  onMatrixUpdated,
}: BusinessModelUnitEconomicsCardProps) {
  const [matrix, setMatrix] = React.useState<BusinessModelMatrix | null>(initialMatrix);
  const [extracting, setExtracting] = React.useState(false);
  const [promptModalOpen, setPromptModalOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMatrix(initialMatrix);
  }, [initialMatrix]);

  const handleDeepExtract = async () => {
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/unit-economics/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as any;
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }
      const data = (await res.json()) as { symbol: string; businessModelMatrix: BusinessModelMatrix };
      if (data.businessModelMatrix) {
        setMatrix(data.businessModelMatrix);
        if (onMatrixUpdated) {
          onMatrixUpdated(data.businessModelMatrix);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to extract unit economics via AI');
    } finally {
      setExtracting(false);
    }
  };

  const unitEconomicsList = React.useMemo(() => {
    return matrix?.unitEconomics || (matrix as any)?.unit_economics || [];
  }, [matrix]);

  const hasSegments = Boolean(matrix?.segments && matrix.segments.length > 0);
  const hasKpis = unitEconomicsList.length > 0;
  const hasData = hasSegments || hasKpis;

  // Calculate sum of shares for proportional bar scaling
  const totalShare = React.useMemo(() => {
    if (!matrix?.segments) return 100;
    const sum = matrix.segments.reduce((acc, s) => {
      const share = typeof s.sharePct === 'number' ? s.sharePct : (s as any).share_pct;
      return acc + (typeof share === 'number' ? share : 0);
    }, 0);
    return sum > 0 ? sum : 100;
  }, [matrix?.segments]);

  return (
    <Sheet
      sx={{
        ...glassStyle,
        p: { xs: 2, sm: 3 },
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}
    >
      {/* Header Bar */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={1.5}
        sx={{ pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Layers size={18} color="var(--joy-palette-primary-plainColor)" />
            <Typography level="title-md" sx={{ fontWeight: 800 }}>
              Business Model &amp; Unit Economics
            </Typography>
            {matrix?.archetype && (
              <Chip size="sm" variant="soft" color="primary" sx={{ fontWeight: 700, fontSize: '11px' }}>
                {matrix.archetype}
              </Chip>
            )}
          </Stack>
          <Typography level="body-xs" sx={{ color: 'text.tertiary', fontSize: '11px', mt: 0.3 }}>
            Monetization Engines, Segment Revenue Mix &amp; Core Unit Drivers
            {(matrix?.periodLabel || (matrix as any)?.period_label) ? ` • ${matrix?.periodLabel || (matrix as any)?.period_label}` : ''}
            {(matrix?.asOfDate || (matrix as any)?.as_of_date) ? ` • As of ${matrix?.asOfDate || (matrix as any)?.as_of_date}` : ''}
            {matrix?.source === 'ai_extracted' ? ' • AI Synthesized' : ''}
          </Typography>
        </Box>

        <Stack direction="row" alignItems="center" spacing={1} sx={{ alignSelf: { xs: 'flex-start', sm: 'auto' } }}>
          <Button
            size="sm"
            variant="outlined"
            color="neutral"
            startDecorator={<FileText size={14} />}
            onClick={() => setPromptModalOpen(true)}
            sx={{ borderRadius: '8px', fontWeight: 600, fontSize: '12px' }}
          >
            Gemini Prompt
          </Button>
          <Button
            size="sm"
            variant="solid"
            color="primary"
            startDecorator={<Sparkles size={14} />}
            loading={extracting}
            onClick={handleDeepExtract}
            sx={{ borderRadius: '8px', fontWeight: 700, fontSize: '12px' }}
          >
            AI Deep Extract
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Sheet variant="soft" color="danger" sx={{ p: 1.5, borderRadius: '8px' }}>
          <Typography level="body-xs" sx={{ color: 'danger.plainColor', fontWeight: 600 }}>
            {error}
          </Typography>
        </Sheet>
      )}

      {/* Main Content Split: Left (Segments) & Right (Unit Economics) */}
      {!hasData ? (
        <Sheet
          variant="soft"
          sx={{
            p: 4,
            borderRadius: '12px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1.5,
            bgcolor: 'background.level1',
          }}
        >
          <Compass size={32} color="var(--joy-palette-text-tertiary)" />
          <Typography level="title-sm" sx={{ fontWeight: 700 }}>
            No Unit Economics Matrix Documented for {symbol}
          </Typography>
          <Typography level="body-xs" sx={{ color: 'text.secondary', maxWidth: '480px' }}>
            Click <strong>AI Deep Extract</strong> to automatically synthesize segment shares, revenue figures, and unit economics from fundamental research, or copy the Gemini extraction prompt.
          </Typography>
          <Button
            size="sm"
            variant="solid"
            color="primary"
            startDecorator={<Sparkles size={15} />}
            loading={extracting}
            onClick={handleDeepExtract}
            sx={{ borderRadius: '8px', mt: 1 }}
          >
            Extract with AI Now
          </Button>
        </Sheet>
      ) : (
        <Grid container spacing={3}>
          {/* Left Column: Revenue Mix & Segment Performance */}
          <Grid xs={12} lg={6}>
            <Sheet
              sx={{
                p: 2,
                borderRadius: '12px',
                bgcolor: 'background.level1',
                border: '1px solid',
                borderColor: 'neutral.outlinedBorder',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography level="title-sm" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DollarSign size={16} color="var(--joy-palette-primary-plainColor)" />
                  Revenue Mix &amp; Segment Performance
                </Typography>
                <Chip size="sm" variant="plain" sx={{ fontSize: '11px', color: 'text.tertiary' }}>
                  {matrix?.segments?.length || 0} Segments
                </Chip>
              </Stack>

              {/* 100% Proportional Stacked Segment Bar */}
              {hasSegments && (
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      width: '100%',
                      height: '24px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      bgcolor: 'background.level2',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    {matrix!.segments.map((seg, idx) => {
                      const share = typeof seg.sharePct === 'number'
                        ? seg.sharePct
                        : typeof (seg as any).share_pct === 'number'
                          ? (seg as any).share_pct
                          : null;
                      const validShare = typeof share === 'number' ? share : (100 / matrix!.segments.length);
                      const widthPct = Math.max(8, (validShare / totalShare) * 100);
                      const palette = SEGMENT_PALETTES[idx % SEGMENT_PALETTES.length];
                      const revDisplay = seg.revenueDisplay || (seg as any).revenue_display || '';
                      const marginPct = typeof seg.marginPct === 'number'
                        ? seg.marginPct
                        : typeof (seg as any).margin_pct === 'number'
                          ? (seg as any).margin_pct
                          : null;
                      const marginType = seg.marginType || (seg as any).margin_type || 'Margin';

                      return (
                        <Tooltip
                          key={idx}
                          title={`${seg.name}: ${typeof share === 'number' ? `${share}%` : '—'} ${revDisplay ? `(${revDisplay})` : ''} ${typeof marginPct === 'number' ? `• ${marginType}: ${marginPct}%` : ''}`}
                          variant="soft"
                          size="sm"
                        >
                          <Box
                            sx={{
                              width: `${widthPct}%`,
                              height: '100%',
                              bgcolor: palette.barColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              borderRight: idx < matrix!.segments.length - 1 ? '1px solid rgba(0,0,0,0.2)' : 'none',
                              '&:hover': { opacity: 0.85, filter: 'brightness(1.1)' },
                            }}
                          >
                            <Typography
                              level="body-xs"
                              sx={{
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: '10.5px',
                                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                                px: 0.5,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {typeof share === 'number' ? `${share}%` : seg.name}
                            </Typography>
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </Box>
                  <Typography level="body-xs" sx={{ color: 'text.tertiary', fontSize: '10px', mt: 0.5, textAlign: 'right' }}>
                    100% Normalized Segment Distribution
                  </Typography>
                </Box>
              )}

              {/* Segment Cards */}
              <Stack spacing={1.5} sx={{ flex: 1 }}>
                {matrix?.segments?.map((seg, idx) => {
                  const palette = SEGMENT_PALETTES[idx % SEGMENT_PALETTES.length];
                  const yoyGrowth = typeof seg.yoyGrowthPct === 'number'
                    ? seg.yoyGrowthPct
                    : typeof (seg as any).yoy_growth_pct === 'number'
                      ? (seg as any).yoy_growth_pct
                      : null;
                  const hasGrowth = typeof yoyGrowth === 'number';
                  const isGrowthPositive = (yoyGrowth ?? 0) >= 0;
                  const sharePct = typeof seg.sharePct === 'number'
                    ? seg.sharePct
                    : typeof (seg as any).share_pct === 'number'
                      ? (seg as any).share_pct
                      : null;
                  const marginPct = typeof seg.marginPct === 'number'
                    ? seg.marginPct
                    : typeof (seg as any).margin_pct === 'number'
                      ? (seg as any).margin_pct
                      : null;
                  const marginType = seg.marginType || (seg as any).margin_type || 'Margin';
                  const revenueDisplay = seg.revenueDisplay || (seg as any).revenue_display || null;
                  const isImpliedRevenue = Boolean(seg.isImpliedRevenue ?? (seg as any).is_implied_revenue);

                  return (
                    <Box
                      key={idx}
                      sx={{
                        p: 1.5,
                        borderRadius: '10px',
                        bgcolor: 'background.surface',
                        border: '1px solid',
                        borderColor: 'neutral.outlinedBorder',
                        transition: 'all 0.2s ease',
                        '&:hover': { borderColor: palette.barColor, boxShadow: 'sm' },
                      }}
                    >
                      {/* Top Row: Segment Name & Share / Revenue */}
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 0.8 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box
                            sx={{
                              width: 10,
                              height: 10,
                              borderRadius: '3px',
                              bgcolor: palette.barColor,
                              flexShrink: 0,
                            }}
                          />
                          <Typography level="title-sm" sx={{ fontWeight: 800, fontSize: '13px' }}>
                            {seg.name}
                          </Typography>
                        </Stack>

                        <Stack direction="row" alignItems="center" spacing={1}>
                          {typeof sharePct === 'number' && (
                            <Chip size="sm" variant="soft" color="neutral" sx={{ fontWeight: 800, fontSize: '11px' }}>
                              {sharePct}% Mix
                            </Chip>
                          )}
                          {revenueDisplay && (
                            <Typography level="body-xs" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '12px' }}>
                              {revenueDisplay}
                              {isImpliedRevenue && (
                                <Tooltip title="Calculated from segment % and latest total quarterly revenue" size="sm">
                                  <span style={{ fontSize: '9.5px', color: 'var(--joy-palette-text-tertiary)', marginLeft: 4 }}>
                                    (Est.)
                                  </span>
                                </Tooltip>
                              )}
                            </Typography>
                          )}
                        </Stack>
                      </Stack>

                      {/* Middle Badges: YoY Growth & Margin */}
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.8, mb: seg.drivers ? 0.8 : 0 }}>
                        {hasGrowth && (
                          <Chip
                            size="sm"
                            variant="soft"
                            color={isGrowthPositive ? 'success' : 'danger'}
                            startDecorator={isGrowthPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            sx={{ fontWeight: 700, fontSize: '11px' }}
                          >
                            {isGrowthPositive ? `+${yoyGrowth}%` : `${yoyGrowth}%`} YoY
                          </Chip>
                        )}

                        {typeof marginPct === 'number' && (
                          <Chip
                            size="sm"
                            variant="outlined"
                            color="neutral"
                            sx={{ fontWeight: 600, fontSize: '11px' }}
                          >
                            {marginType}: <b style={{ marginLeft: 4, color: palette.barColor }}>{marginPct}%</b>
                          </Chip>
                        )}
                      </Stack>

                      {/* Drivers / Mechanics Explanation */}
                      {seg.drivers && (
                        <Typography level="body-xs" sx={{ color: 'text.secondary', fontSize: '11px', lineHeight: 1.4 }}>
                          {seg.drivers}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Sheet>
          </Grid>

          {/* Right Column: Unit Economics Bento Matrix */}
          <Grid xs={12} lg={6}>
            <Sheet
              sx={{
                p: 2,
                borderRadius: '12px',
                bgcolor: 'background.level1',
                border: '1px solid',
                borderColor: 'neutral.outlinedBorder',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography level="title-sm" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Activity size={16} color="var(--joy-palette-success-plainColor)" />
                  Unit Economics Matrix
                </Typography>
                <Chip size="sm" variant="plain" sx={{ fontSize: '11px', color: 'text.tertiary' }}>
                  {unitEconomicsList.length} Core Metrics
                </Chip>
              </Stack>

              {/* Bento Grid of KPIs */}
              <Grid container spacing={1.5} sx={{ flex: 1 }}>
                {unitEconomicsList.map((kpi: any, idx: number) => {
                  const changeDirection = kpi.changeDirection || kpi.change_direction;
                  const isPositive = changeDirection === 'up';
                  const isNegative = changeDirection === 'down';
                  const changeDisplay = kpi.changeDisplay || kpi.change_display;
                  const hasChange = Boolean(changeDisplay);
                  const progressPct = typeof kpi.progressPct === 'number'
                    ? kpi.progressPct
                    : typeof kpi.progress_pct === 'number'
                      ? kpi.progress_pct
                      : null;
                  const isRateOrProgress = typeof progressPct === 'number';

                  return (
                    <Grid key={idx} xs={12} sm={6}>
                      <Sheet
                        sx={{
                          p: 1.5,
                          borderRadius: '10px',
                          bgcolor: 'background.surface',
                          border: '1px solid',
                          borderColor: 'neutral.outlinedBorder',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 1,
                          transition: 'all 0.2s ease',
                          '&:hover': { borderColor: 'primary.plainColor', boxShadow: 'sm' },
                        }}
                      >
                        {/* KPI Header & Category */}
                        <Box>
                          <Typography
                            level="body-xs"
                            sx={{
                              fontWeight: 700,
                              color: 'text.secondary',
                              fontSize: '11.5px',
                              lineHeight: 1.3,
                              mb: 0.5,
                            }}
                          >
                            {kpi.label}
                          </Typography>

                          {/* Hero Value & Growth Tag */}
                          <Stack direction="row" alignItems="baseline" spacing={1} sx={{ flexWrap: 'wrap' }}>
                            <Typography
                              level="title-lg"
                              sx={{
                                fontWeight: 900,
                                fontSize: '1.25rem',
                                color: 'text.primary',
                                letterSpacing: '-0.02em',
                              }}
                            >
                              {kpi.value}
                            </Typography>

                            {hasChange && (
                              <Chip
                                size="sm"
                                variant="soft"
                                color={isPositive ? 'success' : isNegative ? 'danger' : 'neutral'}
                                sx={{ fontWeight: 800, fontSize: '10.5px', py: 0 }}
                              >
                                {changeDisplay}
                              </Chip>
                            )}
                          </Stack>
                        </Box>

                        {/* Visual Gauge Bar for Rate / Progress */}
                        {isRateOrProgress && (
                          <Box sx={{ width: '100%', mt: 0.5 }}>
                            <LinearProgress
                              determinate
                              value={Math.min(100, Math.max(0, progressPct))}
                              color="primary"
                              size="sm"
                              sx={{ borderRadius: '4px', bgcolor: 'background.level2' }}
                            />
                          </Box>
                        )}

                        {/* Context / Benchmark Note */}
                        {kpi.context && (
                          <Typography
                            level="body-xs"
                            sx={{
                              color: 'text.tertiary',
                              fontSize: '10.5px',
                              lineHeight: 1.35,
                              mt: 0.3,
                            }}
                          >
                            {kpi.context}
                          </Typography>
                        )}
                      </Sheet>
                    </Grid>
                  );
                })}
              </Grid>
            </Sheet>
          </Grid>
        </Grid>
      )}

      {/* Monetization Summary Footer */}
      {matrix?.summary && (
        <Sheet
          variant="soft"
          sx={{
            p: 1.5,
            px: 2,
            borderRadius: '10px',
            bgcolor: 'background.level1',
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.2,
          }}
        >
          <Info size={16} color="var(--joy-palette-primary-plainColor)" style={{ marginTop: 2, flexShrink: 0 }} />
          <Typography level="body-xs" sx={{ color: 'text.secondary', fontSize: '11.5px', lineHeight: 1.5 }}>
            <strong>Business Model Synthesis:</strong> {matrix.summary}
          </Typography>
        </Sheet>
      )}

      {/* Copy Prompt Modal */}
      <CopyPromptModal
        open={promptModalOpen}
        onClose={() => setPromptModalOpen(false)}
        symbol={symbol}
      />
    </Sheet>
  );
}

