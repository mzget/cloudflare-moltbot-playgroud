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
  Divider,
  CircularProgress,
  Tooltip,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Input,
  RadioGroup,
  Radio,
} from '@mui/joy';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  ShieldAlert,
  Scale,
  Calculator,
  BookOpen,
  Database,
  CheckCircle2,
  AlertTriangle,
  Zap,
  RotateCw,
  GitBranch,
  LayoutDashboard,
  Sliders,
  ArrowRight,
} from 'lucide-react';
import ScenarioRangeBar from '../../common/ScenarioRangeBar';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';
import {
  computeMarginOfSafety,
  calculateFixedBasePositionSize,
  simulatePreTradeImpact,
  formatCurrency,
  formatPercent,
  DEFAULT_RISK_CONFIG,
  type PortfolioConcentrationAudit,
  type ThemeMappingInput,
  type PositionSizingResult,
  type PreTradeSimulationResult,
} from '@oaktree/shared';
import { formatMosLabel, zoneColor } from '../../../utils/marginOfSafety';

export interface StockDossierCockpitProps {
  symbol: string;
  onNavigateTab: (tab: 'overview' | 'report' | 'dcf-model' | 'stock-thesis') => void;
  initialOverview?: any;
  initialReport?: any;
  initialTheses?: any[] | null;
  initialRiskAudit?: any;
  initialViewMode?: 'cockpit' | 'trace';
}

export default function StockDossierCockpit({
  symbol,
  onNavigateTab,
  initialOverview = null,
  initialReport = null,
  initialTheses = null,
  initialRiskAudit = null,
  initialViewMode = 'cockpit',
}: StockDossierCockpitProps) {
  const [overview, setOverview] = React.useState<any>(initialOverview);
  const [report, setReport] = React.useState<any>(initialReport);
  const [theses, setTheses] = React.useState<any[] | null>(initialTheses);
  const [riskAudit, setRiskAudit] = React.useState<any>(initialRiskAudit);

  const [loading, setLoading] = React.useState(
    !initialOverview || !initialReport || initialTheses === null || !initialRiskAudit
  );
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // View Mode: 'cockpit' (Executive Summary) vs 'trace' (Explainable Decision Trace Flow)
  const [viewMode, setViewMode] = React.useState<'cockpit' | 'trace'>(initialViewMode);

  // Interactive Quick Sizing Simulator Modal state
  const [simModalOpen, setSimModalOpen] = React.useState(false);
  const [simOrderType, setSimOrderType] = React.useState<'Buy' | 'Sell'>('Buy');
  const [simShares, setSimShares] = React.useState<string>('10');
  const [simPrice, setSimPrice] = React.useState<string>('');

  const fetchDossierData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [overviewRes, reportRes, thesesRes, riskRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/analysis/overview?symbol=${encodeURIComponent(symbol)}`),
        fetch(`${API_BASE_URL}/api/analysis/results?symbol=${encodeURIComponent(symbol)}`),
        fetch(`${API_BASE_URL}/api/analysis/theses?symbol=${encodeURIComponent(symbol)}`),
        fetch(`${API_BASE_URL}/api/portfolio/risk-audit`),
      ]);

      const overviewData = overviewRes.ok ? await overviewRes.json().catch(() => null) : null;
      const reportData = reportRes.ok ? await reportRes.json().catch(() => null) : null;
      const thesesData = thesesRes.ok ? await thesesRes.json().catch(() => []) : [];
      const riskData = riskRes.ok ? await riskRes.json().catch(() => null) : null;

      setOverview(overviewData);
      setReport(reportData);
      setTheses(Array.isArray(thesesData) ? thesesData : []);
      setRiskAudit(riskData);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch stock dossier data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [symbol]);

  React.useEffect(() => {
    let cancelled = false;
    if (!initialOverview || !initialReport || initialTheses === null || !initialRiskAudit) {
      fetchDossierData(false);
    }
    return () => {
      cancelled = true;
    };
  }, [symbol, fetchDossierData, initialOverview, initialReport, initialTheses, initialRiskAudit]);

  // Derived current market price
  const currentPrice = React.useMemo<number | null>(() => {
    if (overview?.dcfScenarios?.price && overview.dcfScenarios.price > 0) {
      return overview.dcfScenarios.price;
    }
    // Search holdings for price
    const holdingMatch = riskAudit?.concentration?.holdings?.find(
      (h: any) => h.symbol?.toUpperCase() === symbol.toUpperCase()
    );
    if (holdingMatch?.currentPrice && holdingMatch.currentPrice > 0) {
      return holdingMatch.currentPrice;
    }
    return null;
  }, [overview, riskAudit, symbol]);

  // Sync simulator price when current price resolves
  React.useEffect(() => {
    if (currentPrice && !simPrice) {
      setSimPrice(currentPrice.toString());
    }
  }, [currentPrice, simPrice]);

  // Derived Margin of Safety calculations (ADR-0014)
  const mosResult = React.useMemo(() => {
    return computeMarginOfSafety({
      price: currentPrice,
      bear: overview?.dcfScenarios?.bear,
      base: overview?.dcfScenarios?.base,
      bull: overview?.dcfScenarios?.bull,
    });
  }, [currentPrice, overview]);

  // Resolved Theme Mappings (ADR-0015)
  const resolvedThemeMappings = React.useMemo<readonly ThemeMappingInput[]>(() => {
    if (Array.isArray(riskAudit?.themeMappings) && riskAudit.themeMappings.length > 0) {
      return riskAudit.themeMappings;
    }
    const exposures = riskAudit?.concentration?.themeExposures || [];
    const derived: ThemeMappingInput[] = [];
    for (const te of exposures) {
      if (te.isUnassigned) continue;
      for (const sym of te.symbols || []) {
        if (sym) {
          derived.push({ symbol: sym, themeName: te.themeName });
        }
      }
    }
    return derived;
  }, [riskAudit]);

  // Concentration Audit Object
  const auditObject = React.useMemo<PortfolioConcentrationAudit | null>(() => {
    if (!riskAudit?.concentration) return null;
    return {
      totalStockPortfolioUsd: riskAudit.concentration.totalStockPortfolioUsd || 0,
      openHoldingsCount: riskAudit.concentration.openHoldingsCount || 0,
      stockConcentrations: riskAudit.concentration.stockConcentrations || [],
      themeExposures: riskAudit.concentration.themeExposures || [],
      hhi: riskAudit.concentration.hhi || 0,
      effectivePositions: riskAudit.concentration.effectivePositions || 0,
      top3ConcentrationPct: riskAudit.concentration.top3ConcentrationPct || 0,
      top5ConcentrationPct: riskAudit.concentration.top5ConcentrationPct || 0,
    };
  }, [riskAudit]);

  // Derived Fixed Base Position Sizing & Capacity (ADR-0015)
  const sizingResult = React.useMemo<PositionSizingResult | null>(() => {
    if (!auditObject || !currentPrice || currentPrice <= 0) {
      return null;
    }
    return calculateFixedBasePositionSize({
      symbol,
      currentPrice,
      audit: auditObject,
      themeMappings: resolvedThemeMappings,
      config: DEFAULT_RISK_CONFIG,
    });
  }, [auditObject, currentPrice, symbol, resolvedThemeMappings]);

  // Correlated stock pairs involving this symbol
  const correlatedPairs = React.useMemo(() => {
    if (!riskAudit?.correlation?.pairs) return [];
    return riskAudit.correlation.pairs.filter(
      (p: any) =>
        p.stock1?.toUpperCase() === symbol.toUpperCase() ||
        p.stock2?.toUpperCase() === symbol.toUpperCase()
    );
  }, [riskAudit, symbol]);

  // Active Thesis (first active thesis or first thesis)
  const activeThesis = React.useMemo(() => {
    if (!theses || theses.length === 0) return null;
    return theses.find((t) => t.status === 'Active') || theses[0];
  }, [theses]);

  // Dialectical debate data from report
  const debateData = React.useMemo(() => {
    if (report?.debate) return report.debate;
    if (report?.framework_results) {
      try {
        const fw =
          typeof report.framework_results === 'string'
            ? JSON.parse(report.framework_results)
            : report.framework_results;
        return fw?.debate || null;
      } catch {
        return null;
      }
    }
    return null;
  }, [report]);

  // Simulator impact computation (Instant 0ms client-side)
  const simImpact = React.useMemo<PreTradeSimulationResult | null>(() => {
    if (!auditObject || !currentPrice) return null;
    const numShares = parseFloat(simShares);
    const numPrice = parseFloat(simPrice || currentPrice.toString());
    if (isNaN(numShares) || numShares <= 0 || isNaN(numPrice) || numPrice <= 0) return null;

    return simulatePreTradeImpact({
      audit: auditObject,
      order: {
        symbol,
        type: simOrderType,
        shares: numShares,
        price: numPrice,
      },
      themeMappings: resolvedThemeMappings,
      config: DEFAULT_RISK_CONFIG,
    });
  }, [auditObject, currentPrice, symbol, simOrderType, simShares, simPrice, resolvedThemeMappings]);

  if (loading) {
    return (
      <Sheet
        sx={{
          ...glassStyle,
          p: 6,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          gap: 2,
        }}
      >
        <CircularProgress size="lg" color="success" />
        <Typography level="title-md">Loading Unified Dossier for {symbol}...</Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
          Aggregating Valuation, Adversarial Debate, Portfolio Governance, and Thesis records
        </Typography>
      </Sheet>
    );
  }

  if (error) {
    return (
      <Sheet sx={{ ...glassStyle, p: 4, textAlign: 'center' }}>
        <AlertTriangle size={36} color="#f43f5e" style={{ margin: '0 auto 12px' }} />
        <Typography level="h4" sx={{ color: 'danger.plainColor', mb: 1 }}>
          Failed to load stock cockpit
        </Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 3 }}>
          {error}
        </Typography>
        <Button
          variant="soft"
          color="neutral"
          startDecorator={<RotateCw size={15} />}
          onClick={() => fetchDossierData(true)}
        >
          Try Again
        </Button>
      </Sheet>
    );
  }

  // Visual status colors
  const conviction = debateData?.synthesis?.conviction_label || report?.conviction_level || 'Medium';
  const convictionColor =
    conviction === 'High' ? '#10b981' : conviction === 'Medium' ? '#eab308' : '#ef4444';

  const mosChipColor = mosResult?.zone ? zoneColor(mosResult.zone) : '#94a3b8';
  const mosLabel = formatMosLabel(mosResult?.mosBase);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* ── 1. Hero Cockpit Header & Actionability Banner ───────────────────── */}
      <Sheet
        sx={{
          ...glassStyle,
          p: { xs: 2.5, md: 3 },
          borderRadius: '24px',
          
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        }}
      >
        <Stack spacing={2.5}>
          {/* Top Row: Symbol, Company Details, View Switcher & Refresh */}
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
            spacing={2}
          >
            {/* Symbol & Name */}
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
                <Chip
                  size="lg"
                  variant="solid"
                  color="success"
                  sx={{
                    fontWeight: 900,
                    fontSize: '1.25rem',
                    letterSpacing: '0.05em',
                    px: 1.5,
                    bgcolor: '#10b981',
                  }}
                >
                  {symbol}
                </Chip>
                <Typography level="h2" sx={{ fontWeight: 800, fontSize: { xs: '1.4rem', sm: '1.75rem' } }}>
                  {overview?.name || symbol}
                </Typography>
                {overview?.exchange && (
                  <Chip size="sm" variant="soft" color="neutral" sx={{ fontSize: '0.75rem' }}>
                    {overview.exchange}
                  </Chip>
                )}
                {overview?.sector && (
                  <Chip size="sm" variant="outlined" color="primary" sx={{ fontSize: '0.75rem' }}>
                    {overview.sector}
                  </Chip>
                )}
              </Stack>
              <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                {overview?.industry ? `${overview.industry} • ` : ''}
                Currency: {overview?.currency || 'USD'} • Last Updated:{' '}
                {overview?.updatedAt || 'Recent'}
              </Typography>
            </Box>

            {/* Right Controls: View Switcher (Cockpit vs Trace) & Action Buttons */}
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
              {/* Dual Mode Switcher Toggle */}
              <Box
                sx={{
                  display: 'inline-flex',
                  p: 0.5,
                  borderRadius: '14px',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  
                }}
              >
                <Button
                  size="sm"
                  variant={viewMode === 'cockpit' ? 'solid' : 'plain'}
                  color={viewMode === 'cockpit' ? 'success' : 'neutral'}
                  startDecorator={<LayoutDashboard size={14} />}
                  onClick={() => setViewMode('cockpit')}
                  sx={{
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    px: 2,
                    ...(viewMode === 'cockpit' ? { bgcolor: '#10b981' } : { color: 'text.secondary' }),
                  }}
                >
                  Executive Cockpit
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'trace' ? 'solid' : 'plain'}
                  color={viewMode === 'trace' ? 'success' : 'neutral'}
                  startDecorator={<GitBranch size={14} />}
                  onClick={() => setViewMode('trace')}
                  sx={{
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    px: 2,
                    ...(viewMode === 'trace' ? { bgcolor: '#10b981' } : { color: 'text.secondary' }),
                  }}
                >
                  Decision Trace
                </Button>
              </Box>

              <Tooltip title="Refresh Dossier Data" arrow>
                <IconButton
                  size="sm"
                  variant="soft"
                  color="neutral"
                  loading={refreshing}
                  onClick={() => fetchDossierData(true)}
                  sx={{ borderRadius: '10px' }}
                >
                  <RotateCw size={15} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Divider sx={{ opacity: 0.1 }} />

          {/* Actionability Telemetry: Price, MoS Scenario Range Bar, and Sizing Capacity */}
          <Grid container spacing={2} alignItems="center">
            {/* Price & Conviction */}
            <Grid xs={12} sm={6} md={3}>
              <Box sx={{ p: 1.5, borderRadius: '16px', bgcolor: 'background.level1', border: '1px solid', borderColor: 'neutral.outlinedBorder', boxShadow: 'sm' }}>
                <Typography level="body-xs" sx={{ color: 'text.tertiary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Current Market Price
                </Typography>
                <Typography level="h3" sx={{ fontWeight: 900, my: 0.5 }}>
                  {currentPrice ? formatCurrency(currentPrice) : '—'}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Conviction:</Typography>
                  <Chip size="sm" variant="soft" sx={{ color: convictionColor, fontWeight: 800, fontSize: '0.75rem' }}>
                    {conviction}
                  </Chip>
                </Stack>
              </Box>
            </Grid>

            {/* Scenario Range Bar (Bear - Base - Bull) */}
            <Grid xs={12} sm={6} md={5}>
              <Box sx={{ p: 1.5, borderRadius: '16px', bgcolor: 'background.level1', border: '1px solid', borderColor: 'neutral.outlinedBorder', boxShadow: 'sm' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography level="body-xs" sx={{ color: 'text.tertiary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    DCF Valuation & MoS Range
                  </Typography>
                  {mosResult.mosBase !== null && (
                    <Chip
                      size="sm"
                      variant="solid"
                      sx={{
                        bgcolor: mosChipColor,
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        color: '#050505',
                      }}
                    >
                      MoS: {mosLabel}
                    </Chip>
                  )}
                </Stack>
                <ScenarioRangeBar
                  price={currentPrice}
                  bear={overview?.dcfScenarios?.bear}
                  base={overview?.dcfScenarios?.base}
                  bull={overview?.dcfScenarios?.bull}
                />
              </Box>
            </Grid>

            {/* Position Sizing Capacity & Governance Badge */}
            <Grid xs={12} md={4}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: '16px',
                  bgcolor: 'background.level1',
                  border: '1px solid',
                  borderColor: 'neutral.outlinedBorder',
                  boxShadow: 'sm',
                  position: 'relative',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography level="body-xs" sx={{ color: 'text.tertiary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Position Sizing Room
                  </Typography>
                  <Button
                    size="sm"
                    variant="soft"
                    color="primary"
                    startDecorator={<Sliders size={13} />}
                    onClick={() => setSimModalOpen(true)}
                    sx={{ fontSize: '0.75rem', py: 0.2, px: 1, borderRadius: '8px' }}
                  >
                    Quick Sim
                  </Button>
                </Stack>

                {sizingResult ? (
                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                      <Typography level="title-sm" sx={{ fontWeight: 800 }}>
                        {sizingResult.maxAllowedBuyUsd > 0
                          ? `Up to ${formatCurrency(sizingResult.maxAllowedBuyUsd)}`
                          : '$0.00 (Cap Reached)'}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                        ~{sizingResult.maxAllowedBuyShares.toLocaleString()} shares
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="sm"
                        variant="soft"
                        color={sizingResult.maxAllowedBuyUsd > 0 ? 'success' : 'warning'}
                        sx={{ fontSize: '0.7rem', fontWeight: 700 }}
                      >
                        Bound by: {sizingResult.bindingCapReason}
                      </Chip>
                      <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                        Weight: {formatPercent(sizingResult.currentWeightPct)}
                      </Typography>
                    </Stack>
                  </Stack>
                ) : (
                  <Typography level="body-xs" sx={{ color: 'text.secondary', py: 1 }}>
                    Connect portfolio holdings to compute 8%/15%/30% capacity.
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        </Stack>
      </Sheet>

      {/* ── 2. View Mode Content ────────────────────────────────────────────── */}
      {viewMode === 'cockpit' ? (
        /* ── 2A. Executive Cockpit: 4-Quadrant High-Density Grid ───────────── */
        <Grid container spacing={2.5}>
          {/* Quadrant A: Valuation Anchor & MoS */}
          <Grid xs={12} md={6}>
            <Sheet
              sx={{
                ...glassStyle,
                p: 3,
                borderRadius: '24px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                
              }}
            >
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ p: 1, borderRadius: '10px', bgcolor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                      <Calculator size={18} />
                    </Box>
                    <Typography level="title-md" sx={{ fontWeight: 800 }}>
                      Quadrant A: Valuation Anchor
                    </Typography>
                  </Stack>
                  <Button
                    size="sm"
                    variant="plain"
                    color="primary"
                    endDecorator={<ArrowRight size={14} />}
                    onClick={() => onNavigateTab('dcf-model')}
                    sx={{ fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    DCF Model
                  </Button>
                </Stack>

                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  <Grid xs={4}>
                    <Box sx={{ p: 1.25, borderRadius: '12px', bgcolor: 'background.level1', border: '1px solid', borderColor: 'neutral.outlinedBorder', boxShadow: 'sm', textAlign: 'center' }}>
                      <Typography level="body-xs" sx={{ color: 'danger.plainColor', fontWeight: 700 }}>Bear Case</Typography>
                      <Typography level="title-sm" sx={{ fontWeight: 800, mt: 0.5 }}>
                        {overview?.dcfScenarios?.bear ? formatCurrency(overview.dcfScenarios.bear) : '—'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={4}>
                    <Box sx={{ p: 1.25, borderRadius: '12px', bgcolor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', textAlign: 'center', boxShadow: 'sm' }}>
                      <Typography level="body-xs" sx={{ color: 'success.plainColor', fontWeight: 800 }}>Base Fair Value</Typography>
                      <Typography level="title-sm" sx={{ fontWeight: 900, mt: 0.5, color: '#10b981' }}>
                        {overview?.dcfScenarios?.base ? formatCurrency(overview.dcfScenarios.base) : '—'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={4}>
                    <Box sx={{ p: 1.25, borderRadius: '12px', bgcolor: 'background.level1', border: '1px solid', borderColor: 'neutral.outlinedBorder', boxShadow: 'sm', textAlign: 'center' }}>
                      <Typography level="body-xs" sx={{ color: 'primary.plainColor', fontWeight: 700 }}>Bull Case</Typography>
                      <Typography level="title-sm" sx={{ fontWeight: 800, mt: 0.5 }}>
                        {overview?.dcfScenarios?.bull ? formatCurrency(overview.dcfScenarios.bull) : '—'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>

                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Base Margin of Safety:</Typography>
                    <Typography level="body-xs" sx={{ fontWeight: 800, color: mosChipColor }}>
                      {mosResult.mosBase !== null ? `${mosResult.mosBase > 0 ? '+' : ''}${formatPercent(mosResult.mosBase)} (${mosLabel})` : '—'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Asymmetric Upside/Downside:</Typography>
                    <Typography level="body-xs" sx={{ fontWeight: 700 }}>
                      {overview?.dcfScenarios?.bull && overview?.dcfScenarios?.bear && currentPrice
                        ? `+${formatPercent(((overview.dcfScenarios.bull - currentPrice) / currentPrice) * 100)} / -${formatPercent(Math.abs((overview.dcfScenarios.bear - currentPrice) / currentPrice) * 100)}`
                        : '—'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Valuation Multiples:</Typography>
                    <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                      P/E: {overview?.companyStatistics?.valuationHealth?.[0]?.items?.find((i: any) => i.label?.includes('P/E'))?.value || '—'} • P/FCF: {overview?.companyStatistics?.valuationHealth?.[0]?.items?.find((i: any) => i.label?.includes('P/FCF') || i.label?.includes('Free Cash Flow'))?.value || '—'}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            </Sheet>
          </Grid>

          {/* Quadrant B: Adversarial Debate */}
          <Grid xs={12} md={6}>
            <Sheet
              sx={{
                ...glassStyle,
                p: 3,
                borderRadius: '24px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                
              }}
            >
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ p: 1, borderRadius: '10px', bgcolor: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }}>
                      <Scale size={18} />
                    </Box>
                    <Typography level="title-md" sx={{ fontWeight: 800 }}>
                      Quadrant B: Adversarial Debate
                    </Typography>
                  </Stack>
                  <Button
                    size="sm"
                    variant="plain"
                    color="primary"
                    endDecorator={<ArrowRight size={14} />}
                    onClick={() => onNavigateTab('report')}
                    sx={{ fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    Full Debate
                  </Button>
                </Stack>

                {debateData ? (
                  <Stack spacing={1.5}>
                    {/* Top Bull Catalyst */}
                    <Box sx={{ p: 1.5, borderRadius: '14px', bgcolor: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)', boxShadow: 'sm' }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <TrendingUp size={15} color="#10b981" />
                        <Typography level="title-sm" sx={{ color: 'success.plainColor', fontWeight: 700 }}>
                          Bull Catalyst
                        </Typography>
                      </Stack>
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                        {debateData.round1?.bull?.growth_catalysts?.[0] ||
                          debateData.round1?.bull?.bull_thesis ||
                          'Strong competitive moat and sustained cash generation.'}
                      </Typography>
                    </Box>

                    {/* Top Bear Downside Risk */}
                    <Box sx={{ p: 1.5, borderRadius: '14px', bgcolor: 'rgba(244, 63, 94, 0.06)', border: '1px solid rgba(244, 63, 94, 0.2)', boxShadow: 'sm' }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <TrendingDown size={15} color="#f43f5e" />
                        <Typography level="title-sm" sx={{ color: 'danger.plainColor', fontWeight: 700 }}>
                          Bear Risk
                        </Typography>
                      </Stack>
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                        {debateData.round1?.bear?.downside_risks?.[0] ||
                          debateData.round1?.bear?.bear_thesis ||
                          'Margin compression and cyclical deceleration risks.'}
                      </Typography>
                    </Box>

                    {/* Key Decisive Tension */}
                    {debateData.synthesis?.key_tensions?.[0] && (
                      <Typography level="body-xs" sx={{ color: 'text.tertiary', fontStyle: 'italic', px: 0.5 }}>
                        💡 Key Tension: {debateData.synthesis.key_tensions[0].topic} — {debateData.synthesis.key_tensions[0].decisive_factor}
                      </Typography>
                    )}
                  </Stack>
                ) : (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
                      No dialectical debate recorded for {symbol}.
                    </Typography>
                    <Button
                      size="sm"
                      variant="soft"
                      color="success"
                      onClick={() => onNavigateTab('report')}
                    >
                      Run Debate Analysis
                    </Button>
                  </Box>
                )}
              </Box>
            </Sheet>
          </Grid>

          {/* Quadrant C: Portfolio Fit & Risk Governance */}
          <Grid xs={12} md={6}>
            <Sheet
              sx={{
                ...glassStyle,
                p: 3,
                borderRadius: '24px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                
              }}
            >
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ p: 1, borderRadius: '10px', bgcolor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                      <Shield size={18} />
                    </Box>
                    <Typography level="title-md" sx={{ fontWeight: 800 }}>
                      Quadrant C: Portfolio Governance
                    </Typography>
                  </Stack>
                  <Button
                    size="sm"
                    variant="plain"
                    color="primary"
                    endDecorator={<ArrowRight size={14} />}
                    onClick={() => {
                      window.location.href = '/portfolio?tab=risk';
                    }}
                    sx={{ fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    Risk Tab
                  </Button>
                </Stack>

                <Stack spacing={1.5}>
                  <Box sx={{ p: 1.5, borderRadius: '14px', bgcolor: 'background.level1', border: '1px solid', borderColor: 'neutral.outlinedBorder', boxShadow: 'sm' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Howard Marks Governance:</Typography>
                      <Chip size="sm" variant="soft" color="success" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>
                        8% Target • 15% Stock • 30% Theme
                      </Chip>
                    </Stack>
                    <Divider sx={{ my: 1, opacity: 0.06 }} />
                    <Grid container spacing={1}>
                      <Grid xs={6}>
                        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>Room to 8% Target:</Typography>
                        <Typography level="title-sm" sx={{ fontWeight: 800, mt: 0.2 }}>
                          {sizingResult ? formatCurrency(sizingResult.roomToTargetUsd) : '—'}
                        </Typography>
                      </Grid>
                      <Grid xs={6}>
                        <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>Room to 15% Cap:</Typography>
                        <Typography level="title-sm" sx={{ fontWeight: 800, mt: 0.2 }}>
                          {sizingResult ? formatCurrency(sizingResult.roomToStockCapUsd) : '—'}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Correlation status */}
                  <Box sx={{ p: 1.5, borderRadius: '14px', bgcolor: 'background.level1', border: '1px solid', borderColor: 'neutral.outlinedBorder', boxShadow: 'sm' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Correlated Stock Pairs (r ≥ 0.70):</Typography>
                      <Typography level="body-xs" sx={{ fontWeight: 700, color: correlatedPairs.length > 0 ? '#f59e0b' : '#10b981' }}>
                        {correlatedPairs.length} pair{correlatedPairs.length !== 1 ? 's' : ''}
                      </Typography>
                    </Stack>
                    {correlatedPairs.length > 0 ? (
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap">
                        {correlatedPairs.slice(0, 3).map((p: any, idx: number) => {
                          const other = p.stock1?.toUpperCase() === symbol.toUpperCase() ? p.stock2 : p.stock1;
                          return (
                            <Chip key={idx} size="sm" variant="soft" color="warning" sx={{ fontSize: '0.7rem' }}>
                              {other} (r={p.r?.toFixed(2)})
                            </Chip>
                          );
                        })}
                      </Stack>
                    ) : (
                      <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 0.5 }}>
                        Low correlation to existing holdings. Diversification friendly.
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Box>
            </Sheet>
          </Grid>

          {/* Quadrant D: Investor Thesis & Catalysts */}
          <Grid xs={12} md={6}>
            <Sheet
              sx={{
                ...glassStyle,
                p: 3,
                borderRadius: '24px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                
              }}
            >
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ p: 1, borderRadius: '10px', bgcolor: 'rgba(249, 115, 22, 0.15)', color: '#fb923c' }}>
                      <BookOpen size={18} />
                    </Box>
                    <Typography level="title-md" sx={{ fontWeight: 800 }}>
                      Quadrant D: Investor Thesis
                    </Typography>
                  </Stack>
                  <Button
                    size="sm"
                    variant="plain"
                    color="primary"
                    endDecorator={<ArrowRight size={14} />}
                    onClick={() => onNavigateTab('stock-thesis')}
                    sx={{ fontSize: '0.8rem', fontWeight: 700 }}
                  >
                    Edit Thesis
                  </Button>
                </Stack>

                {activeThesis ? (
                  <Stack spacing={1.5}>
                    <Box sx={{ p: 1.5, borderRadius: '14px', bgcolor: 'background.level1', border: '1px solid', borderColor: 'neutral.outlinedBorder', boxShadow: 'sm' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography level="title-sm" sx={{ fontWeight: 800 }}>
                          {activeThesis.title}
                        </Typography>
                        <Chip size="sm" variant="soft" color="success" sx={{ fontSize: '0.7rem' }}>
                          {activeThesis.status}
                        </Chip>
                      </Stack>
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                        {activeThesis.note || activeThesis.catalysts || 'Thesis actively tracked.'}
                      </Typography>
                    </Box>

                    <Grid container spacing={1}>
                      <Grid xs={6}>
                        <Box sx={{ p: 1.25, borderRadius: '12px', bgcolor: 'background.level1', border: '1px solid', borderColor: 'neutral.outlinedBorder', boxShadow: 'sm' }}>
                          <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>Target Buy Price:</Typography>
                          <Typography level="title-sm" sx={{ fontWeight: 800, mt: 0.2 }}>
                            {activeThesis.buy_price ? formatCurrency(activeThesis.buy_price) : '—'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid xs={6}>
                        <Box sx={{ p: 1.25, borderRadius: '12px', bgcolor: 'background.level1', border: '1px solid', borderColor: 'neutral.outlinedBorder', boxShadow: 'sm' }}>
                          <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>Target Sell Price:</Typography>
                          <Typography level="title-sm" sx={{ fontWeight: 800, mt: 0.2 }}>
                            {activeThesis.sell_price ? formatCurrency(activeThesis.sell_price) : '—'}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    <Typography level="body-xs" sx={{ color: 'text.tertiary', px: 0.5 }}>
                      Recorded on: {new Date(activeThesis.created_at).toLocaleDateString()}
                    </Typography>
                  </Stack>
                ) : (
                  <Box sx={{ py: 3, textAlign: 'center' }}>
                    <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
                      No active investment thesis drafted for {symbol}.
                    </Typography>
                    <Button
                      size="sm"
                      variant="soft"
                      color="primary"
                      onClick={() => onNavigateTab('stock-thesis')}
                    >
                      Draft Thesis Now
                    </Button>
                  </Box>
                )}
              </Box>
            </Sheet>
          </Grid>
        </Grid>
      ) : (
        /* ── 2B. Explainable Decision Trace Flow (Auditable Timeline) ────────── */
        <Sheet
          sx={{
            ...glassStyle,
            p: { xs: 2.5, md: 4 },
            borderRadius: '24px',
            
          }}
        >
          <Stack spacing={3}>
            <Box>
              <Typography level="h3" sx={{ fontWeight: 900, mb: 0.5 }}>
                🔍 Multi-Agent Decision Trace & Auditability Flow
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                End-to-end transparent reasoning path illustrating how data transforms into investment decisions.
              </Typography>
            </Box>

            <Divider sx={{ opacity: 0.1 }} />

            {/* Step-by-Step Vertical Trace Flow */}
            <Stack spacing={2.5}>
              {/* Stage 1: Data Ingestion */}
              <Sheet
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  bgcolor: 'background.level1',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  boxShadow: 'sm',
                  position: 'relative',
                }}
              >
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ p: 1.25, borderRadius: '12px', bgcolor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                    <Database size={20} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography level="title-sm" sx={{ fontWeight: 800 }}>
                        Stage 1: Raw Financial Ingestion & Telemetry
                      </Typography>
                      <Chip size="sm" variant="soft" color="primary">Verified</Chip>
                    </Stack>
                    <Typography level="body-sm" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      Ingested balance sheet, cash flows, and operating metrics from FMP/D1.
                      {overview?.updatedAt ? ` Data fresh as of ${overview.updatedAt}.` : ''}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 1 }}>
                      • Annual periods: {overview?.annual?.length || 0} • Quarterly periods: {overview?.quarterly?.length || 0}
                    </Typography>
                  </Box>
                </Stack>
              </Sheet>

              {/* Stage 2: Adversarial Debate Synthesis */}
              <Sheet
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  bgcolor: 'background.level1',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  boxShadow: 'sm',
                }}
              >
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ p: 1.25, borderRadius: '12px', bgcolor: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }}>
                    <Scale size={20} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography level="title-sm" sx={{ fontWeight: 800 }}>
                        Stage 2: Dialectical Bull vs. Bear Debate
                      </Typography>
                      <Chip size="sm" variant="soft" sx={{ color: convictionColor, fontWeight: 700 }}>
                        Conviction: {conviction}
                      </Chip>
                    </Stack>
                    <Typography level="body-sm" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      Synthesized competing adversarial perspectives to stress-test confirmation bias.
                    </Typography>
                    {debateData?.synthesis?.verdict_summary && (
                      <Box sx={{ p: 1.5, mt: 1.5, borderRadius: '10px', bgcolor: 'background.level2', borderLeft: '3px solid #eab308' }}>
                        <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                          "{debateData.synthesis.verdict_summary}"
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Stack>
              </Sheet>

              {/* Stage 3: Valuation Modeling */}
              <Sheet
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  bgcolor: 'background.level1',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  boxShadow: 'sm',
                }}
              >
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ p: 1.25, borderRadius: '12px', bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                    <Calculator size={20} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography level="title-sm" sx={{ fontWeight: 800 }}>
                        Stage 3: DCF Parameter Extractor & Scenarios
                      </Typography>
                      <Chip size="sm" variant="soft" color="success">Calibrated</Chip>
                    </Stack>
                    <Typography level="body-sm" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      Debate catalysts and risks mapped to Cash Flow assumptions, generating Bear ({overview?.dcfScenarios?.bear ? formatCurrency(overview.dcfScenarios.bear) : '—'}), Base ({overview?.dcfScenarios?.base ? formatCurrency(overview.dcfScenarios.base) : '—'}), and Bull ({overview?.dcfScenarios?.bull ? formatCurrency(overview.dcfScenarios.bull) : '—'}).
                    </Typography>
                    {mosResult.mosBase !== null && (
                      <Typography level="body-xs" sx={{ color: mosChipColor, fontWeight: 700, mt: 1 }}>
                        • Intrinsic Margin of Safety: {mosLabel}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Sheet>

              {/* Stage 4: Risk Governance */}
              <Sheet
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  bgcolor: 'background.level1',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  boxShadow: 'sm',
                }}
              >
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ p: 1.25, borderRadius: '12px', bgcolor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                    <ShieldAlert size={20} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography level="title-sm" sx={{ fontWeight: 800 }}>
                        Stage 4: Portfolio Governance & Concentration Audit
                      </Typography>
                      <Chip size="sm" variant="soft" color="primary">Audited</Chip>
                    </Stack>
                    <Typography level="body-sm" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      Evaluated position sizing against Howard Marks framework: 8% Target Weight, 15% Single-Stock Cap, and 30% Strictest Theme Cap.
                    </Typography>
                    {sizingResult && (
                      <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 1 }}>
                        • Current Weight: {formatPercent(sizingResult.currentWeightPct)} • Binding Constraint: {sizingResult.bindingCapReason} • Max Addable: {formatCurrency(sizingResult.maxAllowedBuyUsd)}
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Sheet>

              {/* Stage 5: Final Execution Advisory */}
              <Sheet
                sx={{
                  p: 2.5,
                  borderRadius: '16px',
                  bgcolor: 'background.level1',
                  border: '1px solid rgba(249, 115, 22, 0.3)',
                  boxShadow: 'sm',
                }}
              >
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box sx={{ p: 1.25, borderRadius: '12px', bgcolor: 'rgba(249, 115, 22, 0.15)', color: '#fb923c' }}>
                    <Zap size={20} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography level="title-sm" sx={{ fontWeight: 800 }}>
                        Stage 5: Final Actionable Execution Advisory
                      </Typography>
                      <Chip size="sm" variant="solid" color="success" sx={{ bgcolor: '#10b981', color: '#050505', fontWeight: 800 }}>
                        Actionable
                      </Chip>
                    </Stack>
                    <Typography level="body-sm" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      {sizingResult && sizingResult.maxAllowedBuyUsd > 0
                        ? `Approved for entry/accumulation up to ${formatCurrency(sizingResult.maxAllowedBuyUsd)} (~${sizingResult.maxAllowedBuyShares.toLocaleString()} shares) under ${sizingResult.bindingCapReason}.`
                        : 'Portfolio constraints currently restrict further accumulation. Maintain existing position or wait for rebalancing.'}
                    </Typography>
                  </Box>
                </Stack>
              </Sheet>
            </Stack>
          </Stack>
        </Sheet>
      )}

      {/* ── 3. Quick Sizing Simulator Modal ──────────────────────────────────── */}
      <Modal open={simModalOpen} onClose={() => setSimModalOpen(false)}>
        <ModalDialog
          role="alertdialog"
          sx={{
            ...glassStyle,
            p: 3.5,
            width: '100%',
            maxWidth: 500,
            borderRadius: '24px',
            
          }}
        >
          <DialogTitle sx={{ fontWeight: 800, fontSize: '1.25rem' }}>
            ⚡ Instant Sizing & Pre-Trade Simulator
          </DialogTitle>
          <DialogContent>
            <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
              Simulate trade impact on {symbol} with 0ms client-side calculation under Howard Marks Governance Caps.
            </Typography>

            <Stack spacing={2}>
              {/* Order Type */}
              <Box>
                <Typography level="body-xs" sx={{ color: 'text.tertiary', mb: 0.5 }}>
                  Order Type
                </Typography>
                <RadioGroup
                  orientation="horizontal"
                  value={simOrderType}
                  onChange={(e) => setSimOrderType(e.target.value as 'Buy' | 'Sell')}
                  sx={{ gap: 2 }}
                >
                  <Radio value="Buy" label="Buy / Accumulate" color="success" />
                  <Radio value="Sell" label="Sell / Trim" color="danger" />
                </RadioGroup>
              </Box>

              {/* Shares & Price Inputs */}
              <Grid container spacing={1.5}>
                <Grid xs={6}>
                  <Typography level="body-xs" sx={{ color: 'text.tertiary', mb: 0.5 }}>
                    Shares
                  </Typography>
                  <Input
                    type="number"
                    value={simShares}
                    onChange={(e) => setSimShares(e.target.value)}
                    placeholder="10"
                    sx={{ borderRadius: '10px' }}
                  />
                </Grid>
                <Grid xs={6}>
                  <Typography level="body-xs" sx={{ color: 'text.tertiary', mb: 0.5 }}>
                    Price ($)
                  </Typography>
                  <Input
                    type="number"
                    value={simPrice}
                    onChange={(e) => setSimPrice(e.target.value)}
                    placeholder={currentPrice?.toString() || '100'}
                    sx={{ borderRadius: '10px' }}
                  />
                </Grid>
              </Grid>

              {/* Simulation Result Box */}
              {simImpact && (
                <Sheet
                  sx={{
                    p: 2,
                    borderRadius: '14px',
                    bgcolor: 'background.level1',
                    border: '1px solid',
                    borderColor: 'neutral.outlinedBorder',
                    boxShadow: 'sm',
                  }}
                >
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Estimated Order Total:</Typography>
                      <Typography level="body-xs" sx={{ fontWeight: 800 }}>
                        {formatCurrency(simImpact.tradeValueUsd)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>New Weight in Portfolio:</Typography>
                      <Typography level="body-xs" sx={{ fontWeight: 800 }}>
                        {formatPercent(simImpact.currentStockWeightPct)} ➔ {formatPercent(simImpact.projectedStockWeightPct)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>Governance Status:</Typography>
                      <Chip
                        size="sm"
                        variant="soft"
                        color={!simImpact.causesStockCapBreach && !simImpact.causesThemeCapBreach ? 'success' : 'danger'}
                        sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                      >
                        {!simImpact.causesStockCapBreach && !simImpact.causesThemeCapBreach ? 'Allowed' : 'Exceeds Cap'}
                      </Chip>
                    </Stack>
                    {(simImpact.causesStockCapBreach || simImpact.causesThemeCapBreach) && (
                      <Typography level="body-xs" sx={{ color: 'danger.plainColor', fontWeight: 600, mt: 0.5 }}>
                        ⚠️ Order exceeds maximum permitted governance allocation for this asset.
                      </Typography>
                    )}
                  </Stack>
                </Sheet>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="plain" color="neutral" onClick={() => setSimModalOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </Box>
  );
}
