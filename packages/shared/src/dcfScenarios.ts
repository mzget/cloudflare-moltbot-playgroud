export interface DcfRow {
  readonly scenario_name: string;
  readonly implied_share_price: number | null;
  readonly wacc?: number | null;
  readonly terminal_growth?: number | null;
}

export interface ResolvedDcfScenarios {
  readonly bear: number | null;
  readonly base: number | null;
  readonly bull: number | null;
  readonly wacc: number | null;
  readonly terminalGrowth: number | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Exact-match resolver for the 3 canonical presets (ADR-0004). No fuzzy matching, no rows[0] fallback. */
export const resolveDcfScenarios = (rows: ReadonlyArray<DcfRow>): ResolvedDcfScenarios => {
  const pick = (name: string) => rows.find((r) => r.scenario_name?.trim() === name) ?? null;
  const base = pick('Base Case');
  return {
    bear: num(pick('Bear Case')?.implied_share_price),
    base: num(base?.implied_share_price),
    bull: num(pick('Bull Case')?.implied_share_price),
    wacc: num(base?.wacc),
    terminalGrowth: num(base?.terminal_growth),
  };
};
