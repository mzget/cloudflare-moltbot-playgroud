import { describe, it, expect } from 'vitest';
import { calculateDCF, DcfCalculationInput } from './dcfCalculation';

describe('calculateDCF - Shared Single Source of Truth Engine', () => {
  it('correctly calculates RDDT Base Case intrinsic share price as 166.81', () => {
    const input: DcfCalculationInput = {
      baseRev: 3.35,
      wacc: 10.5,
      terminalGrowth: 2.5,
      taxRate: 15.0,
      netCash: 2.8,
      sharesOutstanding: 207, // Millions
      mode: 'detailed',
      yearlyGrowth: [30, 26, 22, 20, 18],
      yearlyOpMargin: [41.5, 41.7, 41.9, 42.1, 42.3],
      yearlyFcfConv: [90, 90, 90, 90, 90],
      exitMultiple: 22.0,
      targetShares: 207,
      currentPrice: 144.25,
    };

    const res = calculateDCF(input);

    expect(res.impliedSharePrice).toBe(166.81);
    expect(res.enterpriseValue).toBeGreaterThan(31);
    expect(res.enterpriseValue).toBeLessThan(32);
    expect(res.netCash).toBe(2.8);
    expect(res.equityValue).toBeCloseTo(34.53, 1);
    expect(res.targetSharePriceYr5).toBe(326.01);
    expect(res.cagrYr5).toBeCloseTo(17.7, 1);
  });

  it('correctly calculates Uniform Mode projections', () => {
    const input: DcfCalculationInput = {
      baseRev: 10.0,
      wacc: 9.0,
      terminalGrowth: 2.5,
      taxRate: 21.0,
      netCash: 1.0,
      sharesOutstanding: 500,
      mode: 'uniform',
      revGrowth: 10,
      opMargin: 30,
      fcfConversion: 80,
      exitMultiple: 20.0,
    };

    const res = calculateDCF(input);

    expect(res.impliedSharePrice).toBeGreaterThan(0);
    expect(res.yearlyData).toHaveLength(5);
    expect(res.yearlyData[0].growth).toBe(10);
    expect(res.yearlyData[0].opMargin).toBe(30);
    expect(res.yearlyData[0].fcfConv).toBe(80);
  });

  it('handles edge cases gracefully without throwing', () => {
    // Zero shares
    const zeroShares = calculateDCF({
      baseRev: 10.0,
      wacc: 10.0,
      terminalGrowth: 2.0,
      sharesOutstanding: 0,
    });
    expect(zeroShares.impliedSharePrice).toBe(0);

    // Zero revenue
    const zeroRev = calculateDCF({
      baseRev: 0,
      wacc: 10.0,
      terminalGrowth: 2.0,
      netCash: 5.0,
      sharesOutstanding: 100,
    });
    // With 0 revenue and $5B net cash / 0.1B shares = $50.00
    expect(zeroRev.impliedSharePrice).toBe(50.0);
  });

  it('does not apply tax shield when EBIT is negative or zero and clamps taxRate to 0-100%', () => {
    const lossRes = calculateDCF({
      baseRev: 10.0,
      baseEbit: -2.0,
      wacc: 10.0,
      terminalGrowth: 2.5,
      taxRate: 21.0,
      sharesOutstanding: 100,
      mode: 'detailed',
      yearlyGrowth: [10, 10, 10, 10, 10],
      yearlyOpMargin: [-20, -10, 0, 10, 20],
      yearlyFcfConv: [100, 100, 100, 100, 100],
    });

    // Base year EBIT is -2.0 -> NOPAT should remain -2.0 (0% effective tax on losses)
    expect(lossRes.baseYearData.ebit).toBe(-2.0);
    expect(lossRes.baseYearData.nopat).toBe(-2.0);

    // Year 1 & 2 have negative EBIT -> NOPAT should equal EBIT
    expect(lossRes.yearlyData[0].nopat).toBeCloseTo(lossRes.yearlyData[0].ebit, 5);
    expect(lossRes.yearlyData[1].nopat).toBeCloseTo(lossRes.yearlyData[1].ebit, 5);
    // Year 3 has 0 EBIT -> NOPAT is 0
    expect(lossRes.yearlyData[2].nopat).toBe(0);
    // Year 4 has positive EBIT -> taxed at 21%
    expect(lossRes.yearlyData[3].nopat).toBeCloseTo(lossRes.yearlyData[3].ebit * 0.79, 5);
  });

  it('applies guardrails for WACC <= terminalGrowth, negative terminal FCF, and negative equity value', () => {
    // 1. WACC <= terminalGrowth uses 0.5% (0.005) minimum spread instead of exploding 10,000x
    const narrowSpread = calculateDCF({
      baseRev: 10.0,
      wacc: 3.0,
      terminalGrowth: 3.5,
      taxRate: 20.0,
      sharesOutstanding: 100,
      mode: 'uniform',
      revGrowth: 0,
      opMargin: 10,
      fcfConversion: 100,
    });
    // Year 5 FCF = 10 * 10% * (1 - 0.2) * 100% = 0.8
    // Terminal Value = 0.8 * (1 + 0.035) / 0.005 = 165.6
    expect(narrowSpread.terminalValue).toBeCloseTo(165.6, 2);

    // 2. Negative Year 5 FCF yields 0 Terminal Value and 0 Target Market Cap (P/FCF)
    const negativeTerminalFcf = calculateDCF({
      baseRev: 10.0,
      wacc: 10.0,
      terminalGrowth: 2.5,
      sharesOutstanding: 100,
      mode: 'uniform',
      revGrowth: 5,
      opMargin: -15,
      fcfConversion: 100,
      exitMultiple: 20,
    });
    expect(negativeTerminalFcf.terminalValue).toBe(0);
    expect(negativeTerminalFcf.targetMarketCapYr5).toBe(0);
    expect(negativeTerminalFcf.targetSharePriceYr5).toBe(0);

    // 3. Heavy net debt resulting in negative equity value floors impliedSharePrice at 0
    const negativeEquity = calculateDCF({
      baseRev: 1.0,
      wacc: 10.0,
      terminalGrowth: 2.0,
      netCash: -50.0,
      sharesOutstanding: 100,
      mode: 'uniform',
      revGrowth: 5,
      opMargin: 10,
      fcfConversion: 80,
    });
    expect(negativeEquity.equityValue).toBeLessThan(0);
    expect(negativeEquity.impliedSharePrice).toBe(0);
  });
});
