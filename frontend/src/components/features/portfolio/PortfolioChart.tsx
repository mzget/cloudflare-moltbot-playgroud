import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Typography, Stack, Button, ButtonGroup, CircularProgress } from '@mui/joy';
import { API_BASE_URL } from '../../../config';

interface PerformanceData {
  dates: string[];
  portfolioReturns: number[];
  sp500Returns: number[];
}

const formatReturn = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '--%';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
};

export default function PortfolioChart() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'ytd' | '1y' | '3y' | '5y'>('1y');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    async function fetchPerformance() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/portfolio/performance-comparison?timeframe=${timeframe}`);
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (e) {
        console.error('Failed to fetch performance comparison:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchPerformance();
  }, [timeframe]);

  // Chart dimensions
  const width = 500;
  const height = 180;
  const paddingX = 25;
  const paddingY = 20;

  const { minVal, maxVal } = useMemo(() => {
    if (!data || !data.dates || data.dates.length === 0) return { minVal: 0, maxVal: 0 };
    const allReturns = [...data.portfolioReturns, ...data.sp500Returns];
    let min = Math.min(...allReturns);
    let max = Math.max(...allReturns);

    const diff = max - min;
    if (diff === 0) {
      min -= 5;
      max += 5;
    } else {
      min -= diff * 0.15; // 15% padding bottom
      max += diff * 0.15; // 15% padding top
    }
    return { minVal: min, maxVal: max };
  }, [data]);

  const points = useMemo(() => {
    if (!data || !data.dates || data.dates.length === 0) return null;
    return data.dates.map((date, i) => {
      const x = paddingX + (i / (data.dates.length - 1)) * (width - paddingX * 2);
      const yPort = height - paddingY - ((data.portfolioReturns[i] - minVal) / (maxVal - minVal)) * (height - paddingY * 2);
      const ySp500 = height - paddingY - ((data.sp500Returns[i] - minVal) / (maxVal - minVal)) * (height - paddingY * 2);
      return {
        x,
        yPort,
        ySp500,
        date,
        portReturn: data.portfolioReturns[i],
        sp500Return: data.sp500Returns[i],
      };
    });
  }, [data, minVal, maxVal]);

  const chartPaths = useMemo(() => {
    if (!points || points.length === 0) return null;

    const portPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yPort}`).join(' ');
    const sp500Path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.ySp500}`).join(' ');
    const portAreaPath = `${portPath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

    return {
      portPath,
      sp500Path,
      portAreaPath,
    };
  }, [points]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current || !data || !data.dates || data.dates.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Scale mouseX to fit internal SVG coordinate system width
    const svgWidth = rect.width;
    const scale = width / svgWidth;
    const internalX = mouseX * scale;

    // Find closest index based on x position
    const step = (width - paddingX * 2) / (data.dates.length - 1);
    let closestIndex = Math.round((internalX - paddingX) / step);
    closestIndex = Math.max(0, Math.min(data.dates.length - 1, closestIndex));

    setHoveredIndex(closestIndex);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  // Resolve active displays
  const activeIndex = hoveredIndex !== null ? hoveredIndex : (data?.dates && data.dates.length > 0 ? data.dates.length - 1 : null);
  const activeDate = activeIndex !== null && data ? data.dates[activeIndex] : null;
  const activePort = activeIndex !== null && data ? data.portfolioReturns[activeIndex] : null;
  const activeSp500 = activeIndex !== null && data ? data.sp500Returns[activeIndex] : null;

  const activePoints = points && activeIndex !== null ? points[activeIndex] : null;

  const diffReturn = activePort !== null && activeSp500 !== null ? activePort - activeSp500 : null;

  if (loading && !data) {
    return (
      <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size="sm" />
      </Box>
    );
  }

  if (!data || !data.dates || data.dates.length === 0) {
    return (
      <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography level="body-xs" sx={{ opacity: 0.5 }}>No performance data available</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Chart Header Info */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
        <Box>
          <Typography level="body-xs" sx={{ opacity: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {hoveredIndex !== null ? `Snapshot: ${activeDate}` : `Performance vs S&P 500 (${timeframe.toUpperCase()})`}
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={2} sx={{ mt: 0.5 }}>
            <Box>
              <Typography level="body-xs" sx={{ opacity: 0.6, fontWeight: 700 }}>PORTFOLIO</Typography>
              <Typography
                level="h4"
                sx={{
                  fontWeight: 800,
                  color: activePort !== null && activePort >= 0 ? 'success.plainColor' : 'danger.plainColor',
                  lineHeight: 1.1,
                }}
              >
                {formatReturn(activePort)}
              </Typography>
            </Box>
            <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', pl: 2 }}>
              <Typography level="body-xs" sx={{ opacity: 0.6, fontWeight: 700 }}>S&P 500</Typography>
              <Typography
                level="h4"
                sx={{
                  fontWeight: 800,
                  color: activeSp500 !== null && activeSp500 >= 0 ? 'success.plainColor' : 'danger.plainColor',
                  lineHeight: 1.1,
                }}
              >
                {formatReturn(activeSp500)}
              </Typography>
            </Box>
            {diffReturn !== null && (
              <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', pl: 2 }}>
                <Typography level="body-xs" sx={{ opacity: 0.6, fontWeight: 700 }}>VS S&P 500</Typography>
                <Typography
                  level="h4"
                  sx={{
                    fontWeight: 800,
                    color: diffReturn >= 0 ? 'success.plainColor' : 'danger.plainColor',
                    lineHeight: 1.1,
                  }}
                >
                  {diffReturn >= 0 ? `+${diffReturn.toFixed(2)}%` : `${diffReturn.toFixed(2)}%`}
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>

        {/* Timeframe Buttons */}
        <ButtonGroup variant="outlined" size="sm" sx={{ borderRadius: '20px', overflow: 'hidden' }}>
          {(['ytd', '1y', '3y', '5y'] as const).map(tf => (
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
              {tf.toUpperCase()}
            </Button>
          ))}
        </ButtonGroup>
      </Stack>

      {/* SVG Plot */}
      {chartPaths && (
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
              <linearGradient id="portGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--joy-palette-primary-solidBg, #007aff)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--joy-palette-primary-solidBg, #007aff)" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Zero Return Line Reference */}
            {minVal < 0 && maxVal > 0 && (
              <line
                x1={paddingX}
                y1={height - paddingY - ((0 - minVal) / (maxVal - minVal)) * (height - paddingY * 2)}
                x2={width - paddingX}
                y2={height - paddingY - ((0 - minVal) / (maxVal - minVal)) * (height - paddingY * 2)}
                stroke="var(--joy-palette-neutral-outlinedBorder, rgba(0, 0, 0, 0.1))"
                strokeWidth="1"
                strokeDasharray="2 4"
              />
            )}

            {/* S&P 500 Reference Line */}
            <path
              d={chartPaths.sp500Path}
              fill="none"
              stroke="var(--joy-palette-neutral-solidBg, #9ba6b2)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              strokeOpacity="0.75"
            />

            {/* Portfolio Filled Area */}
            <path
              d={chartPaths.portAreaPath}
              fill="url(#portGradient)"
            />

            {/* Portfolio Value Line */}
            <path
              d={chartPaths.portPath}
              fill="none"
              stroke="var(--joy-palette-primary-solidBg, #007aff)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Interactive Overlay & Guide line */}
            {activePoints && hoveredIndex !== null && (
              <>
                {/* Vertical Cursor Guide */}
                <line
                  x1={activePoints.x}
                  y1={paddingY}
                  x2={activePoints.x}
                  y2={height - paddingY}
                  stroke="var(--joy-palette-primary-solidBg, #007aff)"
                  strokeWidth="1"
                  strokeOpacity="0.25"
                  strokeDasharray="2 2"
                />

                {/* Dot for S&P 500 */}
                <circle
                  cx={activePoints.x}
                  cy={activePoints.ySp500}
                  r="4"
                  fill="var(--joy-palette-background-surface, #fff)"
                  stroke="var(--joy-palette-neutral-solidBg, #9ba6b2)"
                  strokeWidth="1.5"
                />

                {/* Dot for Portfolio Return */}
                <circle
                  cx={activePoints.x}
                  cy={activePoints.yPort}
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

      {/* Legend */}
      <Stack direction="row" spacing={2.5} justifyContent="center" sx={{ mt: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Box sx={{ width: 12, height: 3, bgcolor: 'primary.solidBg', borderRadius: 2 }} />
          <Typography level="body-xs" sx={{ fontWeight: 600, color: 'text.secondary' }}>Portfolio</Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Box sx={{ width: 12, height: 3, bgcolor: 'neutral.solidBg', borderRadius: 2, opacity: 0.7, borderStyle: 'dashed', borderWidth: '0 0 2px 0' }} />
          <Typography level="body-xs" sx={{ fontWeight: 600, color: 'text.secondary' }}>S&P 500 Index</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
