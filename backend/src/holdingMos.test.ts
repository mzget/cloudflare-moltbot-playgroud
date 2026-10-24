import { describe, it, expect } from 'vitest';
import { holdingMosFields } from './holdingMos';

describe('holdingMosFields', () => {
  it('returns n/a (in_watchlist=false, mos null) for holdings outside the watchlist', () => {
    expect(holdingMosFields({ in_watchlist: 0, mos_base: 12, dcf_base: 100, price_zone: 'bear_to_base' })).toEqual({
      in_watchlist: false, dcf_bear: null, dcf_base: null, dcf_bull: null, mos_base: null, price_zone: null,
    });
  });

  it('passes persisted MoS through for watchlist holdings', () => {
    expect(
      holdingMosFields({ in_watchlist: 1, dcf_bear: 50, dcf_base: 100, dcf_bull: 150, mos_base: 30, price_zone: 'bear_to_base' })
    ).toEqual({ in_watchlist: true, dcf_bear: 50, dcf_base: 100, dcf_bull: 150, mos_base: 30, price_zone: 'bear_to_base' });
  });

  it('keeps Unvalued watchlist holdings as nulls (not 0)', () => {
    const r = holdingMosFields({ in_watchlist: 1, mos_base: null });
    expect(r.in_watchlist).toBe(true);
    expect(r.mos_base).toBeNull();
    expect(r.dcf_base).toBeNull();
  });

  it('handles missing fields', () => {
    expect(holdingMosFields({}).in_watchlist).toBe(false);
  });

  it('preserves a legitimate 0% MoS', () => {
    expect(holdingMosFields({ in_watchlist: 1, mos_base: 0 }).mos_base).toBe(0);
  });
});
