/**
 * Margin of Safety (MoS) — ADR-0014.
 * MoS % = (Intrinsic - Price) / Intrinsic * 100, anchored on the saved Base Case.
 */

export type PriceZone = 'below_bear' | 'bear_to_base' | 'base_to_bull' | 'above_bull';

export interface MosInput {
  readonly price: number | null | undefined;
  readonly bear: number | null | undefined;
  readonly base: number | null | undefined;
  readonly bull: number | null | undefined;
}

export interface MosResult {
  readonly mosBase: number | null;
  readonly mosBear: number | null;
  readonly mosBull: number | null;
  readonly zone: PriceZone | null;
}

const isPositive = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

const mos = (price: number, intrinsic: number | null | undefined): number | null =>
  isPositive(intrinsic) ? ((intrinsic - price) / intrinsic) * 100 : null;

/**
 * Pure MoS + price zone calculation.
 * - Invalid/missing price -> everything null.
 * - Missing Base -> Unvalued (mosBase null, never 0) and no zone.
 * - Zone requires all three scenarios; values are sorted defensively so a mis-ordered
 *   Bear/Base/Bull never throws.
 */
export function computeMarginOfSafety(input: MosInput): MosResult {
  const { price, bear, base, bull } = input;
  if (!isPositive(price)) return { mosBase: null, mosBear: null, mosBull: null, zone: null };

  const mosBase = mos(price, base);
  const mosBear = mos(price, bear);
  const mosBull = mos(price, bull);

  let zone: PriceZone | null = null;
  if (isPositive(bear) && isPositive(base) && isPositive(bull)) {
    const [lo, mid, hi] = [bear, base, bull].sort((a, b) => a - b);
    if (price < lo) zone = 'below_bear';
    else if (price < mid) zone = 'bear_to_base';
    else if (price <= hi) zone = 'base_to_bull';
    else zone = 'above_bull';
  }

  return { mosBase, mosBear, mosBull, zone };
}

// ─── Persistence (denormalized onto market_stats) ──────────────────────────

/** Minimal structural subset of D1Database so this package stays free of Workers types. */
export interface MosStatement {
  bind(...values: unknown[]): MosStatement;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
}
export interface MosDatabase {
  prepare(sql: string): MosStatement;
  batch(statements: MosStatement[]): Promise<unknown>;
}

import { resolveDcfScenarios, DcfRow } from './dcfScenarios';

// Stay well under D1's bound-parameter limit (100) per statement.
const SYMBOL_CHUNK_SIZE = 50;

const chunk = <T>(items: ReadonlyArray<T>, size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

/**
 * Recomputes dcf_bear/base/bull, mos_base, price_zone, mos_updated_at on market_stats
 * for the given symbols: 2 SELECTs per chunk of symbols + 1 batched UPDATE (no per-symbol queries).
 */
export async function refreshMarginOfSafety(db: MosDatabase, symbols: ReadonlyArray<string>): Promise<void> {
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  if (unique.length === 0) return;

  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

  for (const group of chunk(unique, SYMBOL_CHUNK_SIZE)) {
    const placeholders = group.map(() => '?').join(',');
    const [dcfRes, priceRes] = await Promise.all([
      db.prepare(
        `SELECT symbol, scenario_name, implied_share_price FROM dcf_calculations
         WHERE symbol IN (${placeholders}) AND scenario_name IN ('Bear Case','Base Case','Bull Case')
         ORDER BY created_at ASC`
      ).bind(...group).all<{ symbol: string; scenario_name: string; implied_share_price: number | null }>(),
      db.prepare(`SELECT symbol, price FROM market_stats WHERE symbol IN (${placeholders})`)
        .bind(...group).all<{ symbol: string; price: number | null }>(),
    ]);

    const rowsBySymbol = new Map<string, DcfRow[]>();
    for (const row of dcfRes.results ?? []) {
      const existing = rowsBySymbol.get(row.symbol);
      if (existing) {
        existing.push(row);
      } else {
        rowsBySymbol.set(row.symbol, [row]);
      }
    }
    const prices = new Map<string, number | null>(
      (priceRes.results ?? []).map((r) => [r.symbol, r.price ?? null])
    );

    const updates = group.map((symbol) => {
      const sc = resolveDcfScenarios(rowsBySymbol.get(symbol) ?? []);
      const result = computeMarginOfSafety({
        price: prices.get(symbol),
        bear: sc.bear,
        base: sc.base,
        bull: sc.bull,
      });
      return db.prepare(
        `UPDATE market_stats
         SET dcf_bear = ?, dcf_base = ?, dcf_bull = ?, mos_base = ?, price_zone = ?, mos_updated_at = ?
         WHERE symbol = ?`
      ).bind(sc.bear, sc.base, sc.bull, result.mosBase, result.zone, nowStr, symbol);
    });
    await db.batch(updates);
  }
}
