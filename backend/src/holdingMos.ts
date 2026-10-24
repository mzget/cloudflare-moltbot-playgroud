/**
 * Maps persisted Margin of Safety columns of a holdings row to API fields (ADR-0014).
 * Holdings outside the Watchlist are "n/a": `in_watchlist: false` and all MoS fields null.
 */
export function holdingMosFields(row: Record<string, any>) {
  const inWatchlist = Boolean(row.in_watchlist);
  const pick = (v: unknown) => (inWatchlist && v !== undefined ? v ?? null : null);
  return {
    in_watchlist: inWatchlist,
    dcf_bear: pick(row.dcf_bear),
    dcf_base: pick(row.dcf_base),
    dcf_bull: pick(row.dcf_bull),
    mos_base: pick(row.mos_base),
    price_zone: pick(row.price_zone),
  };
}
