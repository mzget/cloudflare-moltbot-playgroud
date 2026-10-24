import { describe, it, expect, vi } from 'vitest';
import { computeMarginOfSafety, refreshMarginOfSafety, type MosDatabase } from './marginOfSafety';

describe('computeMarginOfSafety', () => {
  it('computes MoS against intrinsic value (not price)', () => {
    const r = computeMarginOfSafety({ price: 70, bear: 50, base: 100, bull: 150 });
    expect(r.mosBase).toBeCloseTo(30);
    expect(r.mosBear).toBeCloseTo(-40);
    expect(r.mosBull).toBeCloseTo(53.333, 2);
  });

  it('returns negative MoS when overvalued', () => {
    expect(computeMarginOfSafety({ price: 125, bear: null, base: 100, bull: null }).mosBase).toBeCloseTo(-25);
  });

  it('is Unvalued (null, never 0) when Base Case is missing', () => {
    const r = computeMarginOfSafety({ price: 70, bear: 50, base: null, bull: 150 });
    expect(r.mosBase).toBeNull();
    expect(r.zone).toBeNull();
  });

  it.each([null, undefined, 0, -5, NaN])('returns nulls for invalid price %s', (price) => {
    const r = computeMarginOfSafety({ price: price as any, bear: 50, base: 100, bull: 150 });
    expect(r).toEqual({ mosBase: null, mosBear: null, mosBull: null, zone: null });
  });

  it('treats non-positive intrinsic values as missing', () => {
    const r = computeMarginOfSafety({ price: 70, bear: 0, base: -1, bull: 150 });
    expect(r.mosBase).toBeNull();
    expect(r.mosBear).toBeNull();
    expect(r.mosBull).not.toBeNull();
  });

  it('has no zone when only Base is saved but still gives MoS', () => {
    const r = computeMarginOfSafety({ price: 80, bear: null, base: 100, bull: null });
    expect(r.mosBase).toBeCloseTo(20);
    expect(r.zone).toBeNull();
  });

  describe('price zones', () => {
    const s = { bear: 50, base: 100, bull: 150 };
    it('below_bear', () => expect(computeMarginOfSafety({ price: 40, ...s }).zone).toBe('below_bear'));
    it('bear_to_base', () => expect(computeMarginOfSafety({ price: 75, ...s }).zone).toBe('bear_to_base'));
    it('base_to_bull', () => expect(computeMarginOfSafety({ price: 120, ...s }).zone).toBe('base_to_bull'));
    it('above_bull', () => expect(computeMarginOfSafety({ price: 151, ...s }).zone).toBe('above_bull'));
    it('boundaries: price == bear is bear_to_base, == base is base_to_bull, == bull is base_to_bull', () => {
      expect(computeMarginOfSafety({ price: 50, ...s }).zone).toBe('bear_to_base');
      expect(computeMarginOfSafety({ price: 100, ...s }).zone).toBe('base_to_bull');
      expect(computeMarginOfSafety({ price: 150, ...s }).zone).toBe('base_to_bull');
    });
    it('sorts defensively when Bear > Base (does not throw)', () => {
      const r = computeMarginOfSafety({ price: 75, bear: 100, base: 50, bull: 150 });
      expect(r.zone).toBe('bear_to_base');
      expect(r.mosBase).toBeCloseTo(-50);
    });
  });
});

function makeDb(opts: { dcf: any[]; prices: any[] }) {
  const batches: any[][] = [];
  const queries: string[] = [];
  const db: MosDatabase = {
    prepare: (sql: string) => {
      const stmt: any = {
        sql,
        args: [] as any[],
        bind: (...a: any[]) => { stmt.args = a; return stmt; },
        all: async () => {
          queries.push(sql);
          return { results: sql.includes('dcf_calculations') ? opts.dcf : opts.prices };
        },
      };
      return stmt;
    },
    batch: vi.fn(async (stmts: any[]) => { batches.push(stmts); return []; }),
  } as any;
  return { db, batches, queries };
}

describe('refreshMarginOfSafety', () => {
  it('does nothing for an empty symbol list', async () => {
    const { db, queries } = makeDb({ dcf: [], prices: [] });
    await refreshMarginOfSafety(db, []);
    expect(queries).toHaveLength(0);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('writes MoS columns with one batch for many symbols (no per-symbol selects)', async () => {
    const { db, batches, queries } = makeDb({
      dcf: [
        { symbol: 'AAA', scenario_name: 'Base Case', implied_share_price: 100 },
        { symbol: 'AAA', scenario_name: 'Bear Case', implied_share_price: 50 },
        { symbol: 'AAA', scenario_name: 'Bull Case', implied_share_price: 150 },
      ],
      prices: [{ symbol: 'AAA', price: 70 }, { symbol: 'BBB', price: 10 }],
    });
    await refreshMarginOfSafety(db, ['aaa', 'BBB']);
    expect(queries).toHaveLength(2);
    expect(batches).toHaveLength(1);
    const [a, b] = batches[0];
    expect(a.args[0]).toBe(50); // dcf_bear
    expect(a.args[1]).toBe(100); // dcf_base
    expect(a.args[2]).toBe(150); // dcf_bull
    expect(a.args[3]).toBeCloseTo(30); // mos_base
    expect(a.args[4]).toBe('bear_to_base');
    expect(a.args[a.args.length - 1]).toBe('AAA');
    // BBB: no DCF saved -> everything null
    expect(b.args.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(b.args[b.args.length - 1]).toBe('BBB');
  });

  it('stores null MoS when price is missing', async () => {
    const { db, batches } = makeDb({
      dcf: [{ symbol: 'AAA', scenario_name: 'Base Case', implied_share_price: 100 }],
      prices: [{ symbol: 'AAA', price: null }],
    });
    await refreshMarginOfSafety(db, ['AAA']);
    const a = batches[0][0];
    expect(a.args[1]).toBe(100);
    expect(a.args[3]).toBeNull();
  });

  it('chunks large symbol lists to respect D1 bound-parameter limits', async () => {
    const symbols = Array.from({ length: 130 }, (_, i) => `S${i}`);
    const { db, queries } = makeDb({ dcf: [], prices: [] });
    await refreshMarginOfSafety(db, symbols);
    expect(queries.length).toBe(6); // 3 chunks x 2 selects
  });
});
