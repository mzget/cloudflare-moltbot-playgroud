import * as React from 'react';
import {
  Box, Sheet, Typography, Stack, Slider, Input, Divider, Table,
  FormLabel, FormControl, Tooltip
} from '@mui/joy';
import { Calculator, TrendingUp, DollarSign, BarChart3, Info } from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';

// ─── DCF Calculator Core (ported from interactive_dcf_model.html) ───────────

interface DCFParams {
  baseRev: number;       // $B
  revGrowth: number;     // decimal (e.g. 0.18)
  baseGm: number;        // decimal (e.g. 0.34)
  gmImprovement: number; // decimal per year
  opexMargin: number;    // decimal
  taxRate: number;       // decimal
  fcfConversion: number; // decimal
  wacc: number;          // decimal
  terminalGrowth: number;// decimal
  sharesOutstanding: number; // millions
}

interface YearlyData {
  year: number;
  revenue: number;
  grossMargin: number;
  ebit: number;
  fcf: number;
  pvOfFcf: number;
}

interface DCFResult {
  yearlyData: YearlyData[];
  enterpriseValue: number;
  impliedSharePrice: number;
  pvOfTerminalValue: number;
}

function calculateDCF(params: DCFParams): DCFResult {
  const results: YearlyData[] = [];
  let currentRev = params.baseRev;
  let pvOfFcfSum = 0;

  for (let i = 0; i < 5; i++) {
    const year = 2026 + i;
    if (i > 0) {
      currentRev = currentRev * (1 + params.revGrowth);
    }
    const currentGm = params.baseGm + i * params.gmImprovement;
    const ebit = currentRev * (currentGm - params.opexMargin);
    const nopat = ebit * (1 - params.taxRate);
    const fcf = nopat * params.fcfConversion;
    const discountFactor = Math.pow(1 + params.wacc, i + 1);
    const pvOfFcf = fcf / discountFactor;
    pvOfFcfSum += pvOfFcf;

    results.push({ year, revenue: currentRev, grossMargin: currentGm, ebit, fcf, pvOfFcf });
  }

  const lastFcf = results[4].fcf;
  const terminalValue =
    (lastFcf * (1 + params.terminalGrowth)) / (params.wacc - params.terminalGrowth);
  const pvOfTerminalValue = terminalValue / Math.pow(1 + params.wacc, 5);
  const enterpriseValue = pvOfFcfSum + pvOfTerminalValue;
  const impliedSharePrice = (enterpriseValue * 1000) / params.sharesOutstanding;

  return { yearlyData: results, enterpriseValue, impliedSharePrice, pvOfTerminalValue };
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

  const barW = chartW / data.length * 0.5;
  const gap = chartW / data.length;

  // Build FCF line path
  const linePoints = data.map((d, i) => {
    const x = padL + i * gap + gap / 2;
    const y = padT + chartH - (d.fcf / maxVal) * chartH;
    return `${x},${y}`;
  });
  const linePath = `M${linePoints.join(' L')}`;

  // Area fill under FCF line
  const firstX = padL + gap / 2;
  const lastX = padL + (data.length - 1) * gap + gap / 2;
  const baseY = padT + chartH;
  const areaPath = `M${firstX},${baseY} L${linePoints.join(' L')} L${lastX},${baseY} Z`;

  // Y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    val: maxVal * frac,
    y: padT + chartH - frac * chartH,
  }));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto' }}
    >
      {/* Grid lines */}
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
            fontFamily="inherit"
          >
            ${t.val.toFixed(1)}B
          </text>
        </g>
      ))}

      {/* Revenue bars */}
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
              fill="rgba(255,255,255,0.5)"
              fontSize="10"
              fontFamily="inherit"
            >
              {d.year}
            </text>
          </g>
        );
      })}

      {/* FCF area + line */}
      <path d={areaPath} fill="rgba(16, 185, 129, 0.12)" />
      <path d={linePath} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = padL + i * gap + gap / 2;
        const y = padT + chartH - (d.fcf / maxVal) * chartH;
        return (
          <circle key={`dot-${i}`} cx={x} cy={y} r={4} fill="#10b981" stroke="#0d9668" strokeWidth={1.5} />
        );
      })}

      {/* Legend */}
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
  // Input state
  const [baseRev, setBaseRev] = React.useState(3.6);
  const [revGrowth, setRevGrowth] = React.useState(18);
  const [baseGm, setBaseGm] = React.useState(34);
  const [gmImprovement, setGmImprovement] = React.useState(1.5);
  const [opexMargin, setOpexMargin] = React.useState(18);
  const [taxRate, setTaxRate] = React.useState(15);
  const [fcfConversion, setFcfConversion] = React.useState(80);
  const [wacc, setWacc] = React.useState(11);
  const [terminalGrowth, setTerminalGrowth] = React.useState(2.5);
  const [sharesOutstanding, setSharesOutstanding] = React.useState(228);
  const [currentPrice, setCurrentPrice] = React.useState<number | null>(null);
  const [loadingDefaults, setLoadingDefaults] = React.useState(false);

  // Fetch defaults from backend
  React.useEffect(() => {
    let cancelled = false;
    const fetchDefaults = async () => {
      setLoadingDefaults(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/analysis/dcf-defaults?symbol=${symbol}`);
        if (!res.ok) return;
        const d = await res.json() as any;
        if (cancelled) return;

        if (d.baseRevenue != null) setBaseRev(Math.round(d.baseRevenue * 100) / 100);
        if (d.revenueGrowth != null) setRevGrowth(Math.round(d.revenueGrowth * 10) / 10);
        if (d.grossMargin != null) setBaseGm(Math.round(d.grossMargin * 10) / 10);
        if (d.opexMargin != null) setOpexMargin(Math.round(d.opexMargin * 10) / 10);
        if (d.fcfMargin != null) {
          // Estimate FCF conversion from FCF margin and operating margin
          const opMarg = d.operatingMargin ?? 18;
          if (opMarg > 0) {
            const conv = Math.min(100, Math.max(10, (d.fcfMargin / opMarg) * 100));
            setFcfConversion(Math.round(conv * 10) / 10);
          }
        }
        if (d.sharesOutstanding != null) setSharesOutstanding(d.sharesOutstanding);
        if (d.price != null) setCurrentPrice(d.price);
      } catch {
        // Silently fail - user can input manually
      } finally {
        if (!cancelled) setLoadingDefaults(false);
      }
    };
    fetchDefaults();
    return () => { cancelled = true; };
  }, [symbol]);

  // Calculate DCF
  const result = React.useMemo<DCFResult>(
    () =>
      calculateDCF({
        baseRev,
        revGrowth: revGrowth / 100,
        baseGm: baseGm / 100,
        gmImprovement: gmImprovement / 100,
        opexMargin: opexMargin / 100,
        taxRate: taxRate / 100,
        fcfConversion: fcfConversion / 100,
        wacc: wacc / 100,
        terminalGrowth: terminalGrowth / 100,
        sharesOutstanding,
      }),
    [baseRev, revGrowth, baseGm, gmImprovement, opexMargin, taxRate, fcfConversion, wacc, terminalGrowth, sharesOutstanding]
  );

  const fmt = (v: number) => '$' + v.toFixed(2);
  const fmtPct = (v: number) => v.toFixed(1) + '%';

  // Upside/downside from current price
  const upside = currentPrice && currentPrice > 0
    ? ((result.impliedSharePrice - currentPrice) / currentPrice) * 100
    : null;

  return (
    <Sheet sx={{ ...glassStyle, p: 0, overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          p: 3,
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(16, 185, 129, 0.1) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #2563eb 0%, #10b981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Calculator size={20} color="#fff" />
          </Box>
          <Box>
            <Typography level="h3" sx={{ fontWeight: 800, fontSize: '1.25rem' }}>
              Interactive DCF Model (2026–2030)
            </Typography>
            <Typography level="body-xs" sx={{ opacity: 0.5 }}>
              Discounted Cash Flow Valuation · {symbol}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '340px 1fr' },
          minHeight: '500px',
        }}
      >
        {/* ─── Left Panel: Inputs ─── */}
        <Box
          sx={{
            p: 3,
            borderRight: { lg: '1px solid rgba(255,255,255,0.06)' },
            borderBottom: { xs: '1px solid rgba(255,255,255,0.06)', lg: 'none' },
            overflowY: 'auto',
            maxHeight: { lg: '700px' },
          }}
        >
          <Typography
            level="title-sm"
            sx={{ fontWeight: 700, mb: 2, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}
          >
            Model Parameters
          </Typography>

          {/* Base Revenue input */}
          <FormControl sx={{ mb: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <FormLabel sx={{ m: 0, fontSize: '0.8rem', fontWeight: 600 }}>Base Revenue 2026 ($B)</FormLabel>
            </Stack>
            <Input
              type="number"
              value={baseRev}
              onChange={(e) => setBaseRev(parseFloat(e.target.value) || 0)}
              slotProps={{ input: { step: 0.1, min: 0 } }}
              sx={{ fontFamily: 'monospace', fontWeight: 600 }}
              size="sm"
            />
          </FormControl>

          <SliderRow label="Revenue Growth %" value={revGrowth} min={5} max={50} step={0.5} format={fmtPct} onChange={setRevGrowth} tooltip="Annual revenue growth rate" />
          <SliderRow label="Gross Margin 2026 %" value={baseGm} min={15} max={70} step={0.5} format={fmtPct} onChange={setBaseGm} tooltip="Starting gross margin" />
          <SliderRow label="GM Improvement/yr %" value={gmImprovement} min={0} max={5} step={0.1} format={fmtPct} onChange={setGmImprovement} tooltip="Annual gross margin expansion" />
          <SliderRow label="OpEx Margin %" value={opexMargin} min={10} max={40} step={0.5} format={fmtPct} onChange={setOpexMargin} tooltip="Operating expenses as % of revenue" />
          <SliderRow label="Tax Rate %" value={taxRate} min={0} max={30} step={1} format={fmtPct} onChange={setTaxRate} />
          <SliderRow label="FCF Conversion %" value={fcfConversion} min={10} max={100} step={1} format={fmtPct} onChange={setFcfConversion} tooltip="NOPAT to Free Cash Flow conversion" />

          <Divider sx={{ my: 2, opacity: 0.1 }} />

          <SliderRow label="WACC %" value={wacc} min={6} max={20} step={0.5} format={fmtPct} onChange={setWacc} tooltip="Weighted Average Cost of Capital" />
          <SliderRow label="Terminal Growth %" value={terminalGrowth} min={0} max={5} step={0.1} format={fmtPct} onChange={setTerminalGrowth} tooltip="Long-term growth rate (Gordon Growth)" />

          <FormControl sx={{ mb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <FormLabel sx={{ m: 0, fontSize: '0.8rem', fontWeight: 600 }}>Shares Outstanding (M)</FormLabel>
            </Stack>
            <Input
              type="number"
              value={sharesOutstanding}
              onChange={(e) => setSharesOutstanding(parseFloat(e.target.value) || 1)}
              slotProps={{ input: { step: 1, min: 1 } }}
              sx={{ fontFamily: 'monospace', fontWeight: 600 }}
              size="sm"
            />
          </FormControl>

          {loadingDefaults && (
            <Typography level="body-xs" sx={{ opacity: 0.4, mt: 1, fontStyle: 'italic' }}>
              Loading market data defaults...
            </Typography>
          )}
        </Box>

        {/* ─── Right Panel: Outputs ─── */}
        <Box sx={{ p: 3 }}>
          {/* Output Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
              gap: 2,
              mb: 3,
            }}
          >
            {/* Implied Price Card */}
            <Sheet
              sx={{
                p: 2.5,
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(37, 99, 235, 0.05) 100%)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
                textAlign: 'center',
              }}
            >
              <Typography level="body-xs" sx={{ fontWeight: 700, color: 'primary.400', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                Implied Price
              </Typography>
              <Typography
                level="h2"
                sx={{
                  fontWeight: 900,
                  fontSize: '2rem',
                  fontFamily: 'monospace',
                  background: 'linear-gradient(135deg, #60a5fa 0%, #34d399 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {fmt(result.impliedSharePrice)}
              </Typography>
              {upside !== null && (
                <Typography
                  level="body-xs"
                  sx={{
                    mt: 0.5,
                    fontWeight: 700,
                    color: upside >= 0 ? '#10b981' : '#ef4444',
                  }}
                >
                  {upside >= 0 ? '▲' : '▼'} {Math.abs(upside).toFixed(1)}% vs ${currentPrice?.toFixed(2)}
                </Typography>
              )}
            </Sheet>

            {/* Enterprise Value Card */}
            <Sheet
              sx={{
                p: 2.5,
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                textAlign: 'center',
              }}
            >
              <Typography level="body-xs" sx={{ fontWeight: 700, opacity: 0.5, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                Enterprise Value
              </Typography>
              <Typography level="h3" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>
                {fmt(result.enterpriseValue)}B
              </Typography>
            </Sheet>

            {/* FCF 2030 Card */}
            <Sheet
              sx={{
                p: 2.5,
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                textAlign: 'center',
              }}
            >
              <Typography level="body-xs" sx={{ fontWeight: 700, opacity: 0.5, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                FCF 2030
              </Typography>
              <Typography level="h3" sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#10b981' }}>
                {fmt(result.yearlyData[4].fcf)}B
              </Typography>
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
            }}
          >
            <Table
              stripe="odd"
              size="sm"
              sx={{
                '--TableCell-paddingX': '12px',
                '--TableCell-paddingY': '8px',
                '& thead th': {
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  opacity: 0.6,
                  background: 'rgba(255,255,255,0.03)',
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
                  <th>Metric ($B)</th>
                  {result.yearlyData.map((d) => (
                    <th key={d.year} style={{ textAlign: 'right' }}>{d.year}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Revenue</strong></td>
                  {result.yearlyData.map((d) => (
                    <td key={d.year} style={{ textAlign: 'right' }}>{fmt(d.revenue)}</td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Gross Margin</strong></td>
                  {result.yearlyData.map((d) => (
                    <td key={d.year} style={{ textAlign: 'right' }}>{fmtPct(d.grossMargin * 100)}</td>
                  ))}
                </tr>
                <tr>
                  <td><strong>EBIT</strong></td>
                  {result.yearlyData.map((d) => (
                    <td key={d.year} style={{ textAlign: 'right' }}>{fmt(d.ebit)}</td>
                  ))}
                </tr>
                <tr>
                  <td><strong>Free Cash Flow</strong></td>
                  {result.yearlyData.map((d) => (
                    <td key={d.year} style={{ textAlign: 'right', color: '#10b981' }}>{fmt(d.fcf)}</td>
                  ))}
                </tr>
                <tr>
                  <td><strong>PV of FCF</strong></td>
                  {result.yearlyData.map((d) => (
                    <td key={d.year} style={{ textAlign: 'right', opacity: 0.6 }}>{fmt(d.pvOfFcf)}</td>
                  ))}
                </tr>
              </tbody>
            </Table>
          </Box>

          {/* Terminal Value note */}
          <Typography level="body-xs" sx={{ mt: 2, opacity: 0.4, fontStyle: 'italic' }}>
            Terminal Value (PV): {fmt(result.pvOfTerminalValue)}B · Gordon Growth Model · WACC {fmtPct(wacc)} · Terminal Growth {fmtPct(terminalGrowth)}
          </Typography>
        </Box>
      </Box>
    </Sheet>
  );
}
