import { describe, it, expect } from 'vitest';
import {
  matchesMosFilter,
  compareMos,
  formatMosLabel,
  rangeBarLayout,
  zoneColor,
} from './marginOfSafety';

describe('matchesMosFilter', () => {
  const v = (mos_base: number | null | undefined, in_watchlist = true) => ({ mos_base, in_watchlist });

  it('all matches everything, including n/a and Unvalued', () => {
    expect(matchesMosFilter(v(null), 'all')).toBe(true);
    expect(matchesMosFilter(v(10, false), 'all')).toBe(true);
  });
  it('mos30 / mos15 are inclusive thresholds', () => {
    expect(matchesMosFilter(v(30), 'mos30')).toBe(true);
    expect(matchesMosFilter(v(29.9), 'mos30')).toBe(false);
    expect(matchesMosFilter(v(15), 'mos15')).toBe(true);
    expect(matchesMosFilter(v(14.9), 'mos15')).toBe(false);
    expect(matchesMosFilter(v(40), 'mos15')).toBe(true);
  });
  it('overvalued means MoS < 0 (0% is not overvalued)', () => {
    expect(matchesMosFilter(v(-0.1), 'overvalued')).toBe(true);
    expect(matchesMosFilter(v(0), 'overvalued')).toBe(false);
  });
  it('unvalued = in watchlist with no MoS', () => {
    expect(matchesMosFilter(v(null), 'unvalued')).toBe(true);
    expect(matchesMosFilter(v(undefined), 'unvalued')).toBe(true);
    expect(matchesMosFilter(v(10), 'unvalued')).toBe(false);
  });
  it('n/a rows (not in watchlist) never match MoS-based filters, including unvalued', () => {
    for (const f of ['mos30', 'mos15', 'overvalued', 'unvalued'] as const) {
      expect(matchesMosFilter(v(null, false), f)).toBe(false);
      expect(matchesMosFilter(v(50, false), f)).toBe(false);
    }
  });
});

describe('compareMos', () => {
  it('sorts descending by MoS with null/undefined last', () => {
    const rows = [{ m: null }, { m: 10 }, { m: undefined }, { m: 40 }, { m: -5 }];
    const sorted = [...rows].sort((a, b) => compareMos(a.m, b.m, 'desc'));
    expect(sorted.map((r) => r.m)).toEqual([40, 10, -5, null, undefined]);
  });
  it('sorts ascending with null last', () => {
    const rows = [{ m: null }, { m: 10 }, { m: -5 }];
    const sorted = [...rows].sort((a, b) => compareMos(a.m, b.m, 'asc'));
    expect(sorted.map((r) => r.m)).toEqual([-5, 10, null]);
  });
  it('treats two missing values as equal', () => {
    expect(compareMos(null, undefined, 'asc')).toBe(0);
  });
});

describe('formatMosLabel', () => {
  it('formats signed percentages', () => {
    expect(formatMosLabel(30.04, true)).toBe('+30.0%');
    expect(formatMosLabel(-12.345, true)).toBe('-12.3%');
    expect(formatMosLabel(0, true)).toBe('0.0%');
  });
  it('Unvalued for watchlist stock without MoS', () => {
    expect(formatMosLabel(null, true)).toBe('Unvalued');
  });
  it('n/a for holdings outside the watchlist', () => {
    expect(formatMosLabel(null, false)).toBe('n/a');
    expect(formatMosLabel(25, false)).toBe('n/a');
  });
});

describe('rangeBarLayout', () => {
  it('returns null without a price or without any scenario', () => {
    expect(rangeBarLayout({ price: null, bear: 1, base: 2, bull: 3 })).toBeNull();
    expect(rangeBarLayout({ price: 10, bear: null, base: null, bull: null })).toBeNull();
  });
  it('positions markers proportionally with padding, within 0-100', () => {
    const l = rangeBarLayout({ price: 100, bear: 50, base: 100, bull: 150 })!;
    for (const p of [l.bearPct, l.basePct, l.bullPct, l.pricePct]) {
      expect(p).not.toBeNull();
      expect(p!).toBeGreaterThanOrEqual(0);
      expect(p!).toBeLessThanOrEqual(100);
    }
    expect(l.bearPct!).toBeLessThan(l.basePct!);
    expect(l.basePct!).toBeLessThan(l.bullPct!);
    expect(l.pricePct).toBeCloseTo(l.basePct!, 5);
  });
  it('keeps price on-bar when far outside the scenario range', () => {
    const l = rangeBarLayout({ price: 1000, bear: 50, base: 100, bull: 150 })!;
    expect(l.pricePct).toBeLessThanOrEqual(100);
    expect(l.bullPct!).toBeLessThan(l.pricePct!);
  });
  it('omits missing scenario markers (null) and works with only base', () => {
    const l = rangeBarLayout({ price: 80, bear: null, base: 100, bull: null })!;
    expect(l.bearPct).toBeNull();
    expect(l.bullPct).toBeNull();
    expect(l.basePct).not.toBeNull();
  });
  it('does not divide by zero when all values are equal', () => {
    const l = rangeBarLayout({ price: 100, bear: 100, base: 100, bull: 100 })!;
    expect(Number.isFinite(l.basePct!)).toBe(true);
    expect(Number.isFinite(l.pricePct!)).toBe(true);
  });
});

describe('zoneColor', () => {
  it('maps zones to Joy palette colors, neutral when unknown', () => {
    expect(zoneColor('below_bear')).toBe('success');
    expect(zoneColor('bear_to_base')).toBe('warning');
    expect(zoneColor('base_to_bull')).toBe('warning');
    expect(zoneColor('above_bull')).toBe('danger');
    expect(zoneColor(null)).toBe('neutral');
  });
});
