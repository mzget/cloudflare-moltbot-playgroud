import * as React from 'react';
import {
  Sheet,
  Table,
  Typography,
  Box,
} from '@mui/joy';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import type { CompanyStats } from '../types/companyStats';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ScaleUnit = 'K' | 'M' | 'B';
export type SortDir = 'asc' | 'desc' | 'none';

export interface ColumnDef {
  id: keyof CompanyStats;
  label: string;
  format: 'currency' | 'pct' | 'ratio' | 'pct2' | 'ratio2' | 'price';
}

export const ALL_COLUMNS: ColumnDef[] = [
  { id: 'price', label: 'Price', format: 'price' },
  { id: 'market_cap', label: 'Market Cap', format: 'currency' },
  { id: 'revenues', label: 'Revenues', format: 'currency' },
  { id: 'revenue_3y_cagr', label: 'Rev 3Y CAGR', format: 'pct' },
  { id: 'revenue_5y_cagr', label: 'Rev 5Y CAGR', format: 'pct' },
  { id: 'revenue_1y_growth', label: 'Rev 1Y Growth', format: 'pct' },
  { id: 'gross_profit_margin', label: 'Gross Profit', format: 'pct' },
  { id: 'operating_margin', label: 'Op. Margin', format: 'pct' },
  { id: 'fcf_margin', label: 'FCF Margin', format: 'pct' },
  { id: 'p_e', label: 'P/E', format: 'ratio' },
  { id: 'ev_ebit', label: 'EV/EBIT', format: 'ratio' },
  { id: 'ev_sales', label: 'EV/Sales', format: 'ratio' },
  { id: 'p_ocf', label: 'P/OCF', format: 'ratio' },
  { id: 'p_fcf', label: 'P/FCF', format: 'ratio' },
  { id: 'capex_to_ocf', label: 'CapEx/OCF', format: 'ratio' },
  { id: 'rd_to_revenue', label: 'R&D/Rev', format: 'pct' },
  { id: 'total_cash', label: 'Total Cash', format: 'currency' },
  { id: 'net_debt', label: 'Net Debt', format: 'currency' },
  { id: 'total_debt', label: 'Total Debt', format: 'currency' },
  { id: 'debt_equity', label: 'Debt/Equity', format: 'ratio2' },
  { id: 'dividend_yield', label: 'Div Yield', format: 'pct2' },
];

// ─── Formatters ──────────────────────────────────────────────────────────────

const SCALE: Record<ScaleUnit, number> = { K: 1e3, M: 1e6, B: 1e9 };

function formatValue(val: number | undefined, format: ColumnDef['format'], scale: ScaleUnit): string {
  if (val === undefined || val === null) return '—';
  if (format === 'price') {
    return `$${val.toFixed(2)}`;
  }
  if (format === 'currency') {
    // Database stores currency values (like market cap) in millions
    const trueValue = val * 1e6;
    const divisor = SCALE[scale];
    return `$${(trueValue / divisor).toFixed(2)}${scale}`;
  }
  if (format === 'pct') {
    return `${(val * 100).toFixed(1)}%`;
  }
  if (format === 'pct2') {
    return `${(val * 100).toFixed(2)}%`;
  }
  // ratio — large negatives (e.g., -2763) make no sense to show, cap display
  if (Math.abs(val) > 999) return 'N/M';

  if (format === 'ratio2') {
    return val.toFixed(2);
  }
  return val.toFixed(1);
}

// ─── Value coloring ──────────────────────────────────────────────────────────

function getCellColor(val: number | undefined, col: ColumnDef): string {
  if (val === undefined || val === null) return 'text.tertiary';

  // 1. Leverage & Cash Position Columns
  if (col.id === 'debt_equity') {
    if (val < 0 || val >= 1.0) return 'danger.plainColor';
    if (val < 0.5) return 'success.plainColor';
    return 'text.primary';
  }
  if (col.id === 'net_debt') {
    if (val < 0) return 'success.plainColor'; // Net cash position is positive
    return 'text.primary';
  }

  // 2. Margin Columns
  if (col.id === 'gross_profit_margin') {
    if (val < 0.20) return 'danger.plainColor'; // Low gross margin
    if (val >= 0.40) return 'success.plainColor'; // High gross margin
    return 'text.primary';
  }
  if (col.id === 'operating_margin') {
    if (val < 0.05) return 'danger.plainColor'; // Weak operational margin
    if (val >= 0.15) return 'success.plainColor'; // Strong operational margin
    return 'text.primary';
  }
  if (col.id === 'fcf_margin') {
    if (val < 0) return 'danger.plainColor'; // Cash burning margin
    if (val >= 0.10) return 'success.plainColor'; // Strong free cash flow margin
    return 'text.primary';
  }

  // 3. Growth & CAGR Columns
  if (col.id === 'revenue_3y_cagr' || col.id === 'revenue_5y_cagr' || col.id === 'revenue_1y_growth') {
    if (val < 0) return 'danger.plainColor'; // Negative growth
    if (val >= 0.15) return 'success.plainColor'; // High growth (15%+)
    return 'text.primary';
  }

  // 4. R&D & Dividend Columns
  if (col.id === 'rd_to_revenue') {
    if (val < 0) return 'danger.plainColor';
    if (val >= 0.15) return 'success.plainColor'; // Significant R&D investment
    return 'text.primary';
  }
  if (col.id === 'dividend_yield') {
    if (val < 0 || val >= 0.08) return 'danger.plainColor'; // Yield trap warning (>= 8%) or negative
    if (val >= 0.01 && val < 0.05) return 'success.plainColor'; // Healthy target yield range
    return 'text.primary';
  }

  // 5. CapEx to OCF (ratio format)
  if (col.id === 'capex_to_ocf') {
    if (val < 0 || val >= 0.6) return 'danger.plainColor'; // High capital intensity or negative OCF
    if (val < 0.2) return 'success.plainColor'; // Highly capital efficient / asset-light
    return 'text.primary';
  }

  // 6. Absolute Currency Metrics - keep neutral to avoid coloring the whole table green
  if (col.format === 'currency') {
    return 'text.primary';
  }

  // 7. General Ratios (P/E, EV/EBIT, EV/Sales, etc.)
  if (col.format === 'ratio') {
    if (val < 0) return 'danger.plainColor';
    return 'text.primary';
  }

  // Fallback for any other percentage columns
  if (col.format === 'pct' || col.format === 'pct2') {
    if (val < 0) return 'danger.plainColor';
    if (val > 0.15) return 'success.plainColor';
    return 'text.primary';
  }

  return 'text.primary';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === 'asc') return <ArrowUp size={12} style={{ marginLeft: 4, flexShrink: 0 }} />;
  if (dir === 'desc') return <ArrowDown size={12} style={{ marginLeft: 4, flexShrink: 0 }} />;
  return <ArrowUpDown size={12} style={{ marginLeft: 4, flexShrink: 0, opacity: 0.3 }} />;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CompanyStatsTableProps {
  data: CompanyStats[];
  visibleColumnIds: Array<keyof CompanyStats>;
  scale: ScaleUnit;
  density: 'compact' | 'cozy' | 'comfort';
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CompanyStatsTable({
  data,
  visibleColumnIds,
  scale,
  density,
}: CompanyStatsTableProps) {
  const [sortCol, setSortCol] = React.useState<keyof CompanyStats | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDir>('none');

  // Derive visible column definitions (preserve spec order)
  const visibleCols = ALL_COLUMNS.filter(c => visibleColumnIds.includes(c.id));

  // Cycle sort: none → asc → desc → none
  const handleSort = (colId: keyof CompanyStats) => {
    if (sortCol !== colId) {
      setSortCol(colId);
      setSortDir('asc');
    } else {
      setSortDir(prev =>
        prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none'
      );
    }
  };

  // Sort rows
  const sorted = React.useMemo(() => {
    if (!sortCol || sortDir === 'none') return data;
    return [...data].sort((a, b) => {
      const av = a[sortCol] as number | undefined;
      const bv = b[sortCol] as number | undefined;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [data, sortCol, sortDir]);

  // Density-specific spacing, sizes, and layout configurations
  const densityStyles = React.useMemo(() => {
    const config = {
      compact: {
        paddingX: '8px',
        paddingY: '5px',
        fontSize: '0.75rem',
        tickerTitleSize: 'body-xs' as const,
        tickerTitleWeight: 700,
        tickerSubSize: '10px',
        headerSize: '0.65rem',
        rowGap: 0.15,
        minWidth: 120,
      },
      cozy: {
        paddingX: '12px',
        paddingY: '9px',
        fontSize: '0.8rem',
        tickerTitleSize: 'title-sm' as const,
        tickerTitleWeight: 700,
        tickerSubSize: '0.72rem',
        headerSize: '0.7rem',
        rowGap: 0.25,
        minWidth: 140,
      },
      comfort: {
        paddingX: '18px',
        paddingY: '14px',
        fontSize: '0.88rem',
        tickerTitleSize: 'title-sm' as const,
        tickerTitleWeight: 700,
        tickerSubSize: '0.78rem',
        headerSize: '0.75rem',
        rowGap: 0.4,
        minWidth: 160,
      },
    };
    return config[density];
  }, [density]);

  const thSx = {
    color: 'text.tertiary',
    fontWeight: 600,
    fontSize: densityStyles.headerSize,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    '&:hover': { color: 'text.primary' },
  };

  return (
    <Sheet
      sx={{
        background: 'transparent',
        overflow: 'auto',
        borderRadius: '16px',
        maxHeight: '70vh',
        // sticky header container rules
        '& thead th': { position: 'sticky', top: 0, zIndex: 2 },
      }}
    >
      <Table
        borderAxis="xBetween"
        hoverRow
        stripe="odd"
        sx={{
          '--TableCell-paddingX': densityStyles.paddingX,
          '--TableCell-paddingY': densityStyles.paddingY,
          tableLayout: 'auto',
          minWidth: 900,
          '& thead th': {
            background: '#ffffff',
            borderBottom: '2px solid var(--joy-palette-neutral-outlinedBorder, var(--joy-palette-divider))',
            boxShadow: 'inset 0 -1px 0 var(--joy-palette-divider)',
            '[data-joy-color-scheme="dark"] &': {
              background: '#131313',
            },
          },
          '& tbody tr .sticky-td': {
            background: '#ffffff',
            '[data-joy-color-scheme="dark"] &': {
              background: '#131313',
            },
          },
          '& tbody tr:nth-of-type(odd) .sticky-td': {
            background: '#f8fafc',
            '[data-joy-color-scheme="dark"] &': {
              background: '#1c1c1c',
            },
          },
          '& tbody tr:hover .sticky-td': {
            bgcolor: 'background.hover',
          },
        }}
      >
        <thead>
          <tr>
            {/* Fixed company column */}
            <th style={{
              color: 'var(--joy-palette-text-tertiary)',
              fontWeight: 600,
              fontSize: densityStyles.headerSize,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              position: 'sticky',
              left: 0,
              zIndex: 3,
              whiteSpace: 'nowrap',
              minWidth: densityStyles.minWidth,
            }}>
              Ticker
            </th>

            {visibleCols.map(col => (
              <th
                key={col.id}
                onClick={() => handleSort(col.id)}
                style={{
                  textAlign: 'right',
                }}
              >
                <Box sx={{ ...thSx, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  {col.label}
                  <SortIcon dir={sortCol === col.id ? sortDir : 'none'} />
                </Box>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((company, idx) => (
            <tr key={company.symbol}>
              {/* Sticky company cell */}
              <td
                className="sticky-td"
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  padding: `${densityStyles.paddingY} ${densityStyles.paddingX}`,
                  borderRight: '1px solid var(--joy-palette-divider)',
                  minWidth: densityStyles.minWidth,
                }}
              >
                <Box>
                  <Typography
                    level={densityStyles.tickerTitleSize}
                    sx={{
                      fontWeight: densityStyles.tickerTitleWeight,
                      lineHeight: 1.2,
                      fontSize: density === 'compact' ? '0.75rem' : undefined
                    }}
                  >
                    {company.symbol}
                  </Typography>
                  <Typography
                    level="body-xs"
                    sx={{
                      opacity: 0.5,
                      mt: densityStyles.rowGap,
                      fontSize: densityStyles.tickerSubSize
                    }}
                  >
                    {company.name.split(' ').slice(0, 2).join(' ')}
                  </Typography>
                </Box>
              </td>

              {visibleCols.map(col => {
                const rawVal = company[col.id] as number | undefined;
                const color = getCellColor(rawVal, col);
                return (
                  <td
                    key={col.id}
                    style={{
                      textAlign: 'right',
                      padding: `${densityStyles.paddingY} ${densityStyles.paddingX}`
                    }}
                  >
                    <Typography
                      level={density === 'compact' ? 'body-xs' : density === 'comfort' ? 'body-md' : 'body-sm'}
                      sx={{
                        color,
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: 500,
                        fontSize: densityStyles.fontSize,
                      }}
                    >
                      {formatValue(rawVal, col.format, scale)}
                    </Typography>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </Sheet>
  );
}
