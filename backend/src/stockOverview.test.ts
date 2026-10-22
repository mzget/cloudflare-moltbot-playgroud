import { describe, it, expect } from 'vitest';
import {
  formatPeriodLabel,
  parseYahooTimeseries,
  mergeFinancialPeriods,
  computeSeriesLegendStats,
  buildCompanyStatistics,
  formatCompactCurrency,
  formatMultiple,
  formatPercent,
  FinancialBarPeriod,
  fetchFinancialOverview,
} from './stockOverview';

describe('formatPeriodLabel', () => {
  it('formats quarterly dates into Q{x} \'{yy}', () => {
    expect(formatPeriodLabel('2025-03-31', 'quarterly')).toBe("Q1 '25");
    expect(formatPeriodLabel('2025-06-30', 'quarterly')).toBe("Q2 '25");
    expect(formatPeriodLabel('2025-09-30', 'quarterly')).toBe("Q3 '25");
    expect(formatPeriodLabel('2025-12-31', 'quarterly')).toBe("Q4 '25");
  });

  it('formats annual dates into YYYY', () => {
    expect(formatPeriodLabel('2024-12-31', 'annual')).toBe('2024');
    expect(formatPeriodLabel('2025-06-30', 'annual')).toBe('2025');
  });
});

describe('parseYahooTimeseries', () => {
  it('handles null, undefined or empty data gracefully', () => {
    expect(parseYahooTimeseries(null, 'quarterly')).toEqual([]);
    expect(parseYahooTimeseries({}, 'quarterly')).toEqual([]);
    expect(parseYahooTimeseries({ timeseries: { result: [] } }, 'annual')).toEqual([]);
  });

  it('normalizes raw USD to Millions USD correctly including negative cash flows', () => {
    const rawYahooData = {
      timeseries: {
        result: [
          {
            meta: { type: ['quarterlyTotalRevenue'] },
            quarterlyTotalRevenue: [
              { asOfDate: '2025-03-31', reportedValue: { raw: 45000000000 } },
              { asOfDate: '2025-06-30', reportedValue: { raw: 47516000000 } },
            ],
          },
          {
            meta: { type: ['quarterlyGrossProfit'] },
            quarterlyGrossProfit: [
              { asOfDate: '2025-03-31', reportedValue: { raw: 36000000000 } },
              { asOfDate: '2025-06-30', reportedValue: { raw: 38980000000 } },
            ],
          },
          {
            meta: { type: ['quarterlyOperatingIncome'] },
            quarterlyOperatingIncome: [
              { asOfDate: '2025-03-31', reportedValue: { raw: 15000000000 } },
              { asOfDate: '2025-06-30', reportedValue: { raw: 18775000000 } },
            ],
          },
          {
            meta: { type: ['quarterlyOperatingCashFlow'] },
            quarterlyOperatingCashFlow: [
              { asOfDate: '2025-03-31', reportedValue: { raw: 22000000000 } },
              { asOfDate: '2025-06-30', reportedValue: { raw: 25000000000 } },
            ],
          },
          {
            meta: { type: ['quarterlyFreeCashFlow'] },
            quarterlyFreeCashFlow: [
              { asOfDate: '2025-03-31', reportedValue: { raw: -1156000000 } }, // Negative FCF
              { asOfDate: '2025-06-30', reportedValue: { raw: 14831000000 } },
            ],
          },
        ],
      },
    };

    const periods = parseYahooTimeseries(rawYahooData, 'quarterly');
    expect(periods).toHaveLength(2);

    expect(periods[0]).toEqual({
      period: "Q1 '25",
      asOfDate: '2025-03-31',
      totalRevenue: 45000,
      grossProfit: 36000,
      operatingProfit: 15000,
      operatingCashFlow: 22000,
      freeCashFlow: -1156,
    });

    expect(periods[1]).toEqual({
      period: "Q2 '25",
      asOfDate: '2025-06-30',
      totalRevenue: 47516,
      grossProfit: 38980,
      operatingProfit: 18775,
      operatingCashFlow: 25000,
      freeCashFlow: 14831,
    });
  });
});

describe('mergeFinancialPeriods', () => {
  const existing: FinancialBarPeriod[] = [
    { period: "Q1 '24", asOfDate: '2024-03-31', totalRevenue: 30000, grossProfit: 24000, operatingProfit: 10000, operatingCashFlow: 12000, freeCashFlow: 8000 },
    { period: "Q2 '24", asOfDate: '2024-06-30', totalRevenue: 32000, grossProfit: 25000, operatingProfit: 11000, operatingCashFlow: 13000, freeCashFlow: 8500 },
    { period: "Q3 '24", asOfDate: '2024-09-30', totalRevenue: 34000, grossProfit: 27000, operatingProfit: 12000, operatingCashFlow: 14000, freeCashFlow: 9000 },
  ];

  const incoming: FinancialBarPeriod[] = [
    // Overwrite Q3 '24 with refined numbers
    { period: "Q3 '24", asOfDate: '2024-09-30', totalRevenue: 34500, grossProfit: 27500, operatingProfit: 12500, operatingCashFlow: 14500, freeCashFlow: 9500 },
    // Add new Q4 '24 and Q1 '25
    { period: "Q4 '24", asOfDate: '2024-12-31', totalRevenue: 38000, grossProfit: 30000, operatingProfit: 14000, operatingCashFlow: 16000, freeCashFlow: 11000 },
    { period: "Q1 '25", asOfDate: '2025-03-31', totalRevenue: 40000, grossProfit: 32000, operatingProfit: 15000, operatingCashFlow: 17000, freeCashFlow: 12000 },
  ];

  it('accumulates and merges historical periods based on asOfDate', () => {
    const merged = mergeFinancialPeriods(existing, incoming, 8);
    expect(merged).toHaveLength(5);
    expect(merged[0].asOfDate).toBe('2024-03-31');
    expect(merged[1].asOfDate).toBe('2024-06-30');
    expect(merged[2].asOfDate).toBe('2024-09-30');
    expect(merged[2].totalRevenue).toBe(34500); // Updated by incoming
    expect(merged[3].asOfDate).toBe('2024-12-31');
    expect(merged[4].asOfDate).toBe('2025-03-31');
  });

  it('truncates to maxPeriods keeping the most recent periods', () => {
    const merged = mergeFinancialPeriods(existing, incoming, 3);
    expect(merged).toHaveLength(3);
    expect(merged[0].asOfDate).toBe('2024-09-30');
    expect(merged[1].asOfDate).toBe('2024-12-31');
    expect(merged[2].asOfDate).toBe('2025-03-31');
  });
});

describe('computeSeriesLegendStats', () => {
  it('calculates Total Change % and CAGR % matching reference example (47,516 -> 64,601 over 5 quarters)', () => {
    const periods: FinancialBarPeriod[] = [
      { period: "Q2 '24", asOfDate: '2024-06-30', totalRevenue: 47516, grossProfit: null, operatingProfit: null, operatingCashFlow: null, freeCashFlow: null },
      { period: "Q3 '24", asOfDate: '2024-09-30', totalRevenue: 51000, grossProfit: null, operatingProfit: null, operatingCashFlow: null, freeCashFlow: null },
      { period: "Q4 '24", asOfDate: '2024-12-31', totalRevenue: 56000, grossProfit: null, operatingProfit: null, operatingCashFlow: null, freeCashFlow: null },
      { period: "Q1 '25", asOfDate: '2025-03-31', totalRevenue: 60000, grossProfit: null, operatingProfit: null, operatingCashFlow: null, freeCashFlow: null },
      { period: "Q2 '25", asOfDate: '2025-06-30', totalRevenue: 64601, grossProfit: null, operatingProfit: null, operatingCashFlow: null, freeCashFlow: null },
    ];

    const stats = computeSeriesLegendStats(periods, 'totalRevenue', 'Total Revenues', '#3b82f6', 'quarterly');
    expect(stats.totalChangePct).toBe(35.96); // ((64601 - 47516) / 47516) * 100
    expect(stats.cagrPct).toBe(27.9); // ((64601 / 47516) ** (1 / 1.25) - 1) * 100
  });

  it('handles negative or zero values safely for CAGR', () => {
    const periods: FinancialBarPeriod[] = [
      { period: "Q1 '25", asOfDate: '2025-03-31', totalRevenue: null, grossProfit: null, operatingProfit: null, operatingCashFlow: null, freeCashFlow: -500 },
      { period: "Q2 '25", asOfDate: '2025-06-30', totalRevenue: null, grossProfit: null, operatingProfit: null, operatingCashFlow: null, freeCashFlow: 1200 },
    ];

    const stats = computeSeriesLegendStats(periods, 'freeCashFlow', 'Free Cash Flow', '#eab308', 'quarterly');
    expect(stats.totalChangePct).toBe(340); // (-500 -> 1200 is +1700 / 500 = +340%)
    expect(stats.cagrPct).toBeNull(); // Negative base value cannot compute meaningful CAGR
  });

  it('returns nulls when fewer than 2 periods exist', () => {
    const periods: FinancialBarPeriod[] = [
      { period: "Q1 '25", asOfDate: '2025-03-31', totalRevenue: 50000, grossProfit: null, operatingProfit: null, operatingCashFlow: null, freeCashFlow: null },
    ];

    const stats = computeSeriesLegendStats(periods, 'totalRevenue', 'Total Revenues', '#3b82f6', 'quarterly');
    expect(stats.totalChangePct).toBeNull();
    expect(stats.cagrPct).toBeNull();
  });
});

describe('Formatting Helpers', () => {
  it('formats compact currencies correctly', () => {
    expect(formatCompactCurrency(1776936.54)).toBe('$1.78T'); // Millions USD: 1.77T
    expect(formatCompactCurrency(228400)).toBe('$228.4B');
    expect(formatCompactCurrency(450.5)).toBe('$450.5M');
    expect(formatCompactCurrency(-15000)).toBe('-$15.0B');
    expect(formatCompactCurrency(null)).toBe('—');
  });

  it('formats multiples and percentages correctly', () => {
    expect(formatMultiple(25.9715)).toBe('26.0x');
    expect(formatMultiple(null)).toBe('—');
    expect(formatPercent(27.96)).toBe('28.0%');
    expect(formatPercent(0.2796, true)).toBe('28.0%'); // isDecimal = true
    expect(formatPercent(null)).toBe('—');
  });
});

describe('buildCompanyStatistics', () => {
  it('builds 3 curated columns with fallback handling and DCF margin of safety', () => {
    const finnhubMetric = {
      peBasicExclExtraTTM: 25.97,
      pbQuarterly: 5.47,
      psTTM: 7.78,
      evRevenueTTM: 8.05,
      evEbitdaTTM: 18.2,
      grossMarginTTM: 81.8,
      operatingMarginTTM: 42.5,
      pretaxMarginTTM: 41.2,
      netProfitMarginTTM: 34.1,
      roaTTM: 18.0,
      roa5Y: 16.5,
      roeTTM: 29.7,
      roe5Y: 27.8,
      roiTTM: 22.4,
      roi5Y: 20.1,
      assetTurnoverTTM: 0.85,
      'totalDebt/totalEquityQuarterly': 0.32,
      currentRatioQuarterly: 2.23,
      netInterestCoverageTTM: 168.4,
      revenueGrowthQuarterlyYoy: 27.96,
      revenueGrowthTTMYoy: 24.1,
      revenueGrowth3Y: 19.89,
      revenueGrowth5Y: 17.5,
      epsGrowthTTMYoy: 38.2,
      epsGrowth3Y: 39.86,
      epsGrowth5Y: 25.4,
      ebitdaCagr5Y: 20.85,
      focfCagr5Y: 14.3,
      capexCagr5Y: 18.5,
      tbvCagr5Y: 16.2,
      currentDividendYieldTTM: 0.3035,
      payoutRatioTTM: 7.8,
      dividendIndicatedAnnual: 2.1,
      revenueEmployeeTTM: 2.9268,
      '52WeekHigh': 779.8,
      '52WeekLow': 520.3,
    };

    const finnhubProfile = {
      ticker: 'META',
      name: 'Meta Platforms Inc',
      marketCapitalization: 1776936.54, // Millions USD
      enterpriseValue: 1840000,
      shareOutstanding: 2547.51, // Millions
      exchange: 'NASDAQ',
      ipo: '2012-05-18',
      finnhubIndustry: 'Technology',
    };

    const marketStats = {
      revenues: 228400,
      ev_ebit: 19.0,
      p_ocf: 14.5,
      p_fcf: 29.8,
      fcf_margin: 0.263,
      total_cash: 58100,
      total_debt: 38200,
      net_debt: -19900,
      rd_to_revenue: 0.262,
      capex_to_ocf: 0.451,
      all_time_high: 780.0,
      all_time_low: 88.1,
    };

    const dcfCalc = { implied_share_price: 650.0 };
    const currentPrice = 580.0; // Margin of safety: (650 - 580) / 650 * 100 = +10.8%

    const stats = buildCompanyStatistics({
      finnhubMetric,
      finnhubProfile,
      marketStats,
      dcfCalc,
      currentPrice,
    });

    expect(stats.profileMarginsReturns).toBeDefined();
    expect(stats.valuationHealth).toBeDefined();
    expect(stats.growthDividends).toBeDefined();

    // Check DCF Margin of Safety
    const valGroup = stats.valuationHealth.find(g => g.category === 'Valuation (Forward & Intrinsic)');
    expect(valGroup).toBeDefined();
    const dcfItem = valGroup?.items.find(i => i.label === 'DCF Base Value');
    const mosItem = valGroup?.items.find(i => i.label === 'Margin of Safety');
    expect(dcfItem?.value).toBe('$650.00');
    expect(mosItem?.value).toBe('+10.8%');
  });
});


describe('fetchFinancialOverview', () => {
  it('returns cached overview_json from D1 when available and fresh', async () => {
    const cachedOverview = {
      symbol: 'META',
      name: 'Meta Platforms Inc',
      logo: 'https://example.com/logo.png',
      sector: 'Communication Services',
      industry: 'Media',
      exchange: 'NASDAQ',
      ipoDate: '2012-05-18',
      currency: 'USD',
      quarterly: [{ period: "Q2 '25", asOfDate: '2025-06-30', totalRevenue: 47516, grossProfit: 38980, operatingProfit: 18775, operatingCashFlow: 25000, freeCashFlow: 14831 }],
      annual: [{ period: '2024', asOfDate: '2024-12-31', totalRevenue: 164000, grossProfit: 130000, operatingProfit: 60000, operatingCashFlow: 75000, freeCashFlow: 50000 }],
      companyStatistics: { profileMarginsReturns: [], valuationHealth: [], growthDividends: [] },
      updatedAt: new Date().toISOString(),
    };

    const mockRow = {
      symbol: 'META',
      overview_json: JSON.stringify(cachedOverview),
      overview_updated_at: new Date(Date.now() - 3600 * 1000).toISOString(), // 1 hour ago (fresh)
    };

    const mockDb = {
      prepare: (sql: string) => ({
        bind: (...args: any[]) => ({
          first: async () => mockRow,
          run: async () => ({ success: true }),
        }),
      }),
    };

    const env = { DB: mockDb };
    const result = await fetchFinancialOverview(env, 'META', false);
    expect(result.symbol).toBe('META');
    expect(result.name).toBe('Meta Platforms Inc');
    expect(result.quarterly).toHaveLength(1);
    expect(result.quarterly[0].totalRevenue).toBe(47516);
  });
});
