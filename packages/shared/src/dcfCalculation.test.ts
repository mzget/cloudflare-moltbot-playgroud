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
});
