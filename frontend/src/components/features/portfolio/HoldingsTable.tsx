import * as React from 'react';
import { Box, Typography, Sheet } from '@mui/joy';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';
import '../../../styles/yahooPortfolio.css';

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
}

export interface HoldingsTableProps {
  holdings: Holding[];
  onExpandRow: (symbol: string) => void;
  expandedRows: Set<string>;
  expandedContent?: (symbol: string, lastPrice: number | null, colSpan: number) => React.ReactNode;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (column: string) => void;
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

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtNum(v: number | null, decimals = 2): string {
  if (v === null || v === undefined) return '--';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return '--';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function gainClass(v: number | null): string {
  if (v === null || v === undefined) return '';
  if (v > 0) return 'yf-positive';
  if (v < 0) return 'yf-negative';
  return '';
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
}: HoldingsTableProps) {
  const sortArrow = (col: string) => {
    if (sortBy !== col) return null;
    return <span className="sort-arrow">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <Sheet sx={{ ...glassStyle, p: 0, overflow: 'hidden' }}>
      <div className="yf-table-wrap">
        <table className="yf-table">
          <thead>
            <tr>
              {/* Chevron column */}
              <th className="center" style={{ width: 36 }}>&nbsp;</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={col.align}
                  onClick={() => onSort(col.key)}
                >
                  {col.label}
                  {sortArrow(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => (
              <React.Fragment key={h.symbol}>
                {/* Main data row */}
                <tr>
                  <td className="center">
                    <button
                      className="yf-chevron"
                      onClick={() => onExpandRow(h.symbol)}
                      aria-label={expandedRows.has(h.symbol) ? 'Collapse' : 'Expand'}
                    >
                      {expandedRows.has(h.symbol)
                        ? <ChevronDown size={14} />
                        : <ChevronRight size={14} />}
                    </button>
                  </td>

                  {/* Symbol */}
                  <td className="left">
                    <a
                      className="yf-symbol-link"
                      href={`https://finance.yahoo.com/quote/${h.symbol}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {h.symbol}
                    </a>
                    <br />
                    <span style={{ fontSize: 11, color: 'var(--yf-text-secondary)' }}>
                      {h.name}
                    </span>
                  </td>

                  {/* Shares */}
                  <td>{fmtNum(h.shares, 0)}</td>

                  {/* Last Price */}
                  <td>{fmtNum(h.last_price)}</td>

                  {/* AC/Share */}
                  <td>{fmtNum(h.avg_cost)}</td>

                  {/* Total Cost */}
                  <td>{fmtNum(h.total_cost)}</td>

                  {/* Market Value */}
                  <td>{fmtNum(h.market_value)}</td>

                  {/* Tot Div Income */}
                  <td>{fmtNum(h.tot_div_income)}</td>

                  {/* Day Gain % */}
                  <td className={gainClass(h.day_gain_pct)}>{fmtPct(h.day_gain_pct)}</td>

                  {/* Day Gain $ */}
                  <td className={gainClass(h.day_gain_amt)}>{fmtNum(h.day_gain_amt)}</td>

                  {/* Tot Gain % */}
                  <td className={gainClass(h.tot_gain_pct)}>{fmtPct(h.tot_gain_pct)}</td>

                  {/* Tot Gain $ */}
                  <td className={gainClass(h.tot_gain_amt)}>{fmtNum(h.tot_gain_amt)}</td>

                  {/* Realized % */}
                  <td className={gainClass(h.realized_gain_pct)}>{fmtPct(h.realized_gain_pct)}</td>

                  {/* Realized $ */}
                  <td className={gainClass(h.realized_gain_amt)}>{fmtNum(h.realized_gain_amt)}</td>
                </tr>

                {/* Expanded sub-section */}
                {expandedRows.has(h.symbol) && (
                  <tr className="yf-expanded">
                    <td colSpan={TOTAL_COL_SPAN}>
                      <div className="yf-expanded-inner">
                        {expandedContent
                          ? expandedContent(h.symbol, h.last_price, TOTAL_COL_SPAN)
                          : (
                            <Typography level="body-sm" sx={{ opacity: 0.5 }}>
                              Loading details...
                            </Typography>
                          )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}

            {holdings.length === 0 && (
              <tr>
                <td colSpan={TOTAL_COL_SPAN} className="center" style={{ padding: '32px 12px' }}>
                  <Typography level="body-md" sx={{ opacity: 0.5 }}>
                    No holdings found.
                  </Typography>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Sheet>
  );
}