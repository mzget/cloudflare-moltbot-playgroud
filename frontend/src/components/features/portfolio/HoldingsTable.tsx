import { fmtNum, fmtPct, fmtShares, gainClass } from '../../../utils/format';
import * as React from 'react';
import {
  Box,
  Sheet,
  Table,
  Typography,
  Link,
  Chip,
  IconButton,
  Stack,
} from '@mui/joy';
import {
  ChevronDown,
  ChevronRight,
  FileBarChart,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { useSettingsStore } from '../../../store/settingsStore';
import { useNavigate } from '@tanstack/react-router';
import type { AnalysisCoverageMap } from '../../../types/analysisCoverage';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Holding {
  symbol: string;
  name: string;
  status: string;
  shares: number;
  last_price: number | null;
  avg_cost: number | null;
  total_cost: number;
  market_value: number | null;
  tot_div_income: number;
  day_gain_pct: number | null;
  day_gain_amt: number | null;
  tot_gain_pct: number | null;
  tot_gain_amt: number | null;
  realized_gain_pct: number | null;
  realized_gain_amt: number | null;
  price_updated_at?: string | number | null;
  stats_updated_at?: string | number | null;
  sector_label?: string | null;
  sector_label_color?: string | null;
}

export interface HoldingsTableProps {
  holdings: Holding[];
  onExpandRow: (symbol: string) => void;
  expandedRows: Set<string>;
  expandedContent?: (symbol: string, lastPrice: number | null, colSpan: number) => React.ReactNode;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (column: string) => void;
  density: 'compact' | 'cozy' | 'comfort';
  analysisCoverage?: AnalysisCoverageMap;
}

// ── Columns spec ──────────────────────────────────────────────────────────────

interface Column {
  key: string;
  label: string;
  align: 'left' | 'right' | 'center';
}

const COLUMNS: Column[] = [
  { key: 'symbol', label: 'Symbol', align: 'left' },
  { key: 'shares', label: 'Shares', align: 'right' },
  { key: 'last_price', label: 'Last Price', align: 'right' },
  { key: 'avg_cost', label: 'AC/Share', align: 'right' },
  { key: 'total_cost', label: 'Total Cost', align: 'right' },
  { key: 'market_value', label: 'Market Value', align: 'right' },
  { key: 'tot_div_income', label: 'Tot Div Income', align: 'right' },
  { key: 'day_gain_pct', label: 'Day Gain (%)', align: 'right' },
  { key: 'day_gain_amt', label: 'Day Gain ($)', align: 'right' },
  { key: 'tot_gain_pct', label: 'Tot Gain (%)', align: 'right' },
  { key: 'tot_gain_amt', label: 'Tot Gain ($)', align: 'right' },
  { key: 'realized_gain_pct', label: 'Realized (%)', align: 'right' },
  { key: 'realized_gain_amt', label: 'Realized ($)', align: 'right' },
];

const TOTAL_COL_SPAN = COLUMNS.length + 1; // +1 for chevron column

// ── Sub-components ────────────────────────────────────────────────────────────

function SortIcon({ dir }: { dir: 'asc' | 'desc' | 'none' }) {
  if (dir === 'asc') return <ArrowUp size={12} style={{ marginLeft: 4, flexShrink: 0 }} />;
  if (dir === 'desc') return <ArrowDown size={12} style={{ marginLeft: 4, flexShrink: 0 }} />;
  return <ArrowUpDown size={12} style={{ marginLeft: 4, flexShrink: 0, opacity: 0.3 }} />;
}

function formatRelativeTime(dateStr?: string | number | null): { text: string; isStale: boolean } {
  if (!dateStr) return { text: '', isStale: false };
  try {
    let ms = 0;
    const num = Number(dateStr);
    if (!isNaN(num) && num > 0) {
      ms = num < 100000000000 ? num * 1000 : num;
    } else {
      const str = String(dateStr);
      const utcStr = str.includes('T') ? str : str.replace(' ', 'T') + 'Z';
      ms = Date.parse(utcStr);
    }
    if (!ms || isNaN(ms)) return { text: '', isStale: false };
    const diffMs = Date.now() - ms;
    const isStale = diffMs > 86400000;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return { text: 'just now', isStale };
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return { text: `${diffMin}m ago`, isStale };
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return { text: `${diffHr}h ago`, isStale };
    const diffDay = Math.floor(diffHr / 24);
    return { text: `${diffDay}d ago`, isStale };
  } catch {
    return { text: '', isStale: false };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HoldingsTable({
  holdings,
  onExpandRow,
  expandedRows,
  expandedContent,
  sortBy,
  sortDir,
  onSort,
  density,
  analysisCoverage,
}: HoldingsTableProps) {
  const navigate = useNavigate();
  const showMoneyValues = useSettingsStore((state) => state.showMoneyValues);
  const displayNum = (v: number | null, decimals = 2) => (showMoneyValues ? fmtNum(v, decimals) : '•••••');
  const displayShares = (v: number | null) => (showMoneyValues ? fmtShares(v) : '•••••');
  const displayPct = (v: number | null) => fmtPct(v);

  const densityStyles = React.useMemo(() => {
    const config = {
      compact: {
        paddingX: '8px',
        paddingY: '5px',
        fontSize: '0.75rem',
        headerSize: '0.65rem',
        chevronSize: 14,
        nameSize: '10px',
        symbolSize: 'body-xs' as const,
        minWidth: 140,
      },
      cozy: {
        paddingX: '12px',
        paddingY: '9px',
        fontSize: '0.8rem',
        headerSize: '0.7rem',
        chevronSize: 16,
        nameSize: '11px',
        symbolSize: 'title-sm' as const,
        minWidth: 160,
      },
      comfort: {
        paddingX: '18px',
        paddingY: '14px',
        fontSize: '0.88rem',
        headerSize: '0.75rem',
        chevronSize: 18,
        nameSize: '12px',
        symbolSize: 'title-sm' as const,
        minWidth: 180,
      },
    };
    return config[density];
  }, [density]);

  const totals = React.useMemo(() => {
    if (holdings.length === 0) return null;

    const totalCost = holdings.reduce((sum, h) => sum + (h.total_cost || 0), 0);
    const totalMarketValue = holdings.reduce((sum, h) => sum + (h.market_value || 0), 0);
    const totalDividends = holdings.reduce((sum, h) => sum + (h.tot_div_income || 0), 0);
    const totalDayGainAmt = holdings.reduce((sum, h) => sum + (h.day_gain_amt || 0), 0);

    const prevMarketValue = totalMarketValue - totalDayGainAmt;
    const totalDayGainPct = prevMarketValue > 0 ? (totalDayGainAmt / prevMarketValue) * 100 : null;

    const totalTotGainAmt = totalMarketValue - totalCost;
    const costForUnrealizedGain = holdings.reduce((sum, h) => (h.market_value !== null ? sum + (h.total_cost || 0) : sum), 0);
    const totalTotGainPct = costForUnrealizedGain > 0 ? (totalTotGainAmt / costForUnrealizedGain) * 100 : null;

    const totalRealizedAmt = holdings.reduce((sum, h) => sum + (h.realized_gain_amt || 0), 0);
    const totalRealizedPct = null;

    return {
      totalCost,
      totalMarketValue,
      totalDividends,
      totalDayGainAmt,
      totalDayGainPct,
      totalTotGainAmt,
      totalTotGainPct,
      totalRealizedAmt,
      totalRealizedPct,
    };
  }, [holdings]);

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
        maxHeight: '75vh',
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
          minWidth: 1100,
          '& thead th': {
            background: '#ffffff',
            borderBottom: '2px solid var(--joy-palette-neutral-outlinedBorder, var(--joy-palette-divider))',
            boxShadow: 'inset 0 -1px 0 var(--joy-palette-divider)',
            '[data-joy-color-scheme="dark"] &': {
              background: '#131313',
            },
          },
          '& tbody tr .sticky-td, & tfoot tr .sticky-td': {
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
            {/* Chevron column */}
            <th
              style={{
                width: 36,
                minWidth: 36,
                maxWidth: 36,
                textAlign: 'center',
                position: 'sticky',
                left: 0,
                zIndex: 3,
              }}
            >
              &nbsp;
            </th>

            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                style={{
                  textAlign: col.align === 'left' ? 'left' : 'right',
                  ...(col.key === 'symbol'
                    ? {
                        position: 'sticky',
                        left: 36,
                        zIndex: 3,
                        borderRight: '1px solid var(--joy-palette-divider)',
                        minWidth: densityStyles.minWidth,
                      }
                    : {}),
                }}
              >
                <Box
                  sx={{
                    ...thSx,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: col.align === 'left' ? 'flex-start' : 'flex-end',
                  }}
                >
                  {col.label}
                  <SortIcon dir={sortBy === col.key ? sortDir : 'none'} />
                </Box>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const coverage = analysisCoverage?.get(h.symbol);

            return (
              <React.Fragment key={h.symbol}>
                {/* Main data row */}
                <tr>
                  {/* Expand Chevron */}
                  <td
                    className="sticky-td"
                    style={{
                      width: 36,
                      minWidth: 36,
                      maxWidth: 36,
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                    }}
                  >
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="neutral"
                      onClick={() => onExpandRow(h.symbol)}
                      aria-label={expandedRows.has(h.symbol) ? 'Collapse' : 'Expand'}
                      sx={{ p: 0.25, minHeight: 'auto', minWidth: 'auto' }}
                    >
                      {expandedRows.has(h.symbol) ? (
                        <ChevronDown size={densityStyles.chevronSize} />
                      ) : (
                        <ChevronRight size={densityStyles.chevronSize} />
                      )}
                    </IconButton>
                  </td>

                  {/* Symbol */}
                  <td
                    className="sticky-td"
                    style={{
                      minWidth: densityStyles.minWidth,
                      position: 'sticky',
                      left: 36,
                      zIndex: 1,
                      borderRight: '1px solid var(--joy-palette-divider)',
                    }}
                  >
                    <Box>
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Link
                          component="button"
                          level={densityStyles.symbolSize}
                          onClick={(e) => {
                            e.preventDefault();
                            navigate({
                              to: '/analysis',
                              search: { symbol: h.symbol, tab: 'report' },
                            });
                          }}
                          sx={{
                            fontWeight: 700,
                            lineHeight: 1.2,
                            fontSize: density === 'compact' ? '0.75rem' : undefined,
                            color: 'primary.plainColor',
                            textDecoration: 'none',
                            textAlign: 'left',
                            justifyContent: 'flex-start',
                            width: 'fit-content',
                            display: 'block',
                            '&:hover': {
                              color: 'primary.hoverColor',
                              textDecoration: 'underline',
                            },
                            transition: 'all 0.15s ease-out',
                          }}
                        >
                          {h.symbol}
                        </Link>

                        {coverage && coverage.count > 0 && (
                          <Chip
                            size="sm"
                            variant="soft"
                            color="primary"
                            startDecorator={<FileBarChart size={12} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              navigate({
                                to: '/analysis',
                                search: { symbol: h.symbol, tab: 'report' },
                              });
                            }}
                            sx={{
                              cursor: 'pointer',
                              fontSize: '10px',
                              fontWeight: 600,
                              px: 0.5,
                              py: 0,
                              height: '18px',
                              minHeight: '18px',
                              '&:hover': { bgcolor: 'primary.softHoverBg' },
                            }}
                          >
                            {coverage.count}
                          </Chip>
                        )}
                      </Stack>
                      <Typography
                        level="body-xs"
                        sx={{
                          mt: 0.2,
                          fontSize: densityStyles.nameSize,
                          opacity: h.sector_label ? 1 : 0.5,
                          color: h.sector_label && h.sector_label_color ? h.sector_label_color : undefined,
                          fontWeight: h.sector_label ? 600 : 400,
                        }}
                      >
                        {h.sector_label || h.name}
                      </Typography>
                    </Box>
                  </td>

                  {/* Shares */}
                  <td style={{ textAlign: 'right' }}>
                    <Typography level="body-sm" sx={{ fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}>
                      {displayShares(h.shares)}
                    </Typography>
                  </td>

                  {/* Last Price */}
                  <td style={{ textAlign: 'right' }}>
                    <Typography level="body-sm" sx={{ fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}>
                      {displayNum(h.last_price)}
                    </Typography>
                    {h.price_updated_at && (() => {
                      const { text, isStale } = formatRelativeTime(h.price_updated_at);
                      return (
                        <Typography level="body-xs" sx={{ color: isStale ? 'danger.plainColor' : 'text.tertiary', fontSize: '0.6rem', lineHeight: 1.2 }}>
                          {text}
                        </Typography>
                      );
                    })()}
                  </td>

                  {/* AC/Share */}
                  <td style={{ textAlign: 'right' }}>
                    <Typography level="body-sm" sx={{ fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}>
                      {displayNum(h.avg_cost)}
                    </Typography>
                  </td>

                  {/* Total Cost */}
                  <td style={{ textAlign: 'right' }}>
                    <Typography level="body-sm" sx={{ fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}>
                      {displayNum(h.total_cost)}
                    </Typography>
                  </td>

                  {/* Market Value */}
                  <td style={{ textAlign: 'right' }}>
                    <Typography level="body-sm" sx={{ fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}>
                      {displayNum(h.market_value)}
                    </Typography>
                  </td>

                  {/* Tot Div Income */}
                  <td style={{ textAlign: 'right' }}>
                    <Typography level="body-sm" sx={{ fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}>
                      {displayNum(h.tot_div_income)}
                    </Typography>
                  </td>

                  {/* Day Gain % */}
                  <td style={{ textAlign: 'right' }}>
                    <Typography
                      level="body-sm"
                      className={gainClass(h.day_gain_pct)}
                      sx={{ fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}
                    >
                      {displayPct(h.day_gain_pct)}
                    </Typography>
                  </td>

                  {/* Day Gain $ */}
                  <td style={{ textAlign: 'right' }}>
                    <Typography
                      level="body-sm"
                      className={gainClass(h.day_gain_amt)}
                      sx={{ fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}
                    >
                      {displayNum(h.day_gain_amt)}
                    </Typography>
                  </td>

                  {/* Tot Gain % */}
                  <td style={{ textAlign: 'right' }}>
                    <Typography
                      level="body-sm"
                      className={gainClass(h.tot_gain_pct)}
                      sx={{ fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}
                    >
                      {displayPct(h.tot_gain_pct)}
                    </Typography>
                  </td>

                  {/* Tot Gain $ */}
                  <td style={{ textAlign: 'right' }}>
                    <Typography
                      level="body-sm"
                      className={gainClass(h.tot_gain_amt)}
                      sx={{ fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}
                    >
                      {displayNum(h.tot_gain_amt)}
                    </Typography>
                  </td>

                  {/* Realized % */}
                  <td style={{ textAlign: 'right' }}>
                    <Typography
                      level="body-sm"
                      className={gainClass(h.realized_gain_pct)}
                      sx={{ fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}
                    >
                      {displayPct(h.realized_gain_pct)}
                    </Typography>
                  </td>

                  {/* Realized $ */}
                  <td style={{ textAlign: 'right' }}>
                    <Typography
                      level="body-sm"
                      className={gainClass(h.realized_gain_amt)}
                      sx={{ fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}
                    >
                      {displayNum(h.realized_gain_amt)}
                    </Typography>
                  </td>
                </tr>

                {/* Expanded sub-section */}
                {expandedRows.has(h.symbol) && (
                  <tr>
                    <td colSpan={TOTAL_COL_SPAN} style={{ padding: '8px 16px', background: 'rgba(0, 0, 0, 0.02)' }}>
                      <Box sx={{ py: 1 }}>
                        {expandedContent ? (
                          expandedContent(h.symbol, h.last_price, TOTAL_COL_SPAN)
                        ) : (
                          <Typography level="body-sm" sx={{ opacity: 0.5 }}>
                            Loading details...
                          </Typography>
                        )}
                      </Box>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}

          {holdings.length === 0 && (
            <tr>
              <td colSpan={TOTAL_COL_SPAN} style={{ textAlign: 'center', padding: '32px 12px' }}>
                <Typography level="body-md" sx={{ opacity: 0.5 }}>
                  No holdings found.
                </Typography>
              </td>
            </tr>
          )}
        </tbody>

        {totals && (
          <tfoot
            style={{
              borderTop: '2px solid var(--joy-palette-divider)',
              fontWeight: 'bold',
            }}
          >
            <tr>
              {/* Chevron column */}
              <td
                className="sticky-td"
                style={{
                  width: 36,
                  minWidth: 36,
                  maxWidth: 36,
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                }}
              ></td>

              {/* Symbol */}
              <td
                className="sticky-td"
                style={{
                  minWidth: densityStyles.minWidth,
                  position: 'sticky',
                  left: 36,
                  zIndex: 1,
                  borderRight: '1px solid var(--joy-palette-divider)',
                }}
              >
                <Typography level="body-sm" sx={{ fontWeight: 700, fontSize: densityStyles.fontSize }}>
                  Total
                </Typography>
              </td>

              {/* Shares */}
              <td></td>

              {/* Last Price */}
              <td></td>

              {/* AC/Share */}
              <td></td>

              {/* Total Cost */}
              <td style={{ textAlign: 'right' }}>
                <Typography level="body-sm" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}>
                  {displayNum(totals.totalCost)}
                </Typography>
              </td>

              {/* Market Value */}
              <td style={{ textAlign: 'right' }}>
                <Typography level="body-sm" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}>
                  {displayNum(totals.totalMarketValue)}
                </Typography>
              </td>

              {/* Tot Div Income */}
              <td style={{ textAlign: 'right' }}>
                <Typography level="body-sm" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}>
                  {displayNum(totals.totalDividends)}
                </Typography>
              </td>

              {/* Day Gain % */}
              <td style={{ textAlign: 'right' }}>
                <Typography
                  level="body-sm"
                  className={gainClass(totals.totalDayGainPct)}
                  sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}
                >
                  {displayPct(totals.totalDayGainPct)}
                </Typography>
              </td>

              {/* Day Gain $ */}
              <td style={{ textAlign: 'right' }}>
                <Typography
                  level="body-sm"
                  className={gainClass(totals.totalDayGainAmt)}
                  sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}
                >
                  {displayNum(totals.totalDayGainAmt)}
                </Typography>
              </td>

              {/* Tot Gain % */}
              <td style={{ textAlign: 'right' }}>
                <Typography
                  level="body-sm"
                  className={gainClass(totals.totalTotGainPct)}
                  sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}
                >
                  {displayPct(totals.totalTotGainPct)}
                </Typography>
              </td>

              {/* Tot Gain $ */}
              <td style={{ textAlign: 'right' }}>
                <Typography
                  level="body-sm"
                  className={gainClass(totals.totalTotGainAmt)}
                  sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}
                >
                  {displayNum(totals.totalTotGainAmt)}
                </Typography>
              </td>

              {/* Realized % */}
              <td style={{ textAlign: 'right' }}>
                <Typography
                  level="body-sm"
                  className={gainClass(totals.totalRealizedPct)}
                  sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}
                >
                  {displayPct(totals.totalRealizedPct)}
                </Typography>
              </td>

              {/* Realized $ */}
              <td style={{ textAlign: 'right' }}>
                <Typography
                  level="body-sm"
                  className={gainClass(totals.totalRealizedAmt)}
                  sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: densityStyles.fontSize }}
                >
                  {displayNum(totals.totalRealizedAmt)}
                </Typography>
              </td>
            </tr>
          </tfoot>
        )}
      </Table>
    </Sheet>
  );
}