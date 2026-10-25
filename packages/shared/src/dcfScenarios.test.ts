import { describe, it, expect } from 'vitest';
import { resolveDcfScenarios, DcfRow } from './dcfScenarios';

describe('resolveDcfScenarios', () => {
  it('resolves all 3 canonical presets correctly', () => {
    const rows: DcfRow[] = [
      { scenario_name: 'Bear Case', implied_share_price: 78.13, wacc: 11.5, terminal_growth: 2.0 },
      { scenario_name: 'Base Case', implied_share_price: 142.88, wacc: 10.5, terminal_growth: 2.5 },
      { scenario_name: 'Bull Case', implied_share_price: 205.5, wacc: 9.5, terminal_growth: 3.0 },
    ];

    const result = resolveDcfScenarios(rows);
    expect(result).toEqual({
      bear: 78.13,
      base: 142.88,
      bull: 205.5,
      wacc: 10.5,
      terminalGrowth: 2.5,
    });
  });

  it('handles partial scenarios (e.g. only Bull Case)', () => {
    const rows: DcfRow[] = [
      { scenario_name: 'Bull Case', implied_share_price: 205.5, wacc: 9.5, terminal_growth: 3.0 },
    ];

    const result = resolveDcfScenarios(rows);
    expect(result).toEqual({
      bear: null,
      base: null,
      bull: 205.5,
      wacc: null,
      terminalGrowth: null,
    });
  });

  it('handles empty input rows', () => {
    const result = resolveDcfScenarios([]);
    expect(result).toEqual({
      bear: null,
      base: null,
      bull: null,
      wacc: null,
      terminalGrowth: null,
    });
  });

  it('ignores legacy or non-canonical scenario names (strict exact match)', () => {
    const rows: DcfRow[] = [
      { scenario_name: 'Base Case - Reddit Q2 2026', implied_share_price: 175.98, wacc: 10.5, terminal_growth: 2.5 },
      { scenario_name: 'Bull Case (Optimistic)', implied_share_price: 250.0 },
      { scenario_name: 'base case', implied_share_price: 100.0 }, // case sensitive
    ];

    const result = resolveDcfScenarios(rows);
    expect(result).toEqual({
      bear: null,
      base: null,
      bull: null,
      wacc: null,
      terminalGrowth: null,
    });
  });

  it('preserves implied_share_price = 0 without treating it as null', () => {
    const rows: DcfRow[] = [
      { scenario_name: 'Bear Case', implied_share_price: 0, wacc: 12.0, terminal_growth: 0 },
      { scenario_name: 'Base Case', implied_share_price: 10.0, wacc: 10.0, terminal_growth: 2.0 },
      { scenario_name: 'Bull Case', implied_share_price: 20.0, wacc: 8.0, terminal_growth: 3.0 },
    ];

    const result = resolveDcfScenarios(rows);
    expect(result.bear).toBe(0);
    expect(result.base).toBe(10.0);
    expect(result.bull).toBe(20.0);
  });

  it('ignores non-finite numbers', () => {
    const rows: DcfRow[] = [
      { scenario_name: 'Base Case', implied_share_price: NaN as any, wacc: Infinity as any },
    ];

    const result = resolveDcfScenarios(rows);
    expect(result.base).toBeNull();
    expect(result.wacc).toBeNull();
  });

  it('safely handles accidental leading or trailing whitespace on canonical presets', () => {
    const rows: DcfRow[] = [
      { scenario_name: ' Base Case ', implied_share_price: 150.0, wacc: 10.0, terminal_growth: 2.5 },
      { scenario_name: 'Bear Case\t', implied_share_price: 80.0 },
      { scenario_name: '  Bull Case', implied_share_price: 220.0 },
    ];

    const result = resolveDcfScenarios(rows);
    expect(result.base).toBe(150.0);
    expect(result.bear).toBe(80.0);
    expect(result.bull).toBe(220.0);
    expect(result.wacc).toBe(10.0);
    expect(result.terminalGrowth).toBe(2.5);
  });
});
