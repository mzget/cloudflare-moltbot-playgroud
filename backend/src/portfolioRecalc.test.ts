import { describe, it, expect } from 'vitest';
import { recalcHoldings, rebuildLotsAndRealizedGains } from './portfolioRecalc';

type Tx = { id: number; symbol: string; date: string; type: string; shares: any; cost_per_share: any; commission?: any; total_cost: number; note?: string | null; realized_gain_amt: number | null; realized_gain_pct: number | null };
type Lot = { id: number; symbol: string; date: string; shares: number; cost_per_share: number; total_cost: number; note: string | null };

/** Minimal stateful in-memory fake of the D1 tables touched by portfolioRecalc. */
function createFakeDb(seedTx: Partial<Tx>[] = [], seedLots: Partial<Lot>[] = []) {
  const state = {
    transactions: seedTx.map((t, i) => ({ id: i + 1, type: 'Buy', commission: 0, realized_gain_amt: null, realized_gain_pct: null, note: null, ...t })) as Tx[],
    lots: seedLots.map((l, i) => ({ id: i + 1, note: null, ...l })) as Lot[],
    holdings: new Map<string, { shares: number; avg_cost: number; total_cost: number; status: string }>(),
    watchlist: new Set<string>(),
    nextLotId: 1000,
  };

  const exec = (rawSql: string, a: any[]) => {
    const sql = rawSql.replace(/\s+/g, ' ').trim();
    if (sql.startsWith('SELECT COUNT(*) as count FROM transactions')) return { first: { count: state.transactions.filter((t) => t.symbol === a[0]).length } };
    if (sql.startsWith('DELETE FROM holdings')) { state.holdings.delete(a[0]); return {}; }
    if (sql.includes('SUM(shares) as total_shares')) {
      const ls = state.lots.filter((l) => l.symbol === a[0]);
      return { all: [{ total_shares: ls.reduce((s, l) => s + l.shares, 0), total_cost: ls.reduce((s, l) => s + l.total_cost, 0) }] };
    }
    if (sql.startsWith('INSERT INTO holdings')) { state.holdings.set(a[0], { shares: a[1], avg_cost: a[2], total_cost: a[3], status: a[4] }); return {}; }
    if (sql.startsWith('INSERT OR IGNORE INTO watchlist')) { state.watchlist.add(a[0]); return {}; }
    if (sql.startsWith('DELETE FROM share_lots WHERE symbol')) { state.lots = state.lots.filter((l) => l.symbol !== a[0]); return {}; }
    if (sql.startsWith('DELETE FROM share_lots WHERE id')) { state.lots = state.lots.filter((l) => l.id !== a[0]); return {}; }
    if (sql.startsWith('UPDATE transactions SET realized_gain_amt = NULL')) {
      state.transactions.filter((t) => t.symbol === a[0] && t.type === 'Sell').forEach((t) => { t.realized_gain_amt = null; t.realized_gain_pct = null; });
      return {};
    }
    if (sql.startsWith('SELECT * FROM transactions')) {
      return { all: state.transactions.filter((t) => t.symbol === a[0]).sort((x, y) => x.date.localeCompare(y.date) || x.id - y.id) };
    }
    if (sql.startsWith('INSERT INTO share_lots')) {
      state.lots.push({ id: state.nextLotId++, symbol: a[0], date: a[1], shares: a[2], cost_per_share: a[3], total_cost: a[4], note: a[5] });
      return {};
    }
    if (sql.startsWith('SELECT * FROM share_lots')) {
      return { all: state.lots.filter((l) => l.symbol === a[0] && l.shares > 0).sort((x, y) => x.date.localeCompare(y.date) || x.id - y.id) };
    }
    if (sql.startsWith('UPDATE transactions SET realized_gain_amt = COALESCE')) {
      const t = state.transactions.find((x) => x.id === a[2])!;
      t.realized_gain_amt = (t.realized_gain_amt ?? 0) + a[0];
      t.realized_gain_pct = a[1];
      return {};
    }
    if (sql.startsWith('UPDATE share_lots SET shares')) {
      const l = state.lots.find((x) => x.id === a[2])!;
      l.shares = a[0]; l.total_cost = a[1];
      return {};
    }
    throw new Error('Unhandled SQL in fake db: ' + sql);
  };

  const db = {
    prepare: (sql: string) => {
      let args: any[] = [];
      const stmt: any = {
        bind: (...a: any[]) => { args = a; return stmt; },
        first: async () => exec(sql, args).first ?? null,
        all: async () => ({ results: exec(sql, args).all ?? [] }),
        run: async () => { exec(sql, args); return { success: true }; },
      };
      return stmt;
    },
  };
  return { db, state };
}

describe('recalcHoldings', () => {
  it('deletes the holding when the symbol has no transactions', async () => {
    const { db, state } = createFakeDb();
    state.holdings.set('AAPL', { shares: 1, avg_cost: 1, total_cost: 1, status: 'Open' });
    await recalcHoldings(db, 'AAPL');
    expect(state.holdings.has('AAPL')).toBe(false);
  });

  it('upserts an Open holding with average cost and adds symbol to watchlist', async () => {
    const { db, state } = createFakeDb(
      [{ symbol: 'AAPL', date: '2026-01-01' }],
      [{ symbol: 'AAPL', date: '2026-01-01', shares: 10, cost_per_share: 10, total_cost: 100 }, { symbol: 'AAPL', date: '2026-02-01', shares: 10, cost_per_share: 20, total_cost: 200 }],
    );
    await recalcHoldings(db, 'AAPL');
    expect(state.holdings.get('AAPL')).toEqual({ shares: 20, avg_cost: 15, total_cost: 300, status: 'Open' });
    expect(state.watchlist.has('AAPL')).toBe(true);
  });

  it('marks holding Closed with zero avg cost when no lots remain but transactions exist', async () => {
    const { db, state } = createFakeDb([{ symbol: 'AAPL', date: '2026-01-01' }], []);
    await recalcHoldings(db, 'AAPL');
    expect(state.holdings.get('AAPL')).toEqual({ shares: 0, avg_cost: 0, total_cost: 0, status: 'Closed' });
  });
});

describe('rebuildLotsAndRealizedGains', () => {
  it('uppercases the symbol and clears holdings when there are no transactions', async () => {
    const { db, state } = createFakeDb();
    state.holdings.set('AAPL', { shares: 1, avg_cost: 1, total_cost: 1, status: 'Open' });
    await rebuildLotsAndRealizedGains(db, 'aapl');
    expect(state.holdings.has('AAPL')).toBe(false);
    expect(state.lots).toHaveLength(0);
  });

  it('creates a lot per Buy and parses string numerics', async () => {
    const { db, state } = createFakeDb([{ symbol: 'AAPL', date: '2026-01-01', shares: '10', cost_per_share: '10', total_cost: 100 }]);
    await rebuildLotsAndRealizedGains(db, 'AAPL');
    expect(state.lots).toHaveLength(1);
    expect(state.lots[0]).toMatchObject({ shares: 10, cost_per_share: 10, total_cost: 100 });
    expect(state.holdings.get('AAPL')).toMatchObject({ shares: 10, avg_cost: 10, status: 'Open' });
  });

  it('computes realized gain for a partial sell and leaves the remaining lot', async () => {
    const { db, state } = createFakeDb([
      { id: 1, symbol: 'AAPL', date: '2026-01-01', type: 'Buy', shares: 10, cost_per_share: 10, total_cost: 100 },
      { id: 2, symbol: 'AAPL', date: '2026-02-01', type: 'Sell', shares: 4, cost_per_share: 15, total_cost: 60 },
    ]);
    await rebuildLotsAndRealizedGains(db, 'AAPL');
    const sell = state.transactions.find((t) => t.id === 2)!;
    expect(sell.realized_gain_amt).toBeCloseTo(20);
    expect(sell.realized_gain_pct).toBeCloseTo(50);
    expect(state.lots).toHaveLength(1);
    expect(state.lots[0]).toMatchObject({ shares: 6, total_cost: 60 });
    expect(state.holdings.get('AAPL')).toMatchObject({ shares: 6, avg_cost: 10, status: 'Open' });
  });

  it('deducts lots FIFO across multiple lots and applies commission proportionally', async () => {
    const { db, state } = createFakeDb([
      { id: 1, symbol: 'AAPL', date: '2026-01-01', type: 'Buy', shares: 10, cost_per_share: 10, total_cost: 100 },
      { id: 2, symbol: 'AAPL', date: '2026-02-01', type: 'Buy', shares: 10, cost_per_share: 20, total_cost: 200 },
      { id: 3, symbol: 'AAPL', date: '2026-03-01', type: 'Sell', shares: 15, cost_per_share: 30, commission: 3, total_cost: 0 },
    ]);
    await rebuildLotsAndRealizedGains(db, 'AAPL');
    // lot1: 10*30 - 2 - 100 = 198 ; lot2 partial 5: 5*30 - 1 - 100 = 49
    expect(state.transactions.find((t) => t.id === 3)!.realized_gain_amt).toBeCloseTo(247);
    expect(state.lots).toHaveLength(1);
    expect(state.lots[0]).toMatchObject({ shares: 5, total_cost: 100 });
    expect(state.holdings.get('AAPL')).toMatchObject({ shares: 5, avg_cost: 20, status: 'Open' });
  });

  it('closes the position when all shares are sold', async () => {
    const { db, state } = createFakeDb([
      { id: 1, symbol: 'AAPL', date: '2026-01-01', type: 'Buy', shares: 10, cost_per_share: 10, total_cost: 100 },
      { id: 2, symbol: 'AAPL', date: '2026-02-01', type: 'Sell', shares: 10, cost_per_share: 12, total_cost: 120 },
    ]);
    await rebuildLotsAndRealizedGains(db, 'AAPL');
    expect(state.lots).toHaveLength(0);
    expect(state.holdings.get('AAPL')).toMatchObject({ shares: 0, status: 'Closed' });
    expect(state.transactions.find((t) => t.id === 2)!.realized_gain_amt).toBeCloseTo(20);
  });

  it('resets stale realized gains before recalculating and is idempotent', async () => {
    const { db, state } = createFakeDb([
      { id: 1, symbol: 'AAPL', date: '2026-01-01', type: 'Buy', shares: 10, cost_per_share: 10, total_cost: 100 },
      { id: 2, symbol: 'AAPL', date: '2026-02-01', type: 'Sell', shares: 5, cost_per_share: 20, total_cost: 100, realized_gain_amt: 9999, realized_gain_pct: 9999 },
    ]);
    await rebuildLotsAndRealizedGains(db, 'AAPL');
    await rebuildLotsAndRealizedGains(db, 'AAPL');
    expect(state.transactions.find((t) => t.id === 2)!.realized_gain_amt).toBeCloseTo(50);
    expect(state.lots).toHaveLength(1);
  });

  it('does not touch other symbols', async () => {
    const { db, state } = createFakeDb(
      [{ id: 1, symbol: 'AAPL', date: '2026-01-01', shares: 10, cost_per_share: 10, total_cost: 100 }],
      [{ symbol: 'MSFT', date: '2026-01-01', shares: 3, cost_per_share: 5, total_cost: 15 }],
    );
    await rebuildLotsAndRealizedGains(db, 'AAPL');
    expect(state.lots.filter((l) => l.symbol === 'MSFT')).toHaveLength(1);
  });
});
