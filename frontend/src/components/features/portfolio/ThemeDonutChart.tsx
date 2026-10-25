import * as React from 'react';
import {
  Box,
  Typography,
} from '@mui/joy';
import {
  ArrowLeft,
  PieChart as PieIcon,
} from 'lucide-react';
import { formatCurrency } from './YahooPortfolio';

export interface ThemeExposureItem {
  readonly themeName: string;
  readonly marketValueUsd: number;
  readonly weightPct: number;
  readonly status: 'ok' | 'warning' | 'breach';
  readonly symbols: readonly string[];
  readonly roomToCapUsd: number;
  readonly isUnassigned?: boolean;
}

export interface HoldingSizingItem {
  readonly symbol: string;
  readonly name?: string;
  readonly marketValueUsd: number;
  readonly weightPct: number;
  readonly lastPrice?: number;
  readonly shares?: number;
  readonly themes?: readonly string[];
}

export interface ThemeDonutChartProps {
  readonly themeExposures: readonly ThemeExposureItem[];
  readonly holdings: readonly HoldingSizingItem[];
  readonly totalPortfolioUsd: number;
  readonly showMoneyValues?: boolean;
}

// Chart Palette directly matching the user's interactive example
const THEME_PALETTE = [
  '#3b82f6', // Sky / Royal Blue
  '#10b981', // Vibrant Emerald Green
  '#f59e0b', // Amber Gold
  '#ef4444', // Vibrant Coral Red
  '#8b5cf6', // Periwinkle / Violet
  '#ec4899', // Orchid Pink
  '#06b6d4', // Cyan
  '#f97316', // Tangerine Orange
];

const UNASSIGNED_COLOR = '#94a3b8';

function getArcPath(startAngle: number, endAngle: number, innerRadius: number, outerRadius: number): string {
  const sin = Math.sin;
  const cos = Math.cos;
  const x1 = outerRadius * cos(startAngle);
  const y1 = outerRadius * sin(startAngle);
  const x2 = outerRadius * cos(endAngle);
  const y2 = outerRadius * sin(endAngle);
  const x3 = innerRadius * cos(endAngle);
  const y3 = innerRadius * sin(endAngle);
  const x4 = innerRadius * cos(startAngle);
  const y4 = innerRadius * sin(startAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
}

export default function ThemeDonutChart({
  themeExposures,
  holdings,
  totalPortfolioUsd,
  showMoneyValues = true,
}: ThemeDonutChartProps) {
  const [selectedThemeName, setSelectedThemeName] = React.useState<string | null>(null);
  const [legendHoverTheme, setLegendHoverTheme] = React.useState<string | null>(null);

  // Direct DOM refs for 120 FPS hardware-accelerated tooltip & center text (zero React re-render overhead)
  const tooltipRef = React.useRef<HTMLDivElement | null>(null);
  const centerTitleRef = React.useRef<SVGTextElement | null>(null);
  const centerValueRef = React.useRef<SVGTextElement | null>(null);
  const centerSubRef = React.useRef<SVGTextElement | null>(null);

  // Normalize themes & assign palette colors
  const items = React.useMemo(() => {
    let colorIdx = 0;
    return themeExposures.map((t) => {
      const isUnassigned = t.isUnassigned || t.themeName.toLowerCase() === 'unassigned';
      const color = isUnassigned ? UNASSIGNED_COLOR : THEME_PALETTE[colorIdx++ % THEME_PALETTE.length];
      return {
        ...t,
        color,
        isUnassigned,
      };
    });
  }, [themeExposures]);

  // Selected Theme Details
  const selectedTheme = React.useMemo(() => {
    if (!selectedThemeName) return null;
    return items.find((i) => i.themeName === selectedThemeName) || null;
  }, [selectedThemeName, items]);

  // Holdings in selected theme
  const selectedThemeHoldings = React.useMemo(() => {
    if (!selectedThemeName) return [];
    const targetTheme = items.find((i) => i.themeName === selectedThemeName);
    if (!targetTheme) return [];

    const symbolsSet = new Set(targetTheme.symbols.map((s) => s.toUpperCase()));
    return holdings.filter((h) => {
      const symMatch = symbolsSet.has(h.symbol.toUpperCase());
      const themeMatch = h.themes?.some((th) => th.toLowerCase() === targetTheme.themeName.toLowerCase());
      return symMatch || themeMatch;
    });
  }, [selectedThemeName, items, holdings]);

  // Helper to update Center SVG Text directly on the DOM (fluid & lag-free)
  const updateCenterTextDOM = React.useCallback(
    (title: string, val: string, sub: string) => {
      if (centerTitleRef.current) {
        centerTitleRef.current.textContent = title.length > 24 ? title.slice(0, 22) + '…' : title;
        centerTitleRef.current.style.fontSize = title.length > 22 ? '11px' : title.length > 16 ? '12px' : '13px';
      }
      if (centerValueRef.current) {
        centerValueRef.current.textContent = val;
        centerValueRef.current.style.fontSize = val.length > 12 ? '22px' : val.length > 9 ? '25px' : '28px';
      }
      if (centerSubRef.current) {
        centerSubRef.current.textContent = sub;
        centerSubRef.current.style.fontSize = sub.length > 22 ? '11px' : '13px';
      }
    },
    []
  );

  // Position and display floating tooltip
  const positionTooltip = React.useCallback((clientX: number, clientY: number) => {
    if (!tooltipRef.current) return;
    const pad = 12;
    const ttWidth = 170;
    const ttHeight = 62;

    let left = clientX - ttWidth / 2;
    let top = clientY - ttHeight - 12;

    if (top < pad) {
      top = clientY + 16;
    }
    if (left < pad) {
      left = pad;
    } else if (left + ttWidth > window.innerWidth - pad) {
      left = window.innerWidth - ttWidth - pad;
    }
    if (top + ttHeight > window.innerHeight - pad) {
      top = window.innerHeight - ttHeight - pad;
    }

    tooltipRef.current.style.left = `${left}px`;
    tooltipRef.current.style.top = `${top}px`;
  }, []);

  const handleSliceHover = React.useCallback(
    (e: React.MouseEvent, item: typeof items[0]) => {
      const valText = showMoneyValues ? formatCurrency(item.marketValueUsd, false, '$') : '••••••••';
      const pctText = `${Math.round(item.weightPct)}%`;

      // Update Center text
      updateCenterTextDOM(item.themeName, valText, `${pctText} Portfolio Share`);

      // Update and show floating tooltip
      if (tooltipRef.current) {
        const dot = tooltipRef.current.querySelector('.tt-dot') as HTMLElement;
        const lbl = tooltipRef.current.querySelector('.tt-label') as HTMLElement;
        const val = tooltipRef.current.querySelector('.tt-val') as HTMLElement;
        const pct = tooltipRef.current.querySelector('.tt-pct') as HTMLElement;
        if (dot) dot.style.backgroundColor = item.color;
        if (lbl) lbl.textContent = item.themeName;
        if (val) val.textContent = valText;
        if (pct) pct.textContent = pctText;

        positionTooltip(e.clientX, e.clientY);
        tooltipRef.current.style.opacity = '1';
      }
    },
    [showMoneyValues, updateCenterTextDOM, positionTooltip]
  );

  const handleSliceLeave = React.useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.opacity = '0';
    }

    // Reset center text to selected theme or total portfolio
    if (selectedTheme) {
      const valText = showMoneyValues ? formatCurrency(selectedTheme.marketValueUsd, false, '$') : '••••••••';
      updateCenterTextDOM(selectedTheme.themeName, valText, `${Math.round(selectedTheme.weightPct)}% Portfolio Share`);
    } else {
      const valText = showMoneyValues ? formatCurrency(totalPortfolioUsd, false, '$') : '••••••••';
      updateCenterTextDOM('Total Value', valText, `${items.length} Theme${items.length === 1 ? '' : 's'}`);
    }
  }, [selectedTheme, showMoneyValues, totalPortfolioUsd, items.length, updateCenterTextDOM]);

  // Sync center text on selection changes
  React.useEffect(() => {
    if (selectedTheme) {
      const valText = showMoneyValues ? formatCurrency(selectedTheme.marketValueUsd, false, '$') : '••••••••';
      updateCenterTextDOM(selectedTheme.themeName, valText, `${Math.round(selectedTheme.weightPct)}% Portfolio Share`);
    } else {
      const valText = showMoneyValues ? formatCurrency(totalPortfolioUsd, false, '$') : '••••••••';
      updateCenterTextDOM('Total Value', valText, `${items.length} Theme${items.length === 1 ? '' : 's'}`);
    }
  }, [selectedTheme, showMoneyValues, totalPortfolioUsd, items.length, updateCenterTextDOM]);

  // Global Escape key listener to close details drawer
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedThemeName) {
        setSelectedThemeName(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedThemeName]);

  if (!items || items.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <PieIcon size={36} color="var(--joy-palette-text-tertiary)" style={{ margin: '0 auto 12px' }} />
        <Typography level="body-sm">No theme exposures available to visualize.</Typography>
      </Box>
    );
  }

  // Geometry computation directly matching the user's example
  const outerRadius = 125;
  const innerRadius = 88; // Balanced 37px thickness
  const labelRadius = 146;
  const activeSlices = items.filter(i => i.weightPct > 0);
  const gap = activeSlices.length > 1 ? 0.035 : 0;

  let currentAngle = -Math.PI / 2;
  const slices = activeSlices.map((item) => {
    const pct = Math.max(0, item.weightPct);
    const sliceAngle = (pct / 100) * (Math.PI * 2);
    const startAngle = currentAngle + gap / 2;
    const endAngle = currentAngle + sliceAngle - gap / 2;
    const midAngle = (startAngle + endAngle) / 2;

    const labelX = labelRadius * Math.cos(midAngle);
    const labelY = labelRadius * Math.sin(midAngle);

    currentAngle += sliceAngle;

    return {
      ...item,
      d: getArcPath(startAngle, Math.max(startAngle + 0.001, endAngle), innerRadius, outerRadius),
      labelX,
      labelY,
      labelPct: `${Math.round(pct)}%`,
    };
  });

  const defaultCenterVal = showMoneyValues ? formatCurrency(totalPortfolioUsd, false, '$') : '••••••••';

  return (
    <Box
      sx={{
        width: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <style>{`
        /* 120 FPS GPU Hardware-Accelerated Micro-Interactions */
        .donut-slices-group {
          cursor: pointer;
        }
        .donut-slice {
          cursor: pointer;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
          transform-origin: 0 0;
          outline: none;
        }
        .donut-slice:hover {
          transform: scale(1.05);
        }
        .donut-slice.active {
          transform: scale(1.07);
        }
        .donut-slice.dimmed {
          opacity: 0.35;
        }
        .donut-slices-group:hover .donut-slice:not(:hover):not(.active) {
          opacity: 0.35;
        }
        .donut-slice:focus-visible {
          outline: none;
          stroke: var(--joy-palette-text-primary, #0f172a);
          stroke-width: 3px;
          stroke-linejoin: round;
        }

        .slice-label {
          font-size: 12px;
          font-weight: 700;
          fill: var(--joy-palette-text-primary, #0f172a);
          pointer-events: none;
          transition: opacity 0.3s ease;
          font-variant-numeric: tabular-nums;
        }

        .center-text-group {
          pointer-events: none;
          text-anchor: middle;
        }
        .center-title {
          font-size: 13px;
          font-weight: 600;
          fill: var(--joy-palette-text-secondary, #334155);
          letter-spacing: -0.01em;
        }
        .center-value {
          font-size: 28px;
          font-weight: 800;
          fill: var(--joy-palette-text-primary, #0f172a);
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .center-sub {
          font-size: 13px;
          font-weight: 500;
          fill: var(--joy-palette-text-secondary, #334155);
        }

        /* Floating Cursor Tooltip */
        .donut-tooltip {
          position: fixed;
          background: #0f172a;
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 13px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s ease;
          z-index: 9999;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
          white-space: nowrap;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .tt-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #f8fafc;
        }
        .tt-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          flex-shrink: 0;
        }
        .tt-body {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          color: #cbd5e1;
          font-variant-numeric: tabular-nums;
          font-size: 12px;
        }

        /* Legend Item Pill */
        .legend-container {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 8px 12px;
          width: 100%;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 6px 14px;
          border-radius: 999px;
          background: transparent;
          transition: background 0.2s ease, opacity 0.2s ease, border-color 0.2s ease;
          border: 1px solid transparent;
        }
        .legend-item:hover {
          background: var(--joy-palette-background-level1, rgba(15, 23, 42, 0.05));
        }
        .legend-item.active {
          background: var(--joy-palette-background-level2, rgba(15, 23, 42, 0.1));
          border-color: var(--joy-palette-neutral-outlinedBorder, rgba(15, 23, 42, 0.18));
        }
        .legend-item.dimmed {
          opacity: 0.35;
        }
        .legend-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          flex-shrink: 0;
        }
        .legend-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--joy-palette-text-primary, #0f172a);
        }
        .legend-pct {
          font-size: 12px;
          color: var(--joy-palette-text-secondary, #334155);
          font-variant-numeric: tabular-nums;
        }

        /* Details Section */
        @keyframes detailsFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .details-section {
          animation: detailsFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .category-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--joy-palette-divider, rgba(15, 23, 42, 0.12));
        }
        .category-title-area {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .category-color-indicator {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .category-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--joy-palette-text-primary, #0f172a);
          letter-spacing: -0.01em;
          margin: 0;
        }
        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--joy-palette-background-level1, #f1f5f9);
          color: var(--joy-palette-text-primary, #0f172a);
          border: 1px solid var(--joy-palette-neutral-outlinedBorder, rgba(15, 23, 42, 0.14));
          padding: 6px 16px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease;
        }
        .back-btn:hover {
          background: var(--joy-palette-background-level2, #e2e8f0);
        }

        .category-meta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 24px;
          margin-bottom: 24px;
        }
        .meta-item {
          text-align: center;
          flex: 1;
        }
        .meta-val {
          font-size: 20px;
          font-weight: 700;
          color: var(--joy-palette-text-primary, #0f172a);
          font-variant-numeric: tabular-nums;
        }
        .meta-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--joy-palette-text-secondary, #334155);
          margin-top: 2px;
        }
        .meta-divider {
          width: 1px;
          height: 32px;
          background: var(--joy-palette-divider, rgba(15, 23, 42, 0.12));
        }

        /* Holdings List */
        .holdings-list-container {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .holding-card {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .holding-info-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ticker-name-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ticker-badge {
          background: var(--joy-palette-background-level1, #f1f5f9);
          border: 1px solid var(--joy-palette-neutral-outlinedBorder, rgba(15, 23, 42, 0.14));
          color: var(--joy-palette-text-primary, #0f172a);
          font-size: 12px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          font-variant-numeric: tabular-nums;
        }
        .company-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--joy-palette-text-primary, #0f172a);
        }
        .holding-value-group {
          text-align: right;
        }
        .holding-val {
          font-size: 14px;
          font-weight: 700;
          color: var(--joy-palette-text-primary, #0f172a);
          font-variant-numeric: tabular-nums;
        }
        .holding-pct {
          font-size: 12px;
          font-weight: 500;
          color: var(--joy-palette-text-secondary, #334155);
          font-variant-numeric: tabular-nums;
        }
        .progress-bar-bg {
          width: 100%;
          height: 5px;
          background: var(--joy-palette-background-level2, #e2e8f0);
          border-radius: 999px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      {/* Floating Tooltip Component */}
      <div ref={tooltipRef} className="donut-tooltip">
        <div className="tt-header">
          <div className="tt-dot" />
          <span className="tt-label" />
        </div>
        <div className="tt-body">
          <span className="tt-val" />
          <span className="tt-pct" />
        </div>
      </div>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: selectedThemeName ? 'row' : 'column' },
          alignItems: 'center',
          justifyContent: selectedThemeName ? 'space-between' : 'center',
          gap: selectedThemeName ? { xs: 3, md: 3 } : 2.5,
          width: '100%',
          maxWidth: selectedThemeName ? '100%' : 500,
          margin: '0 auto',
          transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Left Column: Donut Chart & Legend */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: selectedThemeName ? { xs: '100%', md: '44%' } : '100%',
            flexShrink: 0,
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Chart SVG Wrapper */}
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              maxWidth: selectedThemeName ? 250 : 290,
              aspectRatio: '1',
              mb: selectedThemeName ? 1.5 : 2.5,
              transition: 'max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <svg
              viewBox="-160 -160 320 320"
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
              role="img"
              aria-label="Stock Portfolio Allocation Chart"
              onMouseMove={(e) => {
                if (tooltipRef.current && tooltipRef.current.style.opacity === '1') {
                  positionTooltip(e.clientX, e.clientY);
                }
              }}
            >
              {/* Slices Group */}
              <g className="donut-slices-group">
                {slices.map((slice) => {
                  const isSelected = selectedThemeName === slice.themeName;
                  const isLegendHovered = legendHoverTheme === slice.themeName;
                  const isDimmed =
                    (selectedThemeName && !isSelected) || (legendHoverTheme && !isLegendHovered);

                  return (
                    <path
                      key={slice.themeName}
                      d={slice.d}
                      fill={slice.color}
                      className={`donut-slice ${isSelected ? 'active' : ''} ${isLegendHovered ? 'active' : ''} ${
                        isDimmed ? 'dimmed' : ''
                      }`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${slice.themeName}: ${slice.labelPct}, $${Math.round(
                        slice.marketValueUsd
                      ).toLocaleString()}`}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedThemeName((prev) => (prev === slice.themeName ? null : slice.themeName));
                      }}
                      onMouseEnter={(e) => handleSliceHover(e, slice)}
                      onMouseLeave={handleSliceLeave}
                    />
                  );
                })}
              </g>

              {/* Slices Percentage Labels */}
              <g aria-hidden="true">
                {slices.map((slice) => {
                  if (slice.weightPct < 4) return null; // Avoid overlapping tiny slices
                  return (
                    <text
                      key={`lbl-${slice.themeName}`}
                      x={slice.labelX}
                      y={slice.labelY}
                      className="slice-label"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {slice.labelPct}
                    </text>
                  );
                })}
              </g>

              {/* Center Text Display Hub */}
              <g className="center-text-group" aria-hidden="true">
                <text ref={centerTitleRef} className="center-title" y="-20">
                  {selectedTheme ? selectedTheme.themeName : 'Total Value'}
                </text>
                <text ref={centerValueRef} className="center-value" y="10">
                  {selectedTheme
                    ? (showMoneyValues ? formatCurrency(selectedTheme.marketValueUsd, false, '$') : '••••••••')
                    : defaultCenterVal}
                </text>
                <text ref={centerSubRef} className="center-sub" y="34">
                  {selectedTheme
                    ? `${Math.round(selectedTheme.weightPct)}% Portfolio Share`
                    : `${items.length} Theme${items.length === 1 ? '' : 's'}`}
                </text>
              </g>
            </svg>
          </Box>

          {/* Interactive Legend Pills */}
          <div className="legend-container" role="group" aria-label="Portfolio Categories Legend">
            {items.map((item) => {
              const isSelected = selectedThemeName === item.themeName;
              const isDimmed = selectedThemeName && !isSelected;

              return (
                <div
                  key={item.themeName}
                  className={`legend-item ${isSelected ? 'active' : ''} ${isDimmed ? 'dimmed' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedThemeName((prev) => (prev === item.themeName ? null : item.themeName));
                  }}
                  onMouseEnter={() => {
                    setLegendHoverTheme(item.themeName);
                    const valText = showMoneyValues
                      ? formatCurrency(item.marketValueUsd, false, '$')
                      : '••••••••';
                    updateCenterTextDOM(
                      item.themeName,
                      valText,
                      `${Math.round(item.weightPct)}% Portfolio Share`
                    );
                  }}
                  onMouseLeave={() => {
                    setLegendHoverTheme(null);
                    handleSliceLeave();
                  }}
                >
                  <div className="legend-dot" style={{ backgroundColor: item.color }} />
                  <span className="legend-label">
                    {item.themeName} ({item.weightPct.toFixed(1)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </Box>

        {/* Right Column: Category Details Panel (Drill-Down Drawer) */}
        {selectedTheme && (
          <Box
            className="details-section"
            sx={{
              width: { xs: '100%', md: '54%' },
              flexGrow: 1,
              bgcolor: 'transparent',
              p: { xs: 1, md: 2 },
            }}
          >
            {/* Header */}
            <div className="category-header">
              <div className="category-title-area">
                <div
                  className="category-color-indicator"
                  style={{ backgroundColor: selectedTheme.color }}
                />
                <h3 className="category-title">{selectedTheme.themeName}</h3>
              </div>
              <button
                className="back-btn"
                onClick={() => setSelectedThemeName(null)}
                aria-label="Back to Overview"
              >
                <ArrowLeft size={14} />
                Back to Overview
              </button>
            </div>

            {/* Meta Stats */}
            <div className="category-meta">
              <div className="meta-item">
                <div className="meta-val">
                  {showMoneyValues ? formatCurrency(selectedTheme.marketValueUsd, false, '$') : '••••••••'}
                </div>
                <div className="meta-label">Category Value</div>
              </div>
              <div className="meta-divider" />
              <div className="meta-item">
                <div
                  className="meta-val"
                  style={{
                    color:
                      selectedTheme.weightPct > 30
                        ? 'var(--joy-palette-danger-plainColor, #dc2626)'
                        : selectedTheme.weightPct >= 25
                        ? 'var(--joy-palette-warning-plainColor, #d97706)'
                        : 'var(--joy-palette-text-primary, #0f172a)',
                  }}
                >
                  {Math.round(selectedTheme.weightPct)}%
                </div>
                <div className="meta-label">Portfolio Share (30% Cap)</div>
              </div>
            </div>

            {/* Holdings List with Animated Progress Bars */}
            <div className="holdings-list-container">
              {selectedThemeHoldings.map((h) => {
                const themeTotal = selectedTheme.marketValueUsd || 1;
                const intraSharePct = themeTotal > 0 ? (h.marketValueUsd / themeTotal) * 100 : 0;

                return (
                  <div key={h.symbol} className="holding-card">
                    <div className="holding-info-top">
                      <div className="ticker-name-group">
                        <span className="ticker-badge">{h.symbol}</span>
                        <span className="company-name">{h.name || h.symbol}</span>
                      </div>
                      <div className="holding-value-group">
                        <div className="holding-val">
                          {showMoneyValues ? formatCurrency(h.marketValueUsd, false, '$') : '••••••••'}
                        </div>
                        <div className="holding-pct">
                          {intraSharePct.toFixed(1)}% of theme ({h.weightPct.toFixed(1)}% total)
                        </div>
                      </div>
                    </div>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${intraSharePct}%`,
                          backgroundColor: selectedTheme.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              {selectedThemeHoldings.length === 0 && (
                <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography level="body-xs">No active holdings mapped directly to this theme.</Typography>
                </Box>
              )}
            </div>
          </Box>
        )}
      </Box>
    </Box>
  );
}
