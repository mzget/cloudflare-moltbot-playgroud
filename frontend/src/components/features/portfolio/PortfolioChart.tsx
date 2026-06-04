import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Typography, Stack, Button, ButtonGroup, CircularProgress } from '@mui/joy';
import { API_BASE_URL } from '../../../config';

interface HistoryPoint {
  date: string;
  total_market_value: number;
  total_cost: number;
  unrealized_gain: number;
  realized_gain: number;
  total_dividends: number;
}

const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '--';
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PortfolioChart() {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<7 | 30 | 90>(30);
  const [hoveredPoint, setHoveredPoint] = useState<HistoryPoint | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/portfolio/history`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data);
        }
      } catch (e) {
        console.error('Failed to fetch portfolio history:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    if (history.length === 0) return [];
    return history.slice(-timeframe);
  }, [history, timeframe]);

  // Chart dimensions
  const width = 500;
  const height = 140;
  const paddingX = 20;
  const paddingY = 15;

  const chartData = useMemo(() => {
    if (filteredHistory.length === 0) return null;

    // Get min/max for scaling
    const vals = filteredHistory.flatMap(p => [p.total_market_value, p.total_cost]);
    let minVal = Math.min(...vals);
    let maxVal = Math.max(...vals);

    const diff = maxVal - minVal;
    if (diff === 0) {
      minVal -= 10;
      maxVal += 10;
    } else {
      minVal -= diff * 0.1; // 10% padding bottom
      maxVal += diff * 0.1; // 10% padding top
    }

    const points = filteredHistory.map((p, i) => {
      const x = paddingX + (i / (filteredHistory.length - 1)) * (width - paddingX * 2);
      const yVal = height - paddingY - ((p.total_market_value - minVal) / (maxVal - minVal)) * (height - paddingY * 2);
      const yCost = height - paddingY - ((p.total_cost - minVal) / (maxVal - minVal)) * (height - paddingY * 2);
      return {
        x,
        yVal,
        yCost,
        raw: p,
      };
    });

    // Build SVG paths
    const valPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yVal}`).join(' ');
    const costPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yCost}`).join(' ');
    const areaPath = `${valPath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

    return {
      points,
      valPath,
      costPath,
      areaPath,
    };
  }, [filteredHistory]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current || !chartData || chartData.points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Scale mouseX to fit internal SVG coordinate system width
    const svgWidth = rect.width;
    const scale = width / svgWidth;
    const internalX = mouseX * scale;

    // Find closest point
    let closestIndex = 0;
    let minDistance = Infinity;
    chartData.points.forEach((p, idx) => {
      const dist = Math.abs(p.x - internalX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });

    setHoveredPoint(chartData.points[closestIndex].raw);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Show active values: either hovered point, or the latest point
  const activeDisplay = hoveredPoint || (filteredHistory.length > 0 ? filteredHistory[filteredHistory.length - 1] : null);

  const gainLossInfo = useMemo(() => {
    if (!activeDisplay) return null;
    const diff = activeDisplay.total_market_value - activeDisplay.total_cost;
    const pct = activeDisplay.total_cost > 0 ? (diff / activeDisplay.total_cost) * 100 : 0;
    const isPositive = diff >= 0;
    return {
      diff,
      pct,
      isPositive,
    };
  }, [activeDisplay]);

  if (loading) {
    return (
      <Box sx={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size="sm" />
      </Box>
    );
  }

  if (filteredHistory.length === 0) {
    return (
      <Box sx={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography level="body-xs" sx={{ opacity: 0.5 }}>No performance data available</Typography>
      </Box>
    );
  }

  // Active hover positions
  const hoverPoints = chartData && activeDisplay ? (() => {
    const idx = filteredHistory.findIndex(p => p.date === activeDisplay.date);
    return idx >= 0 ? chartData.points[idx] : null;
  })() : null;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Chart Header Info */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
        <Box>
          <Typography level="body-xs" sx={{ opacity: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {hoveredPoint ? `Snapshot: ${hoveredPoint.date}` : `Portfolio Performance (${timeframe}D)`}
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={1.5} sx={{ mt: 0.5 }}>
            <Typography level="h3" sx={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1 }}>
              {formatCurrency(activeDisplay?.total_market_value)}
            </Typography>
            {gainLossInfo && (
              <Typography level="body-sm" sx={{ fontWeight: 700 }} className={gainLossInfo.isPositive ? 'yf-positive' : 'yf-negative'}>
                {gainLossInfo.isPositive ? '+' : ''}{formatCurrency(gainLossInfo.diff)} ({gainLossInfo.isPositive ? '+' : ''}{gainLossInfo.pct.toFixed(2)}%)
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
            <Typography level="body-xs" sx={{ opacity: 0.6 }}>
              Cost Basis: <Box component="span" sx={{ fontWeight: 600 }}>{formatCurrency(activeDisplay?.total_cost)}</Box>
            </Typography>
            {activeDisplay && activeDisplay.total_dividends > 0 && (
              <Typography level="body-xs" sx={{ opacity: 0.6 }}>
                Dividends: <Box component="span" sx={{ fontWeight: 600 }} className="yf-positive">{formatCurrency(activeDisplay.total_dividends)}</Box>
              </Typography>
            )}
          </Stack>
        </Box>

        {/* Timeframe Buttons */}
        <ButtonGroup variant="outlined" size="sm" sx={{ borderRadius: '20px', overflow: 'hidden' }}>
          {([7, 30, 90] as const).map(tf => (
            <Button
              key={tf}
              onClick={() => setTimeframe(tf)}
              sx={{
                px: 1.5,
                fontWeight: 700,
                fontSize: '0.75rem',
                minHeight: '26px',
                bgcolor: timeframe === tf ? 'primary.softBg' : 'transparent',
                borderColor: 'divider',
                color: timeframe === tf ? 'primary.plainColor' : 'text.secondary',
                '&:hover': { bgcolor: 'background.level1' },
              }}
            >
              {tf}D
            </Button>
          ))}
        </ButtonGroup>
      </Stack>

      {/* SVG Plot */}
      {chartData && (
        <Box sx={{ position: 'relative', width: '100%' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height="100%"
            style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--joy-palette-primary-solidBg, #007aff)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--joy-palette-primary-solidBg, #007aff)" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Grid Line (Cost Basis) */}
            <path
              d={chartData.costPath}
              fill="none"
              stroke="var(--joy-palette-neutral-outlinedBorder, rgba(0, 0, 0, 0.15))"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Filled Area */}
            <path
              d={chartData.areaPath}
              fill="url(#chartGradient)"
            />

            {/* Value Line */}
            <path
              d={chartData.valPath}
              fill="none"
              stroke="var(--joy-palette-primary-solidBg, #007aff)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Interactive Overlay & Guide line */}
            {hoverPoints && (
              <>
                {/* Vertical Cursor Guide */}
                <line
                  x1={hoverPoints.x}
                  y1={paddingY}
                  x2={hoverPoints.x}
                  y2={height - paddingY}
                  stroke="var(--joy-palette-primary-solidBg, #007aff)"
                  strokeWidth="1"
                  strokeOpacity="0.3"
                  strokeDasharray="2 2"
                />

                {/* Dot for Cost */}
                <circle
                  cx={hoverPoints.x}
                  cy={hoverPoints.yCost}
                  r="3.5"
                  fill="var(--joy-palette-background-surface, #fff)"
                  stroke="var(--joy-palette-neutral-solidBg, #636b74)"
                  strokeWidth="1.5"
                />

                {/* Dot for Market Value */}
                <circle
                  cx={hoverPoints.x}
                  cy={hoverPoints.yVal}
                  r="5"
                  fill="var(--joy-palette-primary-solidBg, #007aff)"
                  stroke="var(--joy-palette-background-surface, #fff)"
                  strokeWidth="2"
                />
              </>
            )}
          </svg>
        </Box>
      )}
    </Box>
  );
}
