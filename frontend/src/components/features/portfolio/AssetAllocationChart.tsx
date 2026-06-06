import React, { useState, useMemo } from 'react';
import { Box, Typography, Stack, Tabs, TabList, Tab } from '@mui/joy';

interface AssetAllocationChartProps {
  brokers: any[];
  categories: any[];
  allocations: any[];
  summary: any;
  rate: number;
  holdings: any[];
}

const PALETTE = [
  '#0ea5e9', // sky blue
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f43f5e', // rose
  '#f59e0b', // amber
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
];

// Helper to calculate coordinates on a circle
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

// SVG path generator for a donut slice
const getDonutSlicePath = (
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startAngle: number,
  endAngle: number
) => {
  const start = polarToCartesian(cx, cy, rOuter, endAngle);
  const end = polarToCartesian(cx, cy, rOuter, startAngle);
  const startInner = polarToCartesian(cx, cy, rInner, endAngle);
  const endInner = polarToCartesian(cx, cy, rInner, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M', start.x, start.y,
    'A', rOuter, rOuter, 0, largeArcFlag, 0, end.x, end.y,
    'L', endInner.x, endInner.y,
    'A', rInner, rInner, 0, largeArcFlag, 1, startInner.x, startInner.y,
    'Z',
  ].join(' ');
};

export default function AssetAllocationChart({
  brokers,
  categories,
  allocations,
  summary,
  rate,
  holdings,
}: AssetAllocationChartProps) {
  const [viewMode, setViewMode] = useState<number>(0); // 0 = By Platform, 1 = By Category
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Group data based on viewMode
  const chartData = useMemo(() => {
    if (viewMode === 0) {
      // Platform / Broker View
      return brokers
        .map((b, i) => ({
          name: b.broker_name,
          value: b.balance || 0,
          color: PALETTE[i % PALETTE.length],
        }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
    } else {
      // Individual stocks list (open positions with positive shares/market value)
      const stocksList = (holdings || [])
        .filter(h => h.status === 'Open' && h.shares > 0 && (h.market_value || 0) > 0)
        .map(h => ({
          name: h.symbol,
          value: (h.market_value || 0) * rate,
        }));

      // Asset Category View
      const categoryAllocations = categories.map(cat => {
        const val = allocations
          .filter(a => a.category_id === cat.id)
          .reduce((sum, a) => sum + a.amount, 0);
        return {
          name: cat.name,
          value: val,
        };
      });

      // Other/Crypto: manual overrides not in main categories
      const otherVal = brokers
        .filter(b => b.broker_name !== 'Common Stock' && b.broker_name !== 'Krungsri' && b.broker_name !== 'Finnomena' && b.broker_name !== 'Cash')
        .reduce((sum, b) => sum + b.balance, 0);

      const items = [
        ...stocksList,
        ...categoryAllocations,
        ...(otherVal > 0 ? [{ name: 'Other / Crypto', value: otherVal }] : []),
      ];

      // Sort and assign colors sequentially
      return items
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((item, idx) => ({
          ...item,
          color: PALETTE[idx % PALETTE.length],
        }));
    }
  }, [viewMode, brokers, categories, allocations, summary, rate, holdings]);

  const totalValue = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  // Calculate slice angles
  const slices = useMemo(() => {
    let currentAngle = 0;
    return chartData.map(item => {
      const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
      const angle = (item.value / totalValue) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      return {
        ...item,
        percentage,
        startAngle,
        endAngle,
      };
    });
  }, [chartData, totalValue]);

  // SVG parameters
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const rOuterDefault = 135;
  const rInnerDefault = 100;
  const rOuterHover = 140;
  const rInnerHover = 95;

  // Active slice for center text display
  const activeSlice = hoveredIndex !== null ? slices[hoveredIndex] : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, height: '100%' }}>
      {/* Selector */}
      <Tabs
        value={viewMode}
        onChange={(_, val) => {
          setViewMode(val as number);
          setHoveredIndex(null);
        }}
        sx={{ bgcolor: 'transparent', alignSelf: 'flex-end', width: 'fit-content' }}
      >
        <TabList
          variant="soft"
          size="sm"
          sx={{
            p: 0.5,
            borderRadius: '10px',
            bgcolor: 'background.level1',
            '& .MuiTab-root': {
              fontWeight: 700,
              fontSize: '0.75rem',
              px: 2,
              py: 0.5,
              borderRadius: '6px',
              minHeight: '24px',
              color: 'text.secondary',
              bgcolor: 'transparent',
              '&.Mui-selected': {
                color: 'primary.plainColor',
                bgcolor: 'background.surface',
                boxShadow: 'sm',
              },
            },
          }}
        >
          <Tab disableIndicator>Platform</Tab>
          <Tab disableIndicator>Category</Tab>
        </TabList>
      </Tabs>

      {/* Chart Content Grid */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          justifyContent: 'center',
          gap: { xs: 2, sm: 3 },
          flexGrow: 1,
        }}
      >
        {/* SVG Donut Chart */}
        <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
          >
            {slices.map((slice, index) => {
              const isHovered = hoveredIndex === index;
              const rOuter = isHovered ? rOuterHover : rOuterDefault;
              const rInner = isHovered ? rInnerHover : rInnerDefault;

              // If a slice is 100% of the value
              if (slice.percentage >= 99.9) {
                return (
                  <circle
                    key={slice.name}
                    cx={cx}
                    cy={cy}
                    r={(rOuter + rInner) / 2}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={rOuter - rInner}
                    style={{
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                );
              }

              // Otherwise draw standard arc path with small angle gap padding
              const gap = 1.5; // Gap degrees
              const duration = slice.endAngle - slice.startAngle;
              const startAngleAdjusted = slice.startAngle + (duration > gap * 2 ? gap : 0);
              const endAngleAdjusted = slice.endAngle - (duration > gap * 2 ? gap : 0);

              const path = getDonutSlicePath(cx, cy, rInner, rOuter, startAngleAdjusted, endAngleAdjusted);

              return (
                <path
                  key={slice.name}
                  d={path}
                  fill={slice.color}
                  style={{
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    filter: isHovered ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' : 'none',
                    opacity: hoveredIndex !== null && !isHovered ? 0.6 : 1,
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>

          {/* Donut Center text */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              pointerEvents: 'none',
              textAlign: 'center',
              px: 2,
            }}
          >
            <Typography
              level="body-xs"
              sx={{
                opacity: 0.6,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                maxWidth: 160,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {activeSlice ? activeSlice.name : 'Total Assets'}
            </Typography>
            <Typography
              level="h2"
              sx={{
                fontWeight: 800,
                color: activeSlice ? activeSlice.color : 'text.primary',
                mt: 0.5,
              }}
            >
              {activeSlice ? `${activeSlice.percentage.toFixed(1)}%` : '100%'}
            </Typography>
          </Box>
        </Box>

        {/* Legend Panel */}
        <Stack spacing={0.5} sx={{ flexGrow: 1, width: '100%', maxWidth: { sm: '38%', md: '33%' }, maxHeight: 280, overflowY: 'auto', pr: 0.5 }}>
          {slices.map((slice, index) => {
            const isHovered = hoveredIndex === index;
            return (
              <Box
                key={slice.name}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1.25,
                  py: 0.4,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  bgcolor: isHovered ? 'rgba(0, 0, 0, 0.03)' : 'transparent',
                  transition: 'all 0.2s ease',
                  border: '1px solid',
                  borderColor: isHovered ? 'divider' : 'transparent',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: slice.color,
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    level="body-xs"
                    sx={{
                      fontWeight: 700,
                      color: isHovered ? 'text.primary' : 'text.secondary',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {slice.name}
                  </Typography>
                </Stack>
                <Typography level="body-xs" sx={{ fontWeight: 700, opacity: 0.8 }}>
                  {slice.percentage.toFixed(1)}%
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}
