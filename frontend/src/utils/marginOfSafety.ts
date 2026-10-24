/**
 * Margin of Safety display/filter helpers (ADR-0014). Pure functions, no React.
 */

export type PriceZone = 'below_bear' | 'bear_to_base' | 'base_to_bull' | 'above_bull';
export type MosFilter = 'all' | 'mos30' | 'mos15' | 'overvalued' | 'unvalued';

export const MOS_FILTER_LABELS: Readonly<Record<MosFilter, string>> = {
  all: 'All',
  mos30: 'MoS ≥ 30%',
  mos15: 'MoS ≥ 15%',
  overvalued: 'Overvalued',
  unvalued: 'Unvalued',
};

export interface MosRow {
  readonly mos_base?: number | null;
  /** false => holding outside the Watchlist => "n/a". Defaults to true (Watchlist rows). */
  readonly in_watchlist?: boolean;
}

const hasMos = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

export function matchesMosFilter(row: MosRow, filter: MosFilter): boolean {
  if (filter === 'all') return true;
  if (row.in_watchlist === false) return false; // n/a never matches MoS-based filters
  const mos = row.mos_base;
  switch (filter) {
    case 'mos30': return hasMos(mos) && mos >= 30;
    case 'mos15': return hasMos(mos) && mos >= 15;
    case 'overvalued': return hasMos(mos) && mos < 0;
    case 'unvalued': return !hasMos(mos);
    default: return true;
  }
}

/** Comparator for MoS values; missing values always sort last regardless of direction. */
export function compareMos(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: 'asc' | 'desc'
): number {
  const aOk = hasMos(a);
  const bOk = hasMos(b);
  if (!aOk && !bOk) return 0;
  if (!aOk) return 1;
  if (!bOk) return -1;
  return dir === 'asc' ? a - b : b - a;
}

export function formatMosLabel(mos: number | null | undefined, inWatchlist = true): string {
  if (!inWatchlist) return 'n/a';
  if (!hasMos(mos)) return 'Unvalued';
  const rounded = mos.toFixed(1);
  return mos > 0 && rounded !== '0.0' ? `+${rounded}%` : `${rounded}%`;
}

export function zoneColor(zone: PriceZone | string | null | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (zone) {
    case 'below_bear': return 'success';
    case 'bear_to_base':
    case 'base_to_bull': return 'warning';
    case 'above_bull': return 'danger';
    default: return 'neutral';
  }
}

export interface RangeBarInput {
  readonly price: number | null | undefined;
  readonly bear: number | null | undefined;
  readonly base: number | null | undefined;
  readonly bull: number | null | undefined;
}

export interface RangeBarLayout {
  readonly bearPct: number | null;
  readonly basePct: number | null;
  readonly bullPct: number | null;
  readonly pricePct: number;
}

const isPos = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Marker positions (0-100%) on a bar spanning all values plus 10% padding. */
export function rangeBarLayout(input: RangeBarInput): RangeBarLayout | null {
  const { price, bear, base, bull } = input;
  if (!isPos(price)) return null;
  const scenarios = [bear, base, bull].filter(isPos);
  if (scenarios.length === 0) return null;

  const all = [...scenarios, price];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || max * 0.2;
  const pad = span * 0.1;
  const lo = min - pad;
  const width = max + pad - lo;
  const pct = (v: number) => ((v - lo) / width) * 100;

  return {
    bearPct: isPos(bear) ? pct(bear) : null,
    basePct: isPos(base) ? pct(base) : null,
    bullPct: isPos(bull) ? pct(bull) : null,
    pricePct: pct(price),
  };
}
