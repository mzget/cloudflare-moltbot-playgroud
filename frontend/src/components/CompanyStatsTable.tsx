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
  format: 'currency' | 'pct' | 'ratio';
}

export const ALL_COLUMNS: ColumnDef[] = [
  { id: 'market_cap',       label: 'Market Cap',       format: 'currency' },
  { id: 'revenues',         label: 'Revenues',         format: 'currency' },
  { id: 'revenue_3y_cagr',  label: 'Rev 3Y CAGR',      format: 'pct'      },
  { id: 'revenue_1y_growth',label: 'Rev 1Y Growth',    format: 'pct'      },
  { id: 'gross_profit_margin', label: 'Gross Profit',  format: 'pct'      },
  { id: 'operating_margin', label: 'Op. Margin',       format: 'pct'      },
  { id: 'ev_ebit',          label: 'EV/EBIT',          format: 'ratio'    },
  { id: 'ev_sales',         label: 'EV/Sales',         format: 'ratio'    },
  { id: 'p_ocf',            label: 'P/OCF',            format: 'ratio'    },
  { id: 'p_fcf',            label: 'P/FCF',            format: 'ratio'    },
  { id: 'capex_to_ocf',     label: 'CapEx/OCF',        format: 'ratio'    },
  { id: 'rd_to_revenue',    label: 'R&D/Rev',          format: 'pct'      },
  { id: 'debt_equity',      label: 'Debt/Equity',      format: 'ratio'    },
  { id: 'p_e',              label: 'P/E',              format: 'ratio'    },
  { id: 'fcf_margin',       label: 'FCF Margin',       format: 'pct'      },
  { id: 'total_cash',       label: 'Total Cash',       format: 'currency' },
  { id: 'net_debt',         label: 'Net Debt',         format: 'currency' },
  { id: 'dividend_yield',   label: 'Div Yield',        format: 'pct'      },
];

// ─── Formatters ──────────────────────────────────────────────────────────────

const SCALE: Record<ScaleUnit, number> = { K: 1e3, M: 1e6, B: 1e9 };

function formatValue(val: number | undefined, format: ColumnDef['format'], scale: ScaleUnit): string {
  if (val === undefined || val === null) return '—';
  if (format === 'currency') {
    const divisor = SCALE[scale];
    return `$${(val / divisor).toFixed(2)}${scale}`;
  }
  if (format === 'pct') {
    return `${(val * 100).toFixed(1)}%`;
  }
  // ratio — large negatives (e.g., -2763) make no sense to show, cap display
  if (Math.abs(val) > 999) return 'N/M';
  return val.toFixed(1);
}

// ─── Value coloring ──────────────────────────────────────────────────────────

function valueColor(val: number | undefined): string {
  if (val === undefined || val === null) return 'text.tertiary';
  if (val < 0) return '#e74c3c';
  if (val > 0.15) return '#27ae60'; // Slightly darker green for light mode readability
  return 'text.primary';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === 'asc')  return <ArrowUp  size={12} style={{ marginLeft: 4, flexShrink: 0 }} />;
  if (dir === 'desc') return <ArrowDown size={12} style={{ marginLeft: 4, flexShrink: 0 }} />;
  return <ArrowUpDown size={12} style={{ marginLeft: 4, flexShrink: 0, opacity: 0.3 }} />;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CompanyStatsTableProps {
  data: CompanyStats[];
  visibleColumnIds: Array<keyof CompanyStats>;
  scale: ScaleUnit;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CompanyStatsTable({
  data,
  visibleColumnIds,
  scale,
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

  const thSx = {
    color: 'text.tertiary',
    fontWeight: 600,
    fontSize: '0.7rem',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    bgcolor: 'background.surface',
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
        // sticky header
        '& thead th': { position: 'sticky', top: 0, zIndex: 2 },
      }}
    >
      <Table
        borderAxis="xBetween"
        sx={{
          '--TableCell-paddingX': '14px',
          '--TableCell-paddingY': '10px',
          tableLayout: 'auto',
          minWidth: 900,
        }}
      >
        <thead>
          <tr>
            {/* Fixed company column */}
            <th style={{
              color: 'var(--joy-palette-text-tertiary)',
              fontWeight: 600,
              fontSize: '0.7rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              background: 'var(--joy-palette-background-surface)',
              position: 'sticky',
              left: 0,
              zIndex: 3,
              whiteSpace: 'nowrap',
            }}>
              Ticker
            </th>

            {visibleCols.map(col => (
              <th
                key={col.id}
                onClick={() => handleSort(col.id)}
                style={{
                  textAlign: 'right',
                  background: 'var(--joy-palette-background-surface)',
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
            <tr
              key={company.symbol}
              style={{
                background: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent')}
            >
              {/* Sticky company cell */}
              <td style={{
                position: 'sticky',
                left: 0,
                background: 'var(--joy-palette-background-surface)',
                zIndex: 1,
                padding: '10px 14px',
                borderRight: '1px solid var(--joy-palette-divider)',
                minWidth: 140,
              }}>
                <Box>
                  <Typography level="title-sm" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                    {company.symbol}
                  </Typography>
                  <Typography level="body-xs" sx={{ opacity: 0.5, mt: 0.25 }}>
                    {company.name.split(' ').slice(0, 2).join(' ')}
                  </Typography>
                </Box>
              </td>

              {visibleCols.map(col => {
                const rawVal = company[col.id] as number | undefined;
                const color = col.format !== 'ratio' ? valueColor(rawVal) : 'text.primary';
                return (
                  <td key={col.id} style={{ textAlign: 'right', padding: '10px 14px' }}>
                    <Typography
                      level="body-sm"
                      sx={{ color, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}
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
