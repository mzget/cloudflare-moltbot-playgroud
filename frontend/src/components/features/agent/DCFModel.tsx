import * as React from 'react';
import {
  Box, Sheet, Typography, Stack, Slider, Input, Divider, Table,
  FormLabel, FormControl, Tooltip, Button, Chip, Tabs, TabList, Tab, Grid
} from '@mui/joy';
import { Calculator, Info } from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';

// ─── DCF Calculator Core ──────────────────────────────────────────────────

interface DCFParams {
  baseYear: number;
  baseRev: number;          // $B
  baseEbit: number;         // $B
  taxRate: number;          // percentage (e.g. 20)
  wacc: number;             // percentage (e.g. 9)
  terminalGrowth: number;   // percentage (e.g. 3.5)
  netCash: number;          // $B
  sharesOutstanding: number;// Millions (e.g. 7410)

  mode: 'uniform' | 'detailed';

  // Uniform Mode
  revGrowth: number;        // percentage
  opMargin: number;         // percentage
  fcfConversion: number;    // percentage

  // Detailed Mode (5-year arrays)
  yearlyGrowth: number[];   // percentages [16, 15, 14, 13, 12]
  yearlyOpMargin: number[]; // percentages [46.2, 46.5, 46.8, 47.0, 47.2]
  yearlyFcfConv: number[];  // percentages [68, 72, 75, 78, 80]

  // Exit Multiple Valuation
  exitMultiple: number;     // e.g. 24.0
  targetShares: number;     // Millions (e.g. 7200)
  currentPrice: number | null;
}

interface BaseYearData {
  yearLabel: string;
  revenue: number;
  ebit: number;
  opMargin: number;
  nopat: number;
}

interface YearlyData {
  year: number;
  yearLabel: string;
  growth: number;        // %
  revenue: number;       // $B
  opMargin: number;      // %
  ebit: number;          // $B
  nopat: number;         // $B
  fcfConv: number;       // %
  fcf: number;           // $B
  discountFactor: number;
  pvOfFcf: number;       // $B
}

interface DCFResult {
  baseYearData: BaseYearData;
  yearlyData: YearlyData[];
  sumPvFcf: number;
  terminalValue: number;
  pvOfTerminalValue: number;
  enterpriseValue: number;
  netCash: number;
  equityValue: number;
  impliedSharePrice: number;
  
  // 5-Year Target Price / Future Exit Multiple Valuation
  targetMarketCapYr5: number;
  targetSharePriceYr5: number;
  cagrYr5: number | null;
  revenueCAGR: number;
  avgOpMargin: number;
}

function calculateDCF(params: DCFParams): DCFResult {
  const taxDecimal = params.taxRate / 100;
  const waccDecimal = params.wacc / 100;
  const termGrowthDecimal = params.terminalGrowth / 100;

  const baseOpMargin = params.baseRev > 0 ? (params.baseEbit / params.baseRev) * 100 : 0;
  const baseNopat = params.baseEbit * (1 - taxDecimal);

  const baseYearData: BaseYearData = {
    yearLabel: `FY${params.baseYear} (A)`,
    revenue: params.baseRev,
    ebit: params.baseEbit,
    opMargin: baseOpMargin,
    nopat: baseNopat,
  };

  const yearlyData: YearlyData[] = [];
  let currentRev = params.baseRev;
  let sumPvFcf = 0;

  for (let i = 0; i < 5; i++) {
    const year = params.baseYear + 1 + i;
    const yearLabel = `FY${year} (E)`;

    const growth = params.mode === 'detailed' 
      ? (params.yearlyGrowth[i] ?? 14) 
      : params.revGrowth;
    
    const opMargin = params.mode === 'detailed'
      ? (params.yearlyOpMargin[i] ?? 46.8)
      : params.opMargin;

    const fcfConv = params.mode === 'detailed'
      ? (params.yearlyFcfConv[i] ?? 75)
      : params.fcfConversion;

    currentRev = currentRev * (1 + growth / 100);
    const ebit = currentRev * (opMargin / 100);
    const nopat = ebit * (1 - taxDecimal);
    const fcf = nopat * (fcfConv / 100);

    const discountFactor = 1 / Math.pow(1 + waccDecimal, i + 1);
    const pvOfFcf = fcf * discountFactor;
    sumPvFcf += pvOfFcf;

    yearlyData.push({
      year,
      yearLabel,
      growth,
      revenue: currentRev,
      opMargin,
      ebit,
      nopat,
      fcfConv,
      fcf,
      discountFactor,
      pvOfFcf,
    });
  }

  const lastFcf = yearlyData[4].fcf;
  const terminalValue =
    (lastFcf * (1 + termGrowthDecimal)) / Math.max(0.001, (waccDecimal - termGrowthDecimal));
  const pvOfTerminalValue = terminalValue / Math.pow(1 + waccDecimal, 5);
  const enterpriseValue = sumPvFcf + pvOfTerminalValue;
  const equityValue = enterpriseValue + params.netCash;

  // Implied Share Price from Gordon Growth (Present Intrinsic Value)
  const sharesInBillions = params.sharesOutstanding > 100 ? params.sharesOutstanding / 1000 : params.sharesOutstanding;
  const impliedSharePrice = sharesInBillions > 0 ? equityValue / sharesInBillions : 0;

  // 5-Year Target Price via Exit Multiple Valuation (FY2031 Market Cap & Share Price)
  const targetMarketCapYr5 = lastFcf * params.exitMultiple;
  const targetSharesInBillions = params.targetShares > 100 ? params.targetShares / 1000 : params.targetShares;
  const targetSharePriceYr5 = targetSharesInBillions > 0 ? targetMarketCapYr5 / targetSharesInBillions : 0;

  let cagrYr5: number | null = null;
  if (params.currentPrice && params.currentPrice > 0 && targetSharePriceYr5 > 0) {
    cagrYr5 = (Math.pow(targetSharePriceYr5 / params.currentPrice, 1 / 5) - 1) * 100;
  }

  // Calculate Revenue CAGR across the 5 years
  const revenueCAGR = params.baseRev > 0
    ? (Math.pow(yearlyData[4].revenue / params.baseRev, 1 / 5) - 1) * 100
    : 0;

  const avgOpMargin = yearlyData.reduce((acc, d) => acc + d.opMargin, 0) / 5;

  return {
    baseYearData,
    yearlyData,
    sumPvFcf,
    terminalValue,
    pvOfTerminalValue,
    enterpriseValue,
    netCash: params.netCash,
    equityValue,
    impliedSharePrice,
    targetMarketCapYr5,
    targetSharePriceYr5,
    cagrYr5,
    revenueCAGR,
    avgOpMargin,
  };
}

// ─── SVG Chart Component ────────────────────────────────────────────────────

function DCFChart({ data }: { data: YearlyData[] }) {
  const width = 560;
  const height = 200;
  const padL = 50;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxRev = Math.max(...data.map((d) => d.revenue), 0.01);
  const maxFcf = Math.max(...data.map((d) => d.fcf), 0.01);
  const maxVal = Math.max(maxRev, maxFcf) * 1.15;

  const barW = (chartW / data.length) * 0.45;
  const gap = chartW / data.length;

  const linePoints = data.map((d, i) => {
    const x = padL + i * gap + gap / 2;
    const y = padT + chartH - (d.fcf / maxVal) * chartH;
    return `${x},${y}`;
  });
  const linePath = `M${linePoints.join(' L')}`;

  const firstX = padL + gap / 2;
  const lastX = padL + (data.length - 1) * gap + gap / 2;
  const baseY = padT + chartH;
  const areaPath = `M${firstX},${baseY} L${linePoints.join(' L')} L${lastX},${baseY} Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    val: maxVal * frac,
    y: padT + chartH - frac * chartH,
  }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={padL}
            y1={t.y}
            x2={padL + chartW}
            y2={t.y}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="4 4"
          />
          <text
            x={padL - 8}
            y={t.y + 4}
            textAnchor="end"
            fill="rgba(255,255,255,0.4)"
            fontSize="9"
            fontFamily="monospace"
          >
            ${t.val.toFixed(0)}B
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const x = padL + i * gap + (gap - barW) / 2;
        const barH = (d.revenue / maxVal) * chartH;
        const y = padT + chartH - barH;
        return (
          <g key={`bar-${i}`}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={4}
              fill="rgba(59, 130, 246, 0.45)"
              stroke="rgba(59, 130, 246, 0.7)"
              strokeWidth={1}
            />
            <text
              x={padL + i * gap + gap / 2}
              y={padT + chartH + 16}
              textAnchor="middle"
              fill="rgba(255,255,255,0.6)"
              fontSize="10"
              fontWeight="600"
              fontFamily="inherit"
            >
              FY{d.year}
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill="rgba(16, 185, 129, 0.12)" />
      <path d={linePath} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = padL + i * gap + gap / 2;
        const y = padT + chartH - (d.fcf / maxVal) * chartH;
        return (
          <circle key={`dot-${i}`} cx={x} cy={y} r={4} fill="#10b981" stroke="#0d9668" strokeWidth={1.5} />
        );
      })}

      <rect x={padL} y={2} width={10} height={10} rx={2} fill="rgba(59, 130, 246, 0.5)" />
      <text x={padL + 14} y={11} fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="inherit">
        Revenue ($B)
      </text>
      <circle cx={padL + 105} cy={7} r={4} fill="#10b981" />
      <text x={padL + 113} y={11} fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="inherit">
        Free Cash Flow ($B)
      </text>
    </svg>
  );
}

// ─── Slider Row Component ───────────────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  tooltip,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  tooltip?: string;
}) {
  return (
    <FormControl sx={{ mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <FormLabel sx={{ m: 0, fontSize: '0.8rem', fontWeight: 600 }}>{label}</FormLabel>
          {tooltip && (
            <Tooltip title={tooltip} placement="top" arrow>
              <Box component="span" sx={{ display: 'inline-flex', cursor: 'help' }}>
                <Info size={12} style={{ opacity: 0.4 }} />
              </Box>
            </Tooltip>
          )}
        </Stack>
        <Typography
          level="body-xs"
          sx={{
            color: 'primary.400',
            fontWeight: 700,
            fontFamily: 'monospace',
            minWidth: '55px',
            textAlign: 'right',
          }}
        >
          {format(value)}
        </Typography>
      </Stack>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(_, v) => onChange(v as number)}
        sx={{
          '--Slider-trackSize': '4px',
          '--Slider-thumbSize': '14px',
          color: 'primary.500',
        }}
      />
    </FormControl>
  );
}

// ─── Main DCF Model Component ───────────────────────────────────────────────

interface DCFModelProps {
  symbol: string;
}

export default function DCFModel({ symbol }: DCFModelProps) {
  const [mode, setMode] = React.useState<'uniform' | 'detailed'>('detailed');
  
  // Base year & financial parameters (FY2026 Base Year, FY2027-FY2031 Forecast)
  const [baseYear, setBaseYear] = React.useState(2026);
  const [baseRev, setBaseRev] = React.useState(0);
  const [baseEbit, setBaseEbit] = React.useState(0);
  const [taxRate, setTaxRate] = React.useState(0);
  const [wacc, setWacc] = React.useState(0);
  const [terminalGrowth, setTerminalGrowth] = React.useState(0);
  const [netCash, setNetCash] = React.useState(0);
  const [sharesOutstanding, setSharesOutstanding] = React.useState(0);

  // Uniform Mode parameters
  const [revGrowth, setRevGrowth] = React.useState(0);
  const [opMargin, setOpMargin] = React.useState(0);
  const [fcfConversion, setFcfConversion] = React.useState(0);

  // Detailed Mode parameters (5-year arrays)
  const [yearlyGrowth, setYearlyGrowth] = React.useState<number[]>([0, 0, 0, 0, 0]);
  const [yearlyOpMargin, setYearlyOpMargin] = React.useState<number[]>([0, 0, 0, 0, 0]);
  const [yearlyFcfConv, setYearlyFcfConv] = React.useState<number[]>([0, 0, 0, 0, 0]);

  // Exit Multiple Valuation
  const [exitMultiple, setExitMultiple] = React.useState(0);
  const [targetShares, setTargetShares] = React.useState(0);

  const [currentPrice, setCurrentPrice] = React.useState<number | null>(null);
  const [loadingDefaults, setLoadingDefaults] = React.useState(false);
  const [history, setHistory] = React.useState<any[]>([]);
  const [scenarioName, setScenarioName] = React.useState('ยังไม่มีการประเมินมูลค่า');
  const [activePreset, setActivePreset] = React.useState<'base' | 'bear' | 'bull' | 'custom' | null>(null);
  const [hasSavedValuation, setHasSavedValuation] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const fetchHistory = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/dcf-history?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json() as any[];
        setHistory(data);
        return data;
      }
    } catch (e) {
      console.error('Failed to fetch DCF history:', e);
    }
    return [];
  }, [symbol]);

  // Load saved historical models or reset to unvalued 0 state
  React.useEffect(() => {
    let cancelled = false;
    const initData = async () => {
      setLoadingDefaults(true);
      try {
        const historyData = await fetchHistory();
        if (cancelled) return;

        const resDefaults = await fetch(`${API_BASE_URL}/api/analysis/dcf-defaults?symbol=${symbol}`);
        if (resDefaults.ok) {
          const d = await resDefaults.json() as any;
          if (!cancelled && d.price != null) {
            setCurrentPrice(d.price);
          }
        }

        // If saved DCF calculation exists in database, auto-populate from the latest run
        if (historyData && historyData.length > 0) {
          const latest = historyData[0];
          setHasSavedValuation(true);
          setScenarioName(latest.scenario_name || 'Saved Valuation');
          setBaseRev(latest.base_revenue || 0);
          setRevGrowth(latest.revenue_growth || 0);
          setTaxRate(latest.tax_rate || 16.0);
          setFcfConversion(latest.fcf_conversion || 75.0);
          setWacc(latest.wacc || 9.5);
          setTerminalGrowth(latest.terminal_growth || 2.5);
          setSharesOutstanding(latest.shares_outstanding || 0);
          setTargetShares(latest.target_shares || latest.shares_outstanding || 0);
          setNetCash(latest.net_cash ?? 0);
          setExitMultiple(latest.exit_multiple ?? 20.0);

          const gm = latest.base_gross_margin || 0;
          const opex = latest.opex_margin || 0;
          const imp = latest.gross_margin_improvement || 0;
          const baseOp = gm > 0 ? (gm - opex) : 43.0;

          setBaseEbit(latest.base_revenue ? latest.base_revenue * (baseOp / 100) : 0);
          setOpMargin(baseOp);
          setYearlyGrowth([
            latest.revenue_growth || 0,
            latest.revenue_growth || 0,
            latest.revenue_growth || 0,
            latest.revenue_growth || 0,
            latest.revenue_growth || 0,
          ]);
          setYearlyOpMargin([
            baseOp + imp,
            baseOp + imp * 2,
            baseOp + imp * 3,
            baseOp + imp * 4,
            baseOp + imp * 5,
          ]);
          setYearlyFcfConv([
            latest.fcf_conversion || 75,
            latest.fcf_conversion || 75,
            latest.fcf_conversion || 75,
            latest.fcf_conversion || 75,
            latest.fcf_conversion || 75,
          ]);
          setActivePreset('base');
        } else {
          // No saved valuation: leave as unvalued (0 / empty)
          setHasSavedValuation(false);
          setScenarioName('ยังไม่มีการประเมินมูลค่า');
          setBaseRev(0);
          setBaseEbit(0);
          setTaxRate(0);
          setWacc(0);
          setTerminalGrowth(0);
          setNetCash(0);
          setSharesOutstanding(0);
          setRevGrowth(0);
          setOpMargin(0);
          setFcfConversion(0);
          setYearlyGrowth([0, 0, 0, 0, 0]);
          setYearlyOpMargin([0, 0, 0, 0, 0]);
          setYearlyFcfConv([0, 0, 0, 0, 0]);
          setExitMultiple(0);
          setTargetShares(0);
          setActivePreset(null);
        }
      } catch (e) {
        console.error('Failed to initialize DCF data:', e);
      } finally {
        if (!cancelled) setLoadingDefaults(false);
      }
    };

    initData();
    return () => { cancelled = true; };
  }, [symbol, fetchHistory]);

  // Load actual market stats if user wants baseline data for an unvalued stock
  const handleLoadMarketDefaults = async () => {
    setLoadingDefaults(true);
    try {
      const resDefaults = await fetch(`${API_BASE_URL}/api/analysis/dcf-defaults?symbol=${symbol}`);
      if (resDefaults.ok) {
        const d = await resDefaults.json() as any;
        if (d.baseRevenue) setBaseRev(d.baseRevenue);
        if (d.revenueGrowth) {
          setRevGrowth(d.revenueGrowth);
          setYearlyGrowth([d.revenueGrowth, d.revenueGrowth, d.revenueGrowth, d.revenueGrowth, d.revenueGrowth]);
        }
        if (d.operatingMargin) {
          setOpMargin(d.operatingMargin);
          setBaseEbit(d.baseRevenue ? d.baseRevenue * (d.operatingMargin / 100) : 0);
          setYearlyOpMargin([d.operatingMargin, d.operatingMargin, d.operatingMargin, d.operatingMargin, d.operatingMargin]);
        }
        if (d.fcfMargin) {
          setFcfConversion(d.fcfMargin);
          setYearlyFcfConv([d.fcfMargin, d.fcfMargin, d.fcfMargin, d.fcfMargin, d.fcfMargin]);
        }
        if (d.sharesOutstanding) {
          setSharesOutstanding(d.sharesOutstanding);
          setTargetShares(d.sharesOutstanding);
        }
        if (d.netDebt) setNetCash(-d.netDebt / 1e9);
        setTaxRate(20.0);
        setWacc(9.0);
        setTerminalGrowth(2.5);
        setExitMultiple(20.0);
        setScenarioName('Market Stats Baseline');
      }
    } catch (e) {
      console.error('Failed to load market defaults:', e);
    } finally {
      setLoadingDefaults(false);
    }
  };

  // Scenario Presets
  const applyPreset = (preset: 'base' | 'bear' | 'bull') => {
    setActivePreset(preset);
    setMode('detailed');
    if (preset === 'base') {
      setScenarioName('Base Case Scenario');
      if (baseRev === 0) handleLoadMarketDefaults();
    } else if (preset === 'bear') {
      setScenarioName('Bear Case Scenario');
      setYearlyGrowth(yearlyGrowth.map(g => Math.max(0, g * 0.7)));
    } else if (preset === 'bull') {
      setScenarioName('Bull Case Scenario');
      setYearlyGrowth(yearlyGrowth.map(g => g * 1.3));
    }
  };

  const handleYearlyChange = (index: number, field: 'growth' | 'opMargin' | 'fcfConv', value: number) => {
    setActivePreset('custom');
    if (field === 'growth') {
      const next = [...yearlyGrowth];
      next[index] = value;
      setYearlyGrowth(next);
    } else if (field === 'opMargin') {
      const next = [...yearlyOpMargin];
      next[index] = value;
      setYearlyOpMargin(next);
    } else if (field === 'fcfConv') {
      const next = [...yearlyFcfConv];
      next[index] = value;
      setYearlyFcfConv(next);
    }
  };

  const result = React.useMemo<DCFResult>(
    () =>
      calculateDCF({
        baseYear,
        baseRev,
        baseEbit,
        taxRate,
        wacc,
        terminalGrowth,
        netCash,
        sharesOutstanding,
        mode,
        revGrowth,
        opMargin,
        fcfConversion,
        yearlyGrowth,
        yearlyOpMargin,
        yearlyFcfConv,
        exitMultiple,
        targetShares,
        currentPrice,
      }),
    [
      baseYear, baseRev, baseEbit, taxRate, wacc, terminalGrowth, netCash, sharesOutstanding,
      mode, revGrowth, opMargin, fcfConversion, yearlyGrowth, yearlyOpMargin, yearlyFcfConv,
      exitMultiple, targetShares, currentPrice
    ]
  );

  const fmt = (v: number) => '$' + v.toFixed(1);
  const fmtFull = (v: number) => '$' + v.toFixed(2);
  const fmtPct = (v: number) => v.toFixed(1) + '%';

  const upsideIntrinsic = currentPrice && currentPrice > 0
    ? ((result.impliedSharePrice - currentPrice) / currentPrice) * 100
    : null;

  const handleSaveScenario = async () => {
    setIsSaving(true);
    try {
      const baseOp = baseRev > 0 ? (baseEbit / baseRev) * 100 : opMargin;
      const gmImp = mode === 'detailed' && yearlyOpMargin.length >= 2 
        ? Math.max(0, yearlyOpMargin[1] - yearlyOpMargin[0]) 
        : 0;

      const res = await fetch(`${API_BASE_URL}/api/analysis/dcf-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          scenarioName,
          baseRevenue: baseRev,
          revenueGrowth: mode === 'detailed' ? (yearlyGrowth[0] ?? revGrowth) : revGrowth,
          baseGrossMargin: baseOp,
          grossMarginImprovement: gmImp,
          opexMargin: 0,
          taxRate,
          fcfConversion: mode === 'uniform' ? fcfConversion : yearlyFcfConv[0],
          wacc,
          terminalGrowth,
          sharesOutstanding,
          netCash,
          exitMultiple,
          targetShares,
          impliedSharePrice: result.impliedSharePrice,
        }),
      });

      if (res.ok) {
        await fetchHistory();
      }
    } catch (e) {
      console.error('Error saving scenario:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet sx={{ ...glassStyle, p: 0, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(16, 185, 129, 0.12) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563eb 0%, #10b981 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              }}
            >
              <Calculator size={22} color="#fff" />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography level="h3" sx={{ fontWeight: 800, fontSize: '1.3rem' }}>
                  Interactive DCF Valuation Model
                </Typography>
                <Chip size="sm" color="primary" variant="soft" sx={{ fontWeight: 700 }}>
                  {symbol}
                </Chip>
              </Stack>
              <Typography level="body-xs" sx={{ opacity: 0.6 }}>
                5-Year Discounted Cash Flow & Exit Multiple Projection (FY{baseYear+1}–FY{baseYear+5})
              </Typography>
            </Box>
          </Stack>

          {/* Quick Scenario Preset Switcher */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography level="body-xs" sx={{ opacity: 0.5, display: { xs: 'none', md: 'block' } }}>
              Preset Scenarios:
            </Typography>
            <Button
              size="sm"
              variant={activePreset === 'bear' ? 'solid' : 'outlined'}
              color="danger"
              onClick={() => applyPreset('bear')}
              sx={{ borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}
            >
              Bear Case
            </Button>
            <Button
              size="sm"
              variant={activePreset === 'base' ? 'solid' : 'outlined'}
              color="primary"
              onClick={() => applyPreset('base')}
              sx={{ borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}
            >
              Base Case
            </Button>
            <Button
              size="sm"
              variant={activePreset === 'bull' ? 'solid' : 'outlined'}
              color="success"
              onClick={() => applyPreset('bull')}
              sx={{ borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700 }}
            >
              Bull Case
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Main Container */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '380px 1fr' },
          minHeight: '600px',
        }}
      >
        {/* Left Control Panel */}
        <Box
          sx={{
            p: 3,
            borderRight: { lg: '1px solid rgba(255,255,255,0.06)' },
            borderBottom: { xs: '1px solid rgba(255,255,255,0.06)', lg: 'none' },
            overflowY: 'auto',
            maxHeight: { lg: '850px' },
          }}
        >
          {/* Mode Selector */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography
              level="title-sm"
              sx={{ fontWeight: 700, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}
            >
              Model Configuration Mode
            </Typography>
          </Stack>

          <Tabs
            value={mode}
            onChange={(_, val) => setMode(val as 'uniform' | 'detailed')}
            sx={{ mb: 3, borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}
          >
            <TabList size="sm" disableUnderline sx={{ width: '100%', p: 0.5, gap: 0.5 }}>
              <Tab value="detailed" sx={{ flex: 1, borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                Detailed (Per-Year)
              </Tab>
              <Tab value="uniform" sx={{ flex: 1, borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                Quick (Uniform)
              </Tab>
            </TabList>
          </Tabs>

          {/* Base Year & Key Parameters */}
          <Typography
            level="title-sm"
            sx={{ fontWeight: 700, mb: 1.5, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}
          >
            Base Financials (FY{baseYear})
          </Typography>

          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid xs={6}>
              <FormControl size="sm">
                <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Base Rev ($B)</FormLabel>
                <Input
                  type="number"
                  value={baseRev}
                  onChange={(e) => setBaseRev(parseFloat(e.target.value) || 0)}
                  slotProps={{ input: { step: 0.1, min: 0 } }}
                  sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                />
              </FormControl>
            </Grid>
            <Grid xs={6}>
              <FormControl size="sm">
                <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Base EBIT ($B)</FormLabel>
                <Input
                  type="number"
                  value={baseEbit}
                  onChange={(e) => setBaseEbit(parseFloat(e.target.value) || 0)}
                  slotProps={{ input: { step: 0.1, min: 0 } }}
                  sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                />
              </FormControl>
            </Grid>
          </Grid>

          {/* Uniform Mode Sliders */}
          {mode === 'uniform' && (
            <Box sx={{ p: 2, borderRadius: '12px', background: 'rgba(255,255,255,0.02)', mb: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
              <SliderRow label="Revenue Growth %" value={revGrowth} min={2} max={40} step={0.5} format={fmtPct} onChange={setRevGrowth} tooltip="Average annual revenue growth" />
              <SliderRow label="Operating Margin %" value={opMargin} min={10} max={60} step={0.5} format={fmtPct} onChange={setOpMargin} tooltip="Operating income margin" />
              <SliderRow label="FCF Conversion %" value={fcfConversion} min={30} max={100} step={1} format={fmtPct} onChange={setFcfConversion} tooltip="FCF as % of NOPAT" />
            </Box>
          )}

          {/* Discounting & Capital Parameters */}
          <Typography
            level="title-sm"
            sx={{ fontWeight: 700, mb: 1.5, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}
          >
            Valuation & Capital Structure
          </Typography>

          <SliderRow label="Discount Rate (WACC) %" value={wacc} min={5} max={16} step={0.5} format={fmtPct} onChange={setWacc} tooltip="Weighted Average Cost of Capital" />
          <SliderRow label="Terminal Growth (g) %" value={terminalGrowth} min={1} max={5} step={0.1} format={fmtPct} onChange={setTerminalGrowth} tooltip="Long-term growth rate for Terminal Value" />

          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid xs={6}>
              <FormControl size="sm">
                <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Net Cash/Debt ($B)</FormLabel>
                <Input
                  type="number"
                  value={netCash}
                  onChange={(e) => setNetCash(parseFloat(e.target.value) || 0)}
                  slotProps={{ input: { step: 0.1 } }}
                  sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                />
              </FormControl>
            </Grid>
            <Grid xs={6}>
              <FormControl size="sm">
                <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Shares (M)</FormLabel>
                <Input
                  type="number"
                  value={sharesOutstanding}
                  onChange={(e) => setSharesOutstanding(parseFloat(e.target.value) || 1)}
                  slotProps={{ input: { step: 10, min: 1 } }}
                  sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                />
              </FormControl>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2, opacity: 0.1 }} />

          {/* Exit Multiple Parameters */}
          <Typography
            level="title-sm"
            sx={{ fontWeight: 700, mb: 1.5, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}
          >
            5-Year Exit Multiple Valuation
          </Typography>

          <SliderRow label="Exit FCF Multiple" value={exitMultiple} min={10} max={40} step={0.5} format={(v) => v.toFixed(1) + 'x'} onChange={setExitMultiple} tooltip="Expected valuation multiple on FY31 FCF" />

          <FormControl size="sm" sx={{ mb: 2 }}>
            <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Target Shares in FY31 (M)</FormLabel>
            <Input
              type="number"
              value={targetShares}
              onChange={(e) => setTargetShares(parseFloat(e.target.value) || 1)}
              slotProps={{ input: { step: 10, min: 1 } }}
              sx={{ fontFamily: 'monospace', fontWeight: 600 }}
            />
          </FormControl>

          <Divider sx={{ my: 2, opacity: 0.1 }} />

          {/* Save Scenario */}
          <Typography
            level="title-sm"
            sx={{ fontWeight: 700, mb: 1.5, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}
          >
            Save Scenario
          </Typography>

          <Stack spacing={1.5}>
            <FormControl>
              <Input
                size="sm"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="Scenario name..."
                sx={{ background: 'rgba(255,255,255,0.03)' }}
              />
            </FormControl>
            <Button
              size="sm"
              color="primary"
              variant="solid"
              onClick={handleSaveScenario}
              loading={isSaving}
              sx={{ fontWeight: 700 }}
            >
              Save Scenario
            </Button>
          </Stack>
        </Box>

        {/* Right Output Panel */}
        <Box sx={{ p: 3 }}>
          {!hasSavedValuation && baseRev === 0 && (
            <Sheet
              sx={{
                p: 2.5,
                mb: 3,
                borderRadius: '16px',
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Info size={22} color="#eab308" />
                  <Box>
                    <Typography level="title-sm" sx={{ fontWeight: 700, color: '#eab308' }}>
                      ยังไม่มีการประเมินมูลค่าสำหรับ {symbol} (Unvalued)
                    </Typography>
                    <Typography level="body-xs" sx={{ opacity: 0.8 }}>
                      หุ้นนี้ยังไม่มีประวัติการประเมินมูลค่า DCF กรุณากรอกตัวเลขสมมติฐานทางด้านซ้าย หรือดึงสถิติตลาดเริ่มต้นเพื่อประเมิน
                    </Typography>
                  </Box>
                </Stack>
                <Button
                  size="sm"
                  color="warning"
                  variant="soft"
                  onClick={handleLoadMarketDefaults}
                  loading={loadingDefaults}
                  sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  ดึงสถิติตลาดเริ่มต้น
                </Button>
              </Stack>
            </Sheet>
          )}
          {/* Key Output Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 2,
              mb: 3,
            }}
          >
            {/* Intrinsic Present Value Card */}
            <Sheet
              sx={{
                p: 2.5,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(37, 99, 235, 0.05) 100%)',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              <Typography level="body-xs" sx={{ fontWeight: 700, color: 'primary.300', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                Intrinsic Value Today
              </Typography>
              <Typography
                level="h2"
                sx={{
                  fontWeight: 900,
                  fontSize: '1.9rem',
                  fontFamily: 'monospace',
                  background: 'linear-gradient(135deg, #60a5fa 0%, #34d399 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {fmtFull(result.impliedSharePrice)}
              </Typography>

              {upsideIntrinsic !== null && (
                <Chip
                  size="sm"
                  color={upsideIntrinsic >= 0 ? 'success' : 'danger'}
                  variant="soft"
                  sx={{ mt: 1, fontWeight: 700, fontSize: '0.7rem' }}
                >
                  {upsideIntrinsic >= 0 ? '▲' : '▼'} {Math.abs(upsideIntrinsic).toFixed(1)}% vs ${currentPrice?.toFixed(2)}
                </Chip>
              )}
              <Typography level="body-xs" sx={{ opacity: 0.4, mt: 0.5, fontSize: '0.65rem' }}>
                Gordon Growth @ {fmtPct(wacc)} WACC
              </Typography>
            </Sheet>

            {/* 5-Year Target Price Card */}
            <Sheet
              sx={{
                p: 2.5,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                textAlign: 'center',
              }}
            >
              <Typography level="body-xs" sx={{ fontWeight: 700, color: 'success.300', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                Target Price FY{baseYear+5}
              </Typography>
              <Typography
                level="h2"
                sx={{
                  fontWeight: 900,
                  fontSize: '1.9rem',
                  fontFamily: 'monospace',
                  color: '#10b981',
                }}
              >
                {fmtFull(result.targetSharePriceYr5)}
              </Typography>

              {result.cagrYr5 !== null && (
                <Chip
                  size="sm"
                  color="success"
                  variant="soft"
                  sx={{ mt: 1, fontWeight: 700, fontSize: '0.7rem' }}
                >
                  CAGR {fmtPct(result.cagrYr5)} / yr
                </Chip>
              )}
              <Typography level="body-xs" sx={{ opacity: 0.4, mt: 0.5, fontSize: '0.65rem' }}>
                Exit Multiple {exitMultiple.toFixed(1)}x FCF
              </Typography>
            </Sheet>

            {/* Valuation Summary Card */}
            <Sheet
              sx={{
                p: 2.5,
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography level="body-xs" sx={{ opacity: 0.6 }}>Enterprise Value (EV):</Typography>
                  <Typography level="body-xs" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{fmt(result.enterpriseValue)}B</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography level="body-xs" sx={{ opacity: 0.6 }}>Net Cash / Debt:</Typography>
                  <Typography level="body-xs" sx={{ fontWeight: 700, fontFamily: 'monospace', color: result.netCash >= 0 ? '#10b981' : '#ef4444' }}>
                    {result.netCash >= 0 ? '+' : ''}{fmt(netCash)}B
                  </Typography>
                </Stack>
                <Divider sx={{ opacity: 0.1 }} />
                <Stack direction="row" justifyContent="space-between">
                  <Typography level="body-xs" sx={{ fontWeight: 700 }}>Equity Value:</Typography>
                  <Typography level="body-xs" sx={{ fontWeight: 800, fontFamily: 'monospace', color: 'primary.300' }}>
                    {fmt(result.equityValue)}B
                  </Typography>
                </Stack>
              </Stack>
            </Sheet>
          </Box>

          {/* SVG Chart */}
          <Box
            sx={{
              mb: 3,
              p: 2,
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <DCFChart data={result.yearlyData} />
          </Box>

          {/* Projection Table */}
          <Box
            sx={{
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.06)',
              mb: 2,
            }}
          >
            <Table
              stripe="odd"
              size="sm"
              borderAxis="xBetween"
              sx={{
                '--TableCell-paddingX': '12px',
                '--TableCell-paddingY': '10px',
                '& thead th': {
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  opacity: 0.7,
                  background: 'rgba(255,255,255,0.04)',
                },
                '& tbody td': {
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                },
              }}
            >
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>รายการ / Metric ($B)</th>
                  <th style={{ textAlign: 'right' }}>{result.baseYearData.yearLabel}</th>
                  {result.yearlyData.map((d) => (
                    <th key={d.year} style={{ textAlign: 'right' }}>{d.yearLabel}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Revenue Row */}
                <tr>
                  <td><strong>รายได้รวม (Revenue)</strong></td>
                  <td style={{ textAlign: 'right' }}>{fmt(result.baseYearData.revenue)}</td>
                  {result.yearlyData.map((d) => (
                    <td key={d.year} style={{ textAlign: 'right' }}>
                      <Typography level="body-xs" sx={{ fontWeight: 700, color: 'text.primary', fontFamily: 'monospace' }}>
                        {fmt(d.revenue)}
                      </Typography>
                    </td>
                  ))}
                </tr>

                {/* YoY Growth Row */}
                <tr>
                  <td style={{ paddingLeft: '24px', opacity: 0.7 }}><em>อัตราการเติบโต (YoY %)</em></td>
                  <td style={{ textAlign: 'right', opacity: 0.5 }}>-</td>
                  {result.yearlyData.map((d, i) => (
                    <td key={d.year} style={{ textAlign: 'right' }}>
                      {mode === 'detailed' ? (
                        <Input
                          size="sm"
                          type="number"
                          value={d.growth}
                          onChange={(e) => handleYearlyChange(i, 'growth', parseFloat(e.target.value) || 0)}
                          slotProps={{ input: { step: 0.5, style: { textAlign: 'right', padding: '2px 6px', fontSize: '0.8rem' } } }}
                          sx={{ width: '85px', ml: 'auto', background: 'rgba(255,255,255,0.06)', '--Input-minHeight': '30px' }}
                        />
                      ) : (
                        <span style={{ color: '#60a5fa' }}>{fmtPct(d.growth)}</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* EBIT Row */}
                <tr>
                  <td><strong>กำไรการดำเนินงาน (EBIT)</strong></td>
                  <td style={{ textAlign: 'right' }}>{fmt(result.baseYearData.ebit)}</td>
                  {result.yearlyData.map((d) => (
                    <td key={d.year} style={{ textAlign: 'right' }}>
                      {fmt(d.ebit)}
                    </td>
                  ))}
                </tr>

                {/* Operating Margin Row */}
                <tr>
                  <td style={{ paddingLeft: '24px', opacity: 0.7 }}><em>อัตรากำไร (Op Margin %)</em></td>
                  <td style={{ textAlign: 'right', opacity: 0.7 }}>{fmtPct(result.baseYearData.opMargin)}</td>
                  {result.yearlyData.map((d, i) => (
                    <td key={d.year} style={{ textAlign: 'right' }}>
                      {mode === 'detailed' ? (
                        <Input
                          size="sm"
                          type="number"
                          value={d.opMargin}
                          onChange={(e) => handleYearlyChange(i, 'opMargin', parseFloat(e.target.value) || 0)}
                          slotProps={{ input: { step: 0.1, style: { textAlign: 'right', padding: '2px 6px', fontSize: '0.8rem' } } }}
                          sx={{ width: '85px', ml: 'auto', background: 'rgba(255,255,255,0.06)', '--Input-minHeight': '30px' }}
                        />
                      ) : (
                        <span>{fmtPct(d.opMargin)}</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* NOPAT Row */}
                <tr>
                  <td><strong>NOPAT (หลังภาษี {taxRate}%)</strong></td>
                  <td style={{ textAlign: 'right' }}>{fmt(result.baseYearData.nopat)}</td>
                  {result.yearlyData.map((d) => (
                    <td key={d.year} style={{ textAlign: 'right' }}>
                      {fmt(d.nopat)}
                    </td>
                  ))}
                </tr>

                {/* FCF Conversion % Row */}
                <tr>
                  <td style={{ paddingLeft: '24px', opacity: 0.7 }}><em>FCF Conversion (% NOPAT)</em></td>
                  <td style={{ textAlign: 'right', opacity: 0.5 }}>-</td>
                  {result.yearlyData.map((d, i) => (
                    <td key={d.year} style={{ textAlign: 'right' }}>
                      {mode === 'detailed' ? (
                        <Input
                          size="sm"
                          type="number"
                          value={d.fcfConv}
                          onChange={(e) => handleYearlyChange(i, 'fcfConv', parseFloat(e.target.value) || 0)}
                          slotProps={{ input: { step: 1, style: { textAlign: 'right', padding: '2px 6px', fontSize: '0.8rem' } } }}
                          sx={{ width: '85px', ml: 'auto', background: 'rgba(255,255,255,0.06)', '--Input-minHeight': '30px' }}
                        />
                      ) : (
                        <span>{fmtPct(d.fcfConv)}</span>
                      )}
                    </td>
                  ))}
                </tr>

                {/* FCF Row */}
                <tr style={{ background: 'rgba(16, 185, 129, 0.06)' }}>
                  <td><strong style={{ color: '#10b981' }}>กระแสเงินสดอิสระ (FCF)</strong></td>
                  <td style={{ textAlign: 'right', color: '#10b981' }}>-</td>
                  {result.yearlyData.map((d) => (
                    <td key={d.year} style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                      {fmt(d.fcf)}
                    </td>
                  ))}
                </tr>

                {/* Discount Factor Row */}
                <tr>
                  <td style={{ opacity: 0.6 }}>ปัจจัยคิดลด (Discount Factor)</td>
                  <td style={{ textAlign: 'right', opacity: 0.4 }}>-</td>
                  {result.yearlyData.map((d) => (
                    <td key={d.year} style={{ textAlign: 'right', opacity: 0.6 }}>
                      {d.discountFactor.toFixed(4)}
                    </td>
                  ))}
                </tr>

                {/* PV of FCF Row */}
                <tr>
                  <td><strong>มูลค่าปัจจุบัน FCF (PV of FCF)</strong></td>
                  <td style={{ textAlign: 'right', opacity: 0.4 }}>-</td>
                  {result.yearlyData.map((d) => (
                    <td key={d.year} style={{ textAlign: 'right', fontWeight: 600 }}>
                      {fmt(d.pvOfFcf)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </Table>
          </Box>

          {/* Valuation Calculations Breakdown */}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid xs={12} md={6}>
              <Sheet sx={{ p: 2, borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Typography level="title-sm" sx={{ fontWeight: 700, mb: 1, color: 'primary.300' }}>
                  1. Sum of PV & Terminal Value (Gordon Growth)
                </Typography>
                <Stack spacing={0.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography level="body-xs" sx={{ opacity: 0.6 }}>Sum 5-Yr PV of FCF:</Typography>
                    <Typography level="body-xs" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{fmt(result.sumPvFcf)}B</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography level="body-xs" sx={{ opacity: 0.6 }}>Terminal Value (at FY{baseYear+5}):</Typography>
                    <Typography level="body-xs" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{fmt(result.terminalValue)}B</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography level="body-xs" sx={{ opacity: 0.6 }}>PV of Terminal Value:</Typography>
                    <Typography level="body-xs" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{fmt(result.pvOfTerminalValue)}B</Typography>
                  </Stack>
                </Stack>
              </Sheet>
            </Grid>

            <Grid xs={12} md={6}>
              <Sheet sx={{ p: 2, borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Typography level="title-sm" sx={{ fontWeight: 700, mb: 1, color: 'success.300' }}>
                  2. Exit Multiple Valuation (FY{baseYear+5} Target)
                </Typography>
                <Stack spacing={0.5}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography level="body-xs" sx={{ opacity: 0.6 }}>FY{baseYear+5} Expected FCF:</Typography>
                    <Typography level="body-xs" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{fmt(result.yearlyData[4].fcf)}B</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography level="body-xs" sx={{ opacity: 0.6 }}>Target Market Cap (Exit {exitMultiple}x):</Typography>
                    <Typography level="body-xs" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{fmt(result.targetMarketCapYr5)}B</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography level="body-xs" sx={{ opacity: 0.6 }}>Future Target Price / Share:</Typography>
                    <Typography level="body-xs" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#10b981' }}>{fmtFull(result.targetSharePriceYr5)}</Typography>
                  </Stack>
                </Stack>
              </Sheet>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Sheet>
  );
}
