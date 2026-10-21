import * as React from 'react';
import {
  Box,
  Grid,
  Sheet,
  Typography,
  Table,
  Chip,
  Button,
  Input,
  Select,
  Option,
  Divider,
  Stack,
  LinearProgress,
  IconButton,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
} from '@mui/joy';
import {
  ShieldAlert,
  Scale,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Calculator,
  ArrowRight,
  PieChart,
  Table2,
  Activity,
  Layers,
  Trash2,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import ThemeDonutChart from './ThemeDonutChart';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';
import { formatCurrency, formatPct } from './YahooPortfolio';
import { useSettingsStore } from '../../../store/settingsStore';

export interface RiskSizingTabProps {
  onNavigateToHoldings?: () => void;
  initialAuditData?: any;
  autoFetch?: boolean;
  initialThemeViewMode?: 'chart' | 'table';
  initialDeletingTheme?: string | null;
  initialEditingTheme?: string | null;
  initialEditedThemeValue?: string;
  initialSelectedSymbol?: string;
}

export default function RiskSizingTab({
  onNavigateToHoldings,
  initialAuditData,
  autoFetch = true,
  initialThemeViewMode = 'chart',
  initialDeletingTheme = null,
  initialEditingTheme = null,
  initialEditedThemeValue,
  initialSelectedSymbol = '',
}: RiskSizingTabProps) {
  const showMoneyValues = useSettingsStore(state => state.showMoneyValues);

  const [loading, setLoading] = React.useState(!initialAuditData);
  const [refreshing, setRefreshing] = React.useState(false);
  const [runningAi, setRunningAi] = React.useState(false);

  const [auditData, setAuditData] = React.useState<any>(initialAuditData || null);
  const [error, setError] = React.useState<string | null>(null);
  const [themeViewMode, setThemeViewMode] = React.useState<'chart' | 'table'>(initialThemeViewMode);

  // Delete Theme state
  const [deletingThemeName, setDeletingThemeName] = React.useState<string | null>(initialDeletingTheme);
  const [isDeletingTheme, setIsDeletingTheme] = React.useState(false);

  // Inline Edit Theme Name state
  const [editingThemeName, setEditingThemeName] = React.useState<string | null>(initialEditingTheme);
  const [editedThemeValue, setEditedThemeValue] = React.useState<string>(
    initialEditedThemeValue !== undefined ? initialEditedThemeValue : (initialEditingTheme || '')
  );
  const [isSavingTheme, setIsSavingTheme] = React.useState(false);

  // Position Sizing Simulator state
  const [selectedSymbol, setSelectedSymbol] = React.useState<string>(
    initialSelectedSymbol || (initialAuditData?.holdingsSizing?.[0]?.symbol || '')
  );
  const [customSymbol, setCustomSymbol] = React.useState<string>('');
  const [orderType, setOrderType] = React.useState<'Buy' | 'Sell'>('Buy');
  const [orderShares, setOrderShares] = React.useState<string>('10');
  const [orderPrice, setOrderPrice] = React.useState<string>('');
  const [simulating, setSimulating] = React.useState(false);
  const [sizingResult, setSizingResult] = React.useState<any>(null);

  const activeSymbol = selectedSymbol === '__CUSTOM__' ? customSymbol.trim().toUpperCase() : selectedSymbol;

  // Load audit data
  const fetchAudit = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/risk-audit`);
      if (!res.ok) {
        throw new Error(`Failed to load risk audit: ${res.statusText}`);
      }
      const data = (await res.json()) as any;
      setAuditData(data);

      // Auto-select first holding if not selected
      if (!selectedSymbol && data.holdingsSizing && data.holdingsSizing.length > 0) {
        setSelectedSymbol(data.holdingsSizing[0].symbol);
        setOrderPrice(String(data.holdingsSizing[0].lastPrice || ''));
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Error fetching risk audit data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSymbol]);

  React.useEffect(() => {
    if (autoFetch) {
      fetchAudit();
    }
  }, [fetchAudit, autoFetch]);

  // When selected symbol changes, update order price and trigger simulation
  React.useEffect(() => {
    if (!auditData?.holdingsSizing) return;
    const match = auditData.holdingsSizing.find((h: any) => h.symbol === activeSymbol);
    if (match && match.lastPrice) {
      setOrderPrice(String(match.lastPrice));
    }
  }, [activeSymbol, auditData]);

  // Sizing & Simulation calculation
  const runSimulation = React.useCallback(async () => {
    if (!activeSymbol) return;
    setSimulating(true);

    try {
      const priceNum = parseFloat(orderPrice) || 0;
      const sharesNum = parseFloat(orderShares) || 0;

      const res = await fetch(`${API_BASE_URL}/api/portfolio/position-sizing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: activeSymbol,
          price: priceNum,
          shares: sharesNum,
          type: orderType,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSizingResult(data);
      }
    } catch (e) {
      console.error('Simulation error:', e);
    } finally {
      setSimulating(false);
    }
  }, [activeSymbol, orderPrice, orderShares, orderType]);

  React.useEffect(() => {
    if (activeSymbol && auditData) {
      runSimulation();
    }
  }, [activeSymbol, orderPrice, orderShares, orderType, auditData, runSimulation]);

  // Delete theme handler
  const handleDeleteTheme = async () => {
    if (!deletingThemeName) return;
    setIsDeletingTheme(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/themes/${encodeURIComponent(deletingThemeName)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as any;
        throw new Error(err.error || 'Failed to delete theme');
      }
      setDeletingThemeName(null);
      await fetchAudit(true);
    } catch (err: any) {
      console.error('Failed to delete theme:', err);
      setError(err.message || 'Failed to delete theme');
    } finally {
      setIsDeletingTheme(false);
    }
  };

  // Inline Edit Theme Name handlers
  const handleStartEditTheme = (themeName: string) => {
    setEditingThemeName(themeName);
    setEditedThemeValue(themeName);
    setError(null);
  };

  const handleCancelEditTheme = () => {
    setEditingThemeName(null);
    setEditedThemeValue('');
  };

  const handleSaveTheme = async (oldThemeName: string) => {
    const trimmedNewName = editedThemeValue.trim();
    if (!trimmedNewName) {
      setError('Theme name cannot be empty');
      return;
    }
    if (trimmedNewName.toLowerCase() === 'unassigned') {
      setError('Cannot rename theme to reserved name "Unassigned"');
      return;
    }
    if (trimmedNewName === oldThemeName) {
      handleCancelEditTheme();
      return;
    }

    setIsSavingTheme(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/themes/${encodeURIComponent(oldThemeName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newThemeName: trimmedNewName }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as any;
        throw new Error(err.error || 'Failed to rename theme');
      }
      setEditingThemeName(null);
      setEditedThemeValue('');
      await fetchAudit(true);
    } catch (err: any) {
      console.error('Failed to rename theme:', err);
      setError(err.message || 'Failed to rename theme');
    } finally {
      setIsSavingTheme(false);
    }
  };

  // Trigger Workers AI Risk Advisory
  const handleRunAiAudit = async () => {
    setRunningAi(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/risk-advisory`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchAudit(true);
      } else {
        const err = (await res.json()) as any;
        setError(`Failed to run AI Risk Advisory: ${err.error || 'Server error'}`);
      }
    } catch (e: any) {
      console.error('AI Advisory run failed:', e);
      setError(e.message || 'AI Advisory run failed');
    } finally {
      setRunningAi(false);
    }
  };

  if (loading && !auditData) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography level="body-md">Loading Portfolio Risk & Position Sizing Engine...</Typography>
        <LinearProgress sx={{ mt: 2, maxWidth: 300, mx: 'auto' }} />
      </Box>
    );
  }

  const concentration = auditData?.concentration || {};
  const correlation = auditData?.correlation || {};
  const health = auditData?.health || { healthScore: 100, riskLevel: 'Low', deductions: [] };
  const holdingsSizing = auditData?.holdingsSizing || [];
  const themeExposures = concentration.themeExposures || [];
  const highCorrelationPairs = correlation.highCorrelationPairs || [];
  const latestAdvisory = auditData?.latestAdvisory;

  const totalPortfolioUsd = concentration.totalStockPortfolioUsd || 0;
  const healthScore = health.healthScore ?? 100;
  const riskLevel = health.riskLevel || 'Low';

  const riskLevelColor =
    riskLevel === 'Low' ? 'success' :
    riskLevel === 'Moderate' ? 'warning' :
    riskLevel === 'Elevated' ? 'warning' : 'danger';

  const currentSizing =
    sizingResult?.sizing ||
    holdingsSizing.find((h: any) => h.symbol === activeSymbol)?.sizing ||
    holdingsSizing[0]?.sizing;
  const currentSimulation = sizingResult?.simulation;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Top Controls Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography level="h3" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShieldAlert size={26} color="#0ea5e9" />
            Risk Manager & Position Sizing Agent
          </Typography>
          <Typography level="body-xs" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Howard Marks risk control rules: 8% Target Weight, 15% Single-Stock Cap, 30% Strictest Theme Cap
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="solid"
            color="primary"
            size="sm"
            loading={runningAi}
            startDecorator={<Sparkles size={16} />}
            onClick={handleRunAiAudit}
            sx={{ borderRadius: '10px', fontWeight: 700 }}
          >
            Run AI Risk Audit
          </Button>

          <IconButton
            variant="soft"
            color="neutral"
            size="sm"
            loading={refreshing}
            onClick={() => fetchAudit(true)}
            sx={{ borderRadius: '10px' }}
          >
            <RefreshCw size={16} />
          </IconButton>
        </Stack>
      </Box>

      {error && (
        <Sheet variant="soft" color="danger" sx={{ p: 2, borderRadius: '12px' }}>
          <Typography level="body-sm">{error}</Typography>
        </Sheet>
      )}

      {/* 1. Top KPI Summary Grid */}
      <Grid container spacing={2}>
        {/* KPI 1: Health Score */}
        <Grid xs={12} sm={12} md={6} lg={6} xl={4}>
          <Sheet sx={{ ...glassStyle, p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography level="body-xs" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Portfolio Health Score
                </Typography>
                <Chip variant="solid" color={riskLevelColor} size="sm" sx={{ fontWeight: 700 }}>
                  {riskLevel} Risk
                </Chip>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1 }}>
                <Typography level="h1" sx={{ fontWeight: 800, fontSize: '2.4rem', color: 'text.primary' }}>
                  {healthScore}
                </Typography>
                <Typography level="body-md" sx={{ color: 'text.secondary', fontWeight: 600 }}>/ 100</Typography>
              </Box>

              <LinearProgress
                determinate
                value={healthScore}
                color={riskLevelColor}
                sx={{ height: 8, borderRadius: 4, mb: 2 }}
              />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Box>
                <Typography level="body-xs" sx={{ color: 'text.secondary', fontWeight: 600 }}>Top 3 Weight</Typography>
                <Typography level="body-md" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {concentration.top3ConcentrationPct ? `${concentration.top3ConcentrationPct.toFixed(1)}%` : '--'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography level="body-xs" sx={{ color: 'text.secondary', fontWeight: 600 }}>Effective Positions</Typography>
                <Typography level="body-md" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {concentration.effectivePositions ? concentration.effectivePositions.toFixed(1) : '--'}
                </Typography>
              </Box>
            </Box>
          </Sheet>
        </Grid>

        {/* KPI 2: Beta & Correlation Engine */}
        <Grid xs={12} sm={12} md={6} lg={6} xl={4}>
          <Sheet sx={{ ...glassStyle, p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography level="body-xs" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Market Sensitivity & Correlation
                </Typography>
                <Activity size={18} color="#0ea5e9" />
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1 }}>
                <Typography level="h1" sx={{ fontWeight: 800, fontSize: '2.4rem', color: 'text.primary' }}>
                  {correlation.portfolioBeta ? correlation.portfolioBeta.toFixed(2) : '1.00'}
                </Typography>
                <Typography level="body-sm" sx={{ color: 'text.secondary', fontWeight: 500 }}>Portfolio Beta vs. S&P 500</Typography>
              </Box>

              <Typography level="body-xs" sx={{ color: 'text.secondary', mb: 2 }}>
                Calculated across 252 trading days from cached historical closes.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Box>
                <Typography level="body-xs" sx={{ color: 'text.secondary', fontWeight: 600 }}>High-Corr Pairs (r ≥ 0.70)</Typography>
                <Typography level="body-md" sx={{ fontWeight: 700, color: highCorrelationPairs.length > 0 ? 'warning.plainColor' : 'success.plainColor' }}>
                  {highCorrelationPairs.length} pair{highCorrelationPairs.length === 1 ? '' : 's'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography level="body-xs" sx={{ color: 'text.secondary', fontWeight: 600 }}>Stock Denominator</Typography>
                <Typography level="body-md" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {showMoneyValues ? formatCurrency(totalPortfolioUsd, false, '$') : '••••••••'}
                </Typography>
              </Box>
            </Box>
          </Sheet>
        </Grid>

        {/* KPI 3: Risk Governance Caps */}
        <Grid xs={12} sm={12} md={12} lg={12} xl={4}>
          <Sheet sx={{ ...glassStyle, p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography level="body-xs" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Governance Caps & Thresholds
                </Typography>
                <Scale size={18} color="#10b981" />
              </Box>

              <Stack spacing={1.5} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography level="body-sm" sx={{ fontWeight: 600, color: 'text.primary' }}>🎯 Target Weight</Typography>
                  <Chip variant="soft" color="primary" size="sm" sx={{ fontWeight: 700 }}>8.0% ($8,000 / $100k)</Chip>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography level="body-sm" sx={{ fontWeight: 600, color: 'text.primary' }}>🛡️ Max Single-Stock Cap</Typography>
                  <Chip variant="soft" color="warning" size="sm" sx={{ fontWeight: 700 }}>15.0% ($15,000 / $100k)</Chip>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography level="body-sm" sx={{ fontWeight: 600, color: 'text.primary' }}>🧩 Max Strictest Theme Cap</Typography>
                  <Chip variant="soft" color="danger" size="sm" sx={{ fontWeight: 700 }}>30.0% ($30,000 / $100k)</Chip>
                </Box>
              </Stack>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
              <Box>
                <Typography level="body-xs" sx={{ color: 'text.secondary', fontWeight: 600 }}>Active Holdings</Typography>
                <Typography level="body-md" sx={{ fontWeight: 700, color: 'text.primary' }}>{concentration.openHoldingsCount || 0}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography level="body-xs" sx={{ color: 'text.secondary', fontWeight: 600 }}>Breaches / Warnings</Typography>
                <Typography level="body-md" sx={{ fontWeight: 700, color: health.deductions?.length > 0 ? 'warning.plainColor' : 'success.plainColor' }}>
                  {health.deductions?.length || 0} flagged
                </Typography>
              </Box>
            </Box>
          </Sheet>
        </Grid>
      </Grid>

      {/* 2. Position Sizing & Pre-Trade Simulator Card */}
      <Sheet sx={{ ...glassStyle, p: 3, borderRadius: '16px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Calculator size={20} color="#0ea5e9" />
          <Typography level="title-lg" sx={{ fontWeight: 800 }}>
            Position Sizing & Pre-Trade Simulator
          </Typography>
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          {/* Controls */}
          <Grid xs={12} md={3}>
            <Typography level="body-xs" sx={{ mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>Select Holding or Enter Ticker</Typography>
            <Select
              value={selectedSymbol}
              onChange={(_, val) => setSelectedSymbol(val as string)}
              sx={{ borderRadius: '10px' }}
            >
              {holdingsSizing.map((h: any) => (
                <Option key={h.symbol} value={h.symbol}>
                  {h.symbol} — {h.name} ({h.weightPct.toFixed(1)}%)
                </Option>
              ))}
              <Option value="__CUSTOM__">+ Enter Custom / New Ticker...</Option>
            </Select>

            {selectedSymbol === '__CUSTOM__' && (
              <Input
                placeholder="e.g. TSM"
                value={customSymbol}
                onChange={e => setCustomSymbol(e.target.value)}
                sx={{ mt: 1, borderRadius: '10px' }}
              />
            )}
          </Grid>

          <Grid xs={6} md={2}>
            <Typography level="body-xs" sx={{ mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>Trade Type</Typography>
            <Select
              value={orderType}
              onChange={(_, val) => setOrderType(val as 'Buy' | 'Sell')}
              sx={{ borderRadius: '10px' }}
            >
              <Option value="Buy">Buy (Increase)</Option>
              <Option value="Sell">Sell (Reduce)</Option>
            </Select>
          </Grid>

          <Grid xs={6} md={2}>
            <Typography level="body-xs" sx={{ mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>Shares</Typography>
            <Input
              type="number"
              value={orderShares}
              onChange={e => setOrderShares(e.target.value)}
              sx={{ borderRadius: '10px' }}
            />
          </Grid>

          <Grid xs={12} md={2}>
            <Typography level="body-xs" sx={{ mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>Price ($)</Typography>
            <Input
              type="number"
              value={orderPrice}
              onChange={e => setOrderPrice(e.target.value)}
              sx={{ borderRadius: '10px' }}
            />
          </Grid>

          <Grid xs={12} md={3} sx={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button
              variant="solid"
              color="primary"
              onClick={runSimulation}
              loading={simulating}
              sx={{ width: '100%', borderRadius: '10px', fontWeight: 700 }}
            >
              Calculate Sizing Room
            </Button>
          </Grid>
        </Grid>

        {currentSizing && (
          <Grid container spacing={2} sx={{ mt: 1, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            {/* Target Room */}
            <Grid xs={12} sm={6} md={3}>
              <Sheet sx={{ p: 2, borderRadius: '12px', bgcolor: 'background.level1', border: '1px solid', borderColor: 'divider' }}>
                <Typography level="body-xs" sx={{ fontWeight: 700, color: 'text.secondary' }}>🎯 Target Room (8%)</Typography>
                <Typography level="title-md" sx={{ fontWeight: 800, mt: 0.5, color: 'text.primary' }}>
                  {formatCurrency(currentSizing.roomToTargetUsd, false, '$')}
                </Typography>
                <Typography level="body-xs" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {currentSizing.roomToTargetShares} shares max
                </Typography>
              </Sheet>
            </Grid>

            {/* Single Stock Cap Room */}
            <Grid xs={12} sm={6} md={3}>
              <Sheet sx={{ p: 2, borderRadius: '12px', bgcolor: 'background.level1', border: '1px solid', borderColor: 'divider' }}>
                <Typography level="body-xs" sx={{ fontWeight: 700, color: 'text.secondary' }}>🛡️ Stock Cap Room (15%)</Typography>
                <Typography level="title-md" sx={{ fontWeight: 800, mt: 0.5, color: 'text.primary' }}>
                  {formatCurrency(currentSizing.roomToStockCapUsd, false, '$')}
                </Typography>
                <Typography level="body-xs" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {currentSizing.roomToStockCapShares} shares max
                </Typography>
              </Sheet>
            </Grid>

            {/* Strictest Theme Room */}
            <Grid xs={12} sm={6} md={3}>
              <Sheet sx={{ p: 2, borderRadius: '12px', bgcolor: 'background.level1', border: '1px solid', borderColor: 'divider' }}>
                <Typography level="body-xs" sx={{ fontWeight: 700, color: 'text.secondary' }}>🧩 Strictest Theme Cap (30%)</Typography>
                <Typography level="title-md" sx={{ fontWeight: 800, mt: 0.5, color: 'text.primary' }}>
                  {currentSizing.roomToThemeCapUsd !== null ? formatCurrency(currentSizing.roomToThemeCapUsd, false, '$') : 'No Theme Limit'}
                </Typography>
                <Typography level="body-xs" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {currentSizing.strictestTheme ? currentSizing.strictestTheme.themeName : 'Unassigned'}
                </Typography>
              </Sheet>
            </Grid>

            {/* Max Allowed Buy */}
            <Grid xs={12} sm={6} md={3}>
              <Sheet
                variant="solid"
                color="primary"
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: 'primary.600',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
                }}
              >
                <Typography level="body-xs" sx={{ fontWeight: 700, color: 'rgba(255, 255, 255, 0.95)' }}>🚨 Max Allowed Buy</Typography>
                <Typography level="title-md" sx={{ fontWeight: 800, mt: 0.5, color: '#ffffff' }}>
                  {formatCurrency(currentSizing.maxAllowedBuyUsd, false, '$')}
                </Typography>
                <Typography level="body-xs" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                  {currentSizing.maxAllowedBuyShares} shares ({currentSizing.bindingCapReason})
                </Typography>
              </Sheet>
            </Grid>
          </Grid>
        )}

        {/* Trade Impact Simulation Preview */}
        {currentSimulation && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              borderRadius: '12px',
              bgcolor: currentSimulation.causesStockCapBreach ? 'rgba(239, 68, 68, 0.15)' : 'background.level1',
              border: '1px solid',
              borderColor: currentSimulation.causesStockCapBreach ? 'rgba(239, 68, 68, 0.4)' : 'divider',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Typography
                level="body-sm"
                sx={{
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  color: currentSimulation.causesStockCapBreach ? '#fecaca' : 'text.primary',
                }}
              >
                {currentSimulation.causesStockCapBreach ? (
                  <AlertTriangle size={16} color="#ef4444" />
                ) : (
                  <CheckCircle2 size={16} color="#10b981" />
                )}
                Pre-Trade Weight Simulation: {activeSymbol} {currentSimulation.type} {orderShares} shares (${Math.round(currentSimulation.tradeValueUsd).toLocaleString()})
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center">
                <Typography level="body-xs" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  {currentSimulation.currentStockWeightPct.toFixed(1)}%
                </Typography>
                <ArrowRight size={14} color="var(--joy-palette-text-secondary)" />
                <Typography
                  level="body-xs"
                  sx={{
                    fontWeight: 800,
                    color: currentSimulation.causesStockCapBreach ? '#f87171' : 'primary.plainColor',
                  }}
                >
                  {currentSimulation.projectedStockWeightPct.toFixed(1)}% of Stock Portfolio
                </Typography>
              </Stack>
            </Box>

            {currentSimulation.causesStockCapBreach && (
              <Typography level="body-xs" sx={{ mt: 1, fontWeight: 700, color: '#f87171' }}>
                ⚠️ Warning: This trade will breach the 15.0% Single-Stock Cap! Consider sizing down to {currentSizing?.roomToStockCapShares || 0} shares.
              </Typography>
            )}

            {currentSimulation.causesThemeCapBreach && (
              <Typography level="body-xs" sx={{ mt: 0.5, fontWeight: 700, color: '#f87171' }}>
                ⚠️ Warning: This trade causes one or more mapped Themes to exceed the 30.0% Theme Cap!
              </Typography>
            )}
          </Box>
        )}
      </Sheet>

      {/* 3. Theme Exposure Breakdown & High-Correlation Pairs */}
      <Grid container spacing={2}>
        {/* Theme Exposure Breakdown (8 cols) */}
        <Grid xs={12} lg={8} xl={8}>
          <Sheet sx={{ ...glassStyle, p: 3, height: '100%', borderRadius: '16px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PieChart size={20} color="#0ea5e9" />
                <Typography level="title-md" sx={{ fontWeight: 800 }}>
                  Theme & Sector Concentration (30% Cap)
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip variant="soft" color="neutral" size="sm">
                  {themeExposures.length} Themes
                </Chip>
                <Box
                  sx={{
                    display: 'inline-flex',
                    p: 0.5,
                    borderRadius: '8px',
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    gap: 0.5,
                  }}
                >
                  <IconButton
                    size="sm"
                    variant={themeViewMode === 'chart' ? 'solid' : 'plain'}
                    color={themeViewMode === 'chart' ? 'primary' : 'neutral'}
                    onClick={() => setThemeViewMode('chart')}
                    title="Chart View"
                    sx={{ minHeight: '28px', minWidth: '28px', p: 0.5 }}
                  >
                    <PieChart size={15} />
                  </IconButton>
                  <IconButton
                    size="sm"
                    variant={themeViewMode === 'table' ? 'solid' : 'plain'}
                    color={themeViewMode === 'table' ? 'primary' : 'neutral'}
                    onClick={() => setThemeViewMode('table')}
                    title="Table View"
                    sx={{ minHeight: '28px', minWidth: '28px', p: 0.5 }}
                  >
                    <Table2 size={15} />
                  </IconButton>
                </Box>
              </Box>
            </Box>

            {themeViewMode === 'chart' ? (
              <ThemeDonutChart
                themeExposures={themeExposures}
                holdings={holdingsSizing}
                totalPortfolioUsd={totalPortfolioUsd}
                showMoneyValues={showMoneyValues}
              />
            ) : (
              <Sheet sx={{ overflowX: 'auto', borderRadius: '10px' }}>
                <Table borderAxis="xBetween" hoverRow stripe="odd" sx={{ minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th>Theme Name</th>
                      <th>Symbols</th>
                      <th style={{ textAlign: 'right' }}>Market Value</th>
                      <th style={{ textAlign: 'right' }}>Weight %</th>
                      <th style={{ textAlign: 'right' }}>30% Cap Room</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'center', width: 88 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {themeExposures.map((t: any) => {
                      const statusColor = t.status === 'breach' ? 'danger' : t.status === 'warning' ? 'warning' : 'success';
                      const isEditingThisRow = !t.isUnassigned && editingThemeName === t.themeName;
                      return (
                        <tr key={t.themeName}>
                          <td style={{ fontWeight: 700 }}>
                            {isEditingThisRow ? (
                              <Input
                                size="sm"
                                value={editedThemeValue}
                                onChange={(e) => setEditedThemeValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveTheme(t.themeName);
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    handleCancelEditTheme();
                                  }
                                }}
                                disabled={isSavingTheme}
                                autoFocus
                                aria-label={`Edit theme name for ${t.themeName}`}
                                sx={{
                                  minWidth: 160,
                                  fontWeight: 700,
                                  borderRadius: '8px',
                                }}
                              />
                            ) : (
                              t.themeName
                            )}
                          </td>
                          <td>
                            <Typography level="body-xs" sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {(t.symbols || []).join(', ') || '—'}
                            </Typography>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {showMoneyValues ? formatCurrency(t.marketValueUsd, false, '$') : '••••••••'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {t.weightPct.toFixed(1)}%
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {t.isUnassigned ? '--' : (showMoneyValues ? formatCurrency(t.roomToCapUsd, false, '$') : '••••••••')}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <Chip size="sm" variant="soft" color={statusColor} sx={{ fontWeight: 700 }}>
                              {t.isUnassigned ? 'Unassigned' : t.status.toUpperCase()}
                            </Chip>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {!t.isUnassigned && (
                              isEditingThisRow ? (
                                <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                                  <IconButton
                                    size="sm"
                                    variant="soft"
                                    color="success"
                                    loading={isSavingTheme}
                                    disabled={!editedThemeValue.trim()}
                                    title={`Save theme "${t.themeName}"`}
                                    onClick={() => handleSaveTheme(t.themeName)}
                                    sx={{
                                      minHeight: '28px',
                                      minWidth: '28px',
                                      p: 0.5,
                                    }}
                                  >
                                    <Check size={15} />
                                  </IconButton>
                                  <IconButton
                                    size="sm"
                                    variant="plain"
                                    color="neutral"
                                    disabled={isSavingTheme}
                                    title="Cancel editing theme"
                                    onClick={handleCancelEditTheme}
                                    sx={{
                                      minHeight: '28px',
                                      minWidth: '28px',
                                      p: 0.5,
                                    }}
                                  >
                                    <X size={15} />
                                  </IconButton>
                                </Stack>
                              ) : (
                                <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                                  <IconButton
                                    size="sm"
                                    variant="plain"
                                    color="primary"
                                    title={`Edit theme "${t.themeName}"`}
                                    onClick={() => handleStartEditTheme(t.themeName)}
                                    sx={{
                                      minHeight: '28px',
                                      minWidth: '28px',
                                      p: 0.5,
                                      '&:hover': {
                                        bgcolor: 'rgba(14, 165, 233, 0.15)',
                                      },
                                    }}
                                  >
                                    <Pencil size={15} />
                                  </IconButton>
                                  <IconButton
                                    size="sm"
                                    variant="plain"
                                    color="danger"
                                    title={`Delete theme "${t.themeName}"`}
                                    onClick={() => setDeletingThemeName(t.themeName)}
                                    sx={{
                                      minHeight: '28px',
                                      minWidth: '28px',
                                      p: 0.5,
                                      '&:hover': {
                                        bgcolor: 'rgba(239, 68, 68, 0.15)',
                                      },
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </IconButton>
                                </Stack>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Sheet>
            )}
          </Sheet>
        </Grid>

        {/* High-Correlation Watchlist (4 cols) */}
        <Grid xs={12} lg={4} xl={4}>
          <Sheet sx={{ ...glassStyle, p: 3, height: '100%', borderRadius: '16px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Layers size={20} color="#f59e0b" />
                <Typography level="title-md" sx={{ fontWeight: 800 }}>
                  Correlated Stock Pairs (r ≥ 0.70)
                </Typography>
              </Box>
              <Chip variant="soft" color="warning" size="sm">
                252 Trading Days
              </Chip>
            </Box>

            {highCorrelationPairs.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 8px' }} />
                <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                  Excellent diversification! No holding pairs exceed the 0.70 correlation threshold.
                </Typography>
              </Box>
            ) : (
              <Sheet sx={{ overflowX: 'auto', borderRadius: '10px' }}>
                <Table borderAxis="xBetween" hoverRow stripe="odd">
                  <thead>
                    <tr>
                      <th>Pair</th>
                      <th style={{ textAlign: 'right' }}>Pearson r</th>
                      <th style={{ textAlign: 'right' }}>Combined Weight</th>
                      <th style={{ textAlign: 'center' }}>Fragility Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highCorrelationPairs.map((p: any) => (
                      <tr key={`${p.symbolA}-${p.symbolB}`}>
                        <td style={{ fontWeight: 700 }}>
                          {p.symbolA} & {p.symbolB}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'warning.plainColor' }}>
                          {p.correlation.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {p.combinedWeightPct.toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={p.combinedWeightPct > 30 ? 'danger' : 'warning'}
                            sx={{ fontWeight: 700 }}
                          >
                            {p.combinedWeightPct > 30 ? 'High Fragility' : 'Moderate'}
                          </Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Sheet>
            )}
          </Sheet>
        </Grid>
      </Grid>

      {/* 4. Stock Concentration & Sizing Capacity Table */}
      <Sheet sx={{ ...glassStyle, p: 3, borderRadius: '16px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp size={20} color="#0ea5e9" />
            <Typography level="title-lg" sx={{ fontWeight: 800 }}>
              Holdings Risk Concentration & Sizing Capacity
            </Typography>
          </Box>
          <Typography level="body-xs" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Target: 8.0% | Cap: 15.0%
          </Typography>
        </Box>

        <Sheet sx={{ overflowX: 'auto', borderRadius: '10px' }}>
          <Table borderAxis="xBetween" hoverRow stripe="odd" sx={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Themes</th>
                <th style={{ textAlign: 'right' }}>Shares</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Market Value</th>
                <th style={{ textAlign: 'right' }}>Weight %</th>
                <th style={{ textAlign: 'right' }}>Beta vs SPY</th>
                <th style={{ textAlign: 'right' }}>DCF Base MoS</th>
                <th style={{ textAlign: 'right' }}>Room to 8%</th>
                <th style={{ textAlign: 'right' }}>Room to 15%</th>
                <th style={{ textAlign: 'center' }}>Status / Action</th>
              </tr>
            </thead>
            <tbody>
              {holdingsSizing.map((h: any) => {
                const statusColor = h.status === 'breach' ? 'danger' : h.status === 'warning' ? 'warning' : 'success';
                const actionLabel =
                  h.status === 'breach' ? `Trim $${Math.round(h.trimToCapUsd || Math.abs(h.sizing?.roomToStockCapUsd || 0)).toLocaleString()}` :
                  h.sizing?.roomToTargetUsd > 0 ? `Buy Room $${Math.round(h.sizing.roomToTargetUsd).toLocaleString()}` :
                  'Hold (At/Over Target)';

                return (
                  <tr key={h.symbol}>
                    <td>
                      <Typography level="body-sm" sx={{ fontWeight: 800 }}>
                        {h.symbol}
                      </Typography>
                      <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                        {h.name}
                      </Typography>
                    </td>
                    <td>
                      <Typography level="body-xs">
                        {(h.themes || []).join(', ') || 'Unassigned'}
                      </Typography>
                    </td>
                    <td style={{ textAlign: 'right' }}>{h.shares?.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>${h.lastPrice?.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {showMoneyValues ? formatCurrency(h.marketValueUsd, false, '$') : '••••••••'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                      {h.weightPct.toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {h.stockBeta !== undefined ? h.stockBeta.toFixed(2) : '1.00'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: h.dcfBaseMoS >= 15 ? 'success.plainColor' : h.dcfBaseMoS < 0 ? 'danger.plainColor' : 'neutral.plainColor' }}>
                      {h.dcfBaseMoS !== null && h.dcfBaseMoS !== undefined ? `${h.dcfBaseMoS.toFixed(1)}%` : '--'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {showMoneyValues ? formatCurrency(h.sizing?.roomToTargetUsd, false, '$') : '••••••••'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {showMoneyValues ? formatCurrency(h.sizing?.roomToStockCapUsd, false, '$') : '••••••••'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Chip size="sm" variant="soft" color={statusColor} sx={{ fontWeight: 700 }}>
                        {actionLabel}
                      </Chip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Sheet>
      </Sheet>

      {/* 5. AI Risk Officer Advisory Card */}
      <Sheet sx={{ ...glassStyle, p: 3, borderRadius: '16px' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Sparkles size={22} color="#a855f7" />
            <Typography level="title-lg" sx={{ fontWeight: 800 }}>
              AI Risk Officer Advisory (Howard Marks Framework)
            </Typography>
          </Box>
          {latestAdvisory?.created_at && (
            <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
              Source: {latestAdvisory.source === 'workers_ai' ? 'Cloudflare Workers AI' : 'Gemini App via MCP'} • {new Date(latestAdvisory.created_at).toLocaleString()}
            </Typography>
          )}
        </Box>

        {latestAdvisory ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'background.level1', border: '1px solid', borderColor: 'divider' }}>
              <Typography level="body-xs" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 0.5 }}>
                Executive Summary
              </Typography>
              <Typography level="body-sm" sx={{ lineHeight: 1.6, fontWeight: 500, color: 'text.primary' }}>
                {latestAdvisory.executive_summary}
              </Typography>
            </Box>

            <Grid container spacing={2}>
              <Grid xs={12} md={6}>
                <Sheet variant="soft" color="warning" sx={{ p: 2, borderRadius: '12px', height: '100%' }}>
                  <Typography level="title-sm" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AlertTriangle size={16} /> Key Warnings
                  </Typography>
                  <Stack spacing={0.75}>
                    {latestAdvisory.key_warnings && latestAdvisory.key_warnings.length > 0 ? (
                      latestAdvisory.key_warnings.map((w: string, idx: number) => (
                        <Typography key={idx} level="body-xs" sx={{ fontWeight: 600 }}>
                          • {w}
                        </Typography>
                      ))
                    ) : (
                      <Typography level="body-xs">No active risk warnings flagged.</Typography>
                    )}
                  </Stack>
                </Sheet>
              </Grid>

              <Grid xs={12} md={6}>
                <Sheet variant="soft" color="primary" sx={{ p: 2, borderRadius: '12px', height: '100%' }}>
                  <Typography level="title-sm" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Scale size={16} /> Recommended Rebalancing Actions
                  </Typography>
                  <Stack spacing={0.75}>
                    {latestAdvisory.rebalancing_actions && latestAdvisory.rebalancing_actions.length > 0 ? (
                      latestAdvisory.rebalancing_actions.map((a: string, idx: number) => (
                        <Typography key={idx} level="body-xs" sx={{ fontWeight: 600 }}>
                          ✓ {a}
                        </Typography>
                      ))
                    ) : (
                      <Typography level="body-xs">Portfolio is aligned with risk caps.</Typography>
                    )}
                  </Stack>
                </Sheet>
              </Grid>
            </Grid>
          </Box>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography level="body-sm" sx={{ mb: 1.5, color: 'text.secondary' }}>
              No Risk Officer Advisory generated yet.
            </Typography>
            <Button
              variant="solid"
              color="primary"
              size="sm"
              loading={runningAi}
              startDecorator={<Sparkles size={16} />}
              onClick={handleRunAiAudit}
              sx={{ borderRadius: '10px' }}
            >
              Generate First AI Risk Audit
            </Button>
          </Box>
        )}
      </Sheet>

      {/* Delete Theme Confirmation Modal */}
      <Modal
        open={Boolean(deletingThemeName)}
        disablePortal
        onClose={() => !isDeletingTheme && setDeletingThemeName(null)}
      >
        <ModalDialog
          role="alertdialog"
          variant="outlined"
          sx={{
            ...glassStyle,
            maxWidth: 440,
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertTriangle color="#ef4444" size={20} />
            Delete Theme
          </DialogTitle>
          <Divider />
          <DialogContent>
            <Typography level="body-md">
              Are you sure you want to delete the theme <strong>&ldquo;{deletingThemeName}&rdquo;</strong>?
            </Typography>
            <Typography level="body-sm" sx={{ color: 'text.secondary', mt: 1 }}>
              This will remove the theme and unmap any associated stocks. Holdings will become &ldquo;Unassigned&rdquo; if not in other themes. This action cannot be undone.
            </Typography>
          </DialogContent>
          <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button
              variant="plain"
              color="neutral"
              disabled={isDeletingTheme}
              onClick={() => setDeletingThemeName(null)}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="danger"
              startDecorator={<Trash2 size={16} />}
              loading={isDeletingTheme}
              onClick={handleDeleteTheme}
            >
              Delete Theme
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>
    </Box>
  );
}
