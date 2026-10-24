import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchAndStoreMarketStats } from './marketData';

const nowDb = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function makeEnv(opts: { quote: any; failBatchOnMos?: boolean }) {
  const prepared: { sql: string; args: any[] }[] = [];
  const batches: any[][] = [];
  const DB = {
    prepare: (sql: string) => {
      const stmt: any = {
        sql,
        args: [] as any[],
        bind: (...a: any[]) => { stmt.args = a; prepared.push({ sql, args: a }); return stmt; },
        all: async () => {
          if (sql.includes('FROM watchlist w')) {
            return { results: [{ symbol: 'AAA', updated_at: nowDb(), price_updated_at: null, market_cap: 1 }] };
          }
          if (sql.includes('FROM dcf_calculations')) {
            return { results: [{ symbol: 'AAA', scenario_name: 'Base Case', implied_share_price: 100 }] };
          }
          if (sql.includes('FROM market_stats WHERE symbol IN')) {
            return { results: [{ symbol: 'AAA', price: 70 }] };
          }
          return { results: [] };
        },
      };
      return stmt;
    },
    batch: vi.fn(async (stmts: any[]) => {
      batches.push(stmts);
      if (opts.failBatchOnMos && stmts.some((s) => s.sql.includes('UPDATE market_stats'))) {
        throw new Error('mos batch failed');
      }
      return [];
    }),
  };
  return { env: { DB, FINNHUB_API_KEY: 'k' } as any, prepared, batches };
}

describe('fetchAndStoreMarketStats - Margin of Safety refresh (ADR-0014)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refreshes MoS once, in its own batch, for symbols that got a price', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ c: 70, pc: 69, h: 71, l: 68, o: 69 }) }));
    const { env, batches } = makeEnv({ quote: null });
    const results = await fetchAndStoreMarketStats(env, { priceOnly: true, force: true });

    expect(results).toEqual([{ symbol: 'AAA', success: true, price: 70, error: null }]);
    const mosBatches = batches.filter((b) => b.some((s) => s.sql.includes('UPDATE market_stats')));
    expect(mosBatches).toHaveLength(1);
    const update = mosBatches[0][0];
    expect(update.args[1]).toBe(100); // dcf_base
    expect(update.args[3]).toBeCloseTo(30); // mos_base = (100-70)/100
    expect(update.args[update.args.length - 1]).toBe('AAA');
  });

  it('skips the MoS refresh when no symbol got a price (quote error)', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 429, statusText: 'Too Many', json: async () => ({}) }));
    const { env, batches } = makeEnv({ quote: null });
    const results = await fetchAndStoreMarketStats(env, { priceOnly: true, force: true });

    expect(results[0].price ?? null).toBeNull();
    expect(batches.some((b) => b.some((s) => s.sql.includes('UPDATE market_stats')))).toBe(false);
  });

  it('does not fail the sync when the MoS refresh throws', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ c: 70, pc: 69, h: 71, l: 68, o: 69 }) }));
    const { env } = makeEnv({ quote: null, failBatchOnMos: true });
    const results = await fetchAndStoreMarketStats(env, { priceOnly: true, force: true });
    expect(results[0].success).toBe(true);
  });
});
