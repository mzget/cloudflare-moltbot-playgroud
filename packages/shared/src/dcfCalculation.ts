/**
 * @oaktree/shared - DCF Calculation Engine (Single Source of Truth)
 * Canonical implementation for Discounted Cash Flow valuation across
 * frontend UI, backend API routes, and MCP Worker tools.
 */

export interface BaseYearDcfData {
  readonly yearLabel: string;
  readonly revenue: number;
  readonly ebit: number;
  readonly opMargin: number;
  readonly nopat: number;
}

export interface YearlyDcfData {
  readonly year: number;
  readonly yearLabel: string;
  readonly growth: number; // %
  readonly revenue: number; // $B
  readonly opMargin: number; // %
  readonly ebit: number; // $B
  readonly nopat: number; // $B
  readonly fcfConv: number; // %
  readonly fcf: number; // $B
  readonly discountFactor: number;
  readonly pvOfFcf: number; // $B
}

export interface DcfCalculationInput {
  readonly baseRev: number; // Base revenue in $B
  readonly baseEbit?: number; // Base EBIT in $B (optional)
  readonly baseYear?: number; // Base year (defaults to 2026)
  readonly taxRate?: number; // Corporate tax rate % (defaults to 21.0)
  readonly wacc: number; // Discount rate % (e.g. 10.5)
  readonly terminalGrowth: number; // Terminal growth rate % (e.g. 2.5)
  readonly netCash?: number; // Net cash (Cash - Debt) in $B (defaults to 0)
  readonly sharesOutstanding: number; // Diluted shares in Millions ($M) (e.g. 207)

  readonly mode?: 'uniform' | 'detailed'; // Defaults to 'detailed'

  // Uniform Mode inputs
  readonly revGrowth?: number; // %
  readonly opMargin?: number; // %
  readonly fcfConversion?: number; // %

  // Detailed Mode inputs (5-year forecast arrays)
  readonly yearlyGrowth?: readonly number[]; // % e.g. [30, 26, 22, 20, 18]
  readonly yearlyOpMargin?: readonly number[]; // % e.g. [41.5, 41.7, 41.9, 42.1, 42.3]
  readonly yearlyFcfConv?: readonly number[]; // % e.g. [90, 90, 90, 90, 90]

  // Exit Multiple Valuation
  readonly exitMultiple?: number; // e.g. 22.0
  readonly targetShares?: number; // Expected shares at Year 5 in Millions ($M)
  readonly currentPrice?: number | null; // Current market price for upside & CAGR
}

export interface DcfCalculationResult {
  readonly baseYearData: BaseYearDcfData;
  readonly yearlyData: ReadonlyArray<YearlyDcfData>;
  readonly sumPvFcf: number;
  readonly terminalValue: number;
  readonly pvOfTerminalValue: number;
  readonly enterpriseValue: number;
  readonly netCash: number;
  readonly equityValue: number;
  readonly impliedSharePrice: number; // Rounded to 2 decimals

  // 5-Year Target Price via Exit Multiple Valuation
  readonly targetMarketCapYr5: number;
  readonly targetSharePriceYr5: number; // Rounded to 2 decimals
  readonly cagrYr5: number | null;
  readonly revenueCAGR: number;
  readonly avgOpMargin: number;
}

/**
 * Deterministic pure function to calculate DCF Intrinsic Share Price and cash flow projections.
 */
export function calculateDCF(params: DcfCalculationInput): DcfCalculationResult {
  const baseYear = params.baseYear ?? 2026;
  const taxRate = params.taxRate ?? 21.0;
  const taxDecimal = taxRate / 100;
  const wacc = params.wacc;
  const waccDecimal = wacc / 100;
  const terminalGrowth = params.terminalGrowth;
  const termGrowthDecimal = terminalGrowth / 100;
  const netCash = params.netCash ?? 0;
  const mode = params.mode ?? 'detailed';
  const revGrowth = params.revGrowth ?? 0;
  const opMargin = params.opMargin ?? (params.yearlyOpMargin?.[0] ?? 0);
  const fcfConversion = params.fcfConversion ?? (params.yearlyFcfConv?.[0] ?? 75.0);
  const exitMultiple = params.exitMultiple ?? 20.0;
  const targetShares = params.targetShares ?? params.sharesOutstanding;

  // Resolve base EBIT
  const baseRev = Math.max(0, params.baseRev);
  const baseEbit = params.baseEbit !== undefined
    ? params.baseEbit
    : baseRev * (opMargin / 100);

  const baseOpMargin = baseRev > 0 ? (baseEbit / baseRev) * 100 : 0;
  const baseNopat = baseEbit * (1 - taxDecimal);

  const baseYearData: BaseYearDcfData = {
    yearLabel: `FY${baseYear} (A)`,
    revenue: baseRev,
    ebit: baseEbit,
    opMargin: baseOpMargin,
    nopat: baseNopat,
  };

  const yearlyData: YearlyDcfData[] = [];
  let currentRev = baseRev;
  let sumPvFcf = 0;

  for (let i = 0; i < 5; i++) {
    const year = baseYear + 1 + i;
    const yearLabel = `FY${year} (E)`;

    const growth = mode === 'detailed'
      ? (params.yearlyGrowth?.[i] ?? revGrowth)
      : revGrowth;

    const currentOpMargin = mode === 'detailed'
      ? (params.yearlyOpMargin?.[i] ?? opMargin)
      : opMargin;

    const fcfConv = mode === 'detailed'
      ? (params.yearlyFcfConv?.[i] ?? fcfConversion)
      : fcfConversion;

    currentRev = currentRev * (1 + growth / 100);
    const ebit = currentRev * (currentOpMargin / 100);
    const nopat = ebit * (1 - taxDecimal);
    const fcf = nopat * (fcfConv / 100);

    const discountFactor = waccDecimal > -1 ? 1 / Math.pow(1 + waccDecimal, i + 1) : 0;
    const pvOfFcf = fcf * discountFactor;
    sumPvFcf += pvOfFcf;

    yearlyData.push({
      year,
      yearLabel,
      growth,
      revenue: currentRev,
      opMargin: currentOpMargin,
      ebit,
      nopat,
      fcfConv,
      fcf,
      discountFactor,
      pvOfFcf,
    });
  }

  const lastFcf = yearlyData.length === 5 ? yearlyData[4].fcf : 0;
  const denom = Math.max(0.0001, waccDecimal - termGrowthDecimal);
  const terminalValue = (lastFcf * (1 + termGrowthDecimal)) / denom;
  const pvOfTerminalValue = waccDecimal > -1 ? terminalValue / Math.pow(1 + waccDecimal, 5) : 0;
  const enterpriseValue = sumPvFcf + pvOfTerminalValue;
  const equityValue = enterpriseValue + netCash;

  // Implied Share Price: Shares outstanding in Millions divided by 1000 = Billions
  const sharesInBillions = params.sharesOutstanding > 0 ? params.sharesOutstanding / 1000 : 0;
  const rawImpliedPrice = sharesInBillions > 0 ? equityValue / sharesInBillions : 0;
  const impliedSharePrice = Number(rawImpliedPrice.toFixed(2));

  // 5-Year Target Price via Exit Multiple Valuation
  const targetMarketCapYr5 = lastFcf * exitMultiple;
  const targetSharesInBillions = targetShares > 0 ? targetShares / 1000 : 0;
  const rawTargetSharePriceYr5 = targetSharesInBillions > 0 ? targetMarketCapYr5 / targetSharesInBillions : 0;
  const targetSharePriceYr5 = Number(rawTargetSharePriceYr5.toFixed(2));

  let cagrYr5: number | null = null;
  if (params.currentPrice && params.currentPrice > 0 && targetSharePriceYr5 > 0) {
    const rawCagr = (Math.pow(targetSharePriceYr5 / params.currentPrice, 1 / 5) - 1) * 100;
    cagrYr5 = Number(rawCagr.toFixed(2));
  }

  const revenueCAGR = baseRev > 0 && yearlyData.length === 5
    ? Number(((Math.pow(yearlyData[4].revenue / baseRev, 1 / 5) - 1) * 100).toFixed(2))
    : 0;

  const avgOpMargin = yearlyData.length > 0
    ? Number((yearlyData.reduce((acc, d) => acc + d.opMargin, 0) / yearlyData.length).toFixed(2))
    : 0;

  return {
    baseYearData,
    yearlyData,
    sumPvFcf,
    terminalValue,
    pvOfTerminalValue,
    enterpriseValue,
    netCash,
    equityValue,
    impliedSharePrice,
    targetMarketCapYr5,
    targetSharePriceYr5,
    cagrYr5,
    revenueCAGR,
    avgOpMargin,
  };
}
