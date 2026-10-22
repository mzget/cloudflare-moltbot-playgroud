export interface FinancialBarPeriod {
  readonly period: string;
  readonly asOfDate: string;
  readonly totalRevenue: number | null;
  readonly grossProfit: number | null;
  readonly operatingProfit: number | null;
  readonly operatingCashFlow: number | null;
  readonly freeCashFlow: number | null;
}

export interface SeriesLegendStats {
  readonly key: keyof Omit<FinancialBarPeriod, 'period' | 'asOfDate'>;
  readonly label: string;
  readonly color: string;
  readonly totalChangePct: number | null;
  readonly cagrPct: number | null;
}

export interface CompanyStatisticsItem {
  readonly label: string;
  readonly value: string;
  readonly raw?: number | null;
  readonly highlight?: 'positive' | 'negative' | 'neutral';
}

export interface CompanyStatisticsGroup {
  readonly category: string;
  readonly items: readonly CompanyStatisticsItem[];
}

export interface CompanyOverviewPayload {
  readonly symbol: string;
  readonly name: string;
  readonly logo: string | null;
  readonly sector: string;
  readonly industry: string;
  readonly exchange: string;
  readonly ipoDate: string | null;
  readonly currency: string;
  readonly quarterly: readonly FinancialBarPeriod[];
  readonly annual: readonly FinancialBarPeriod[];
  readonly companyStatistics: {
    readonly profileMarginsReturns: readonly CompanyStatisticsGroup[];
    readonly valuationHealth: readonly CompanyStatisticsGroup[];
    readonly growthDividends: readonly CompanyStatisticsGroup[];
  };
  readonly updatedAt: string;
}

export function formatPeriodLabel(asOfDate: string, frequency: 'quarterly' | 'annual'): string {
  if (!asOfDate) return '—';
  const parts = asOfDate.split('-');
  const yearStr = parts[0] || '';
  const monthStr = parts[1] || '01';
  const month = parseInt(monthStr, 10);
  if (frequency === 'annual') {
    return yearStr;
  }
  const q = Math.min(4, Math.max(1, Math.ceil(month / 3)));
  const shortYear = yearStr.length >= 4 ? yearStr.slice(2) : yearStr;
  return `Q${q} '${shortYear}`;
}

export function formatCompactCurrency(valueInMillions: number | null | undefined): string {
  if (valueInMillions === null || valueInMillions === undefined || isNaN(valueInMillions)) {
    return '—';
  }
  const isNegative = valueInMillions < 0;
  const absVal = Math.abs(valueInMillions);

  let formatted = '';
  if (absVal >= 1_000_000) {
    formatted = `$${(absVal / 1_000_000).toFixed(2)}T`;
  } else if (absVal >= 1_000) {
    formatted = `$${(absVal / 1_000).toFixed(1)}B`;
  } else {
    formatted = `$${absVal.toFixed(1)}M`;
  }
  return isNegative ? `-${formatted}` : formatted;
}

export function formatShares(sharesInMillions: number | null | undefined): string {
  if (sharesInMillions === null || sharesInMillions === undefined || isNaN(sharesInMillions)) {
    return '—';
  }
  const isNegative = sharesInMillions < 0;
  const absVal = Math.abs(sharesInMillions);

  let formatted = '';
  if (absVal >= 1_000) {
    formatted = `${(absVal / 1_000).toFixed(2)}B`;
  } else {
    formatted = `${absVal.toFixed(1)}M`;
  }
  return isNegative ? `-${formatted}` : formatted;
}

export function formatMultiple(val: number | null | undefined, suffix = 'x'): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return `${val.toFixed(1)}${suffix}`;
}

export function formatPercent(val: number | null | undefined, isDecimal = false, decimals = 1): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  const pct = isDecimal ? val * 100 : val;
  return `${pct.toFixed(decimals)}%`;
}

export function formatRatio(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return val.toFixed(decimals);
}

export function parseYahooTimeseries(rawJson: any, frequency: 'quarterly' | 'annual'): FinancialBarPeriod[] {
  if (!rawJson || !rawJson.timeseries || !Array.isArray(rawJson.timeseries.result)) {
    return [];
  }

  const prefix = frequency === 'annual' ? 'annual' : 'quarterly';
  const revKey = `${prefix}TotalRevenue`;
  const gpKey = `${prefix}GrossProfit`;
  const opKey = `${prefix}OperatingIncome`;
  const ocfKey = `${prefix}OperatingCashFlow`;
  const fcfKey = `${prefix}FreeCashFlow`;

  const resultMap = new Map<string, {
    totalRevenue: number | null;
    grossProfit: number | null;
    operatingProfit: number | null;
    operatingCashFlow: number | null;
    freeCashFlow: number | null;
  }>();

  const getOrCreate = (date: string) => {
    let item = resultMap.get(date);
    if (!item) {
      item = {
        totalRevenue: null,
        grossProfit: null,
        operatingProfit: null,
        operatingCashFlow: null,
        freeCashFlow: null,
      };
      resultMap.set(date, item);
    }
    return item;
  };

  const results = rawJson.timeseries.result;
  for (const series of results) {
    const seriesType = series.meta?.type?.[0];
    if (!seriesType) continue;

    const dataPoints = Array.isArray(series[seriesType]) ? series[seriesType] : [];
    for (const dp of dataPoints) {
      const asOfDate = dp?.asOfDate;
      const rawVal = dp?.reportedValue?.raw;
      if (!asOfDate || rawVal === undefined || rawVal === null || isNaN(rawVal)) continue;

      const normMillion = Math.round(rawVal / 1_000_000);
      const item = getOrCreate(asOfDate);

      if (seriesType === revKey) item.totalRevenue = normMillion;
      else if (seriesType === gpKey) item.grossProfit = normMillion;
      else if (seriesType === opKey) item.operatingProfit = normMillion;
      else if (seriesType === ocfKey) item.operatingCashFlow = normMillion;
      else if (seriesType === fcfKey) item.freeCashFlow = normMillion;
    }
  }

  const sortedDates = Array.from(resultMap.keys()).sort();
  return sortedDates.map(asOfDate => {
    const data = resultMap.get(asOfDate)!;
    return {
      period: formatPeriodLabel(asOfDate, frequency),
      asOfDate,
      totalRevenue: data.totalRevenue,
      grossProfit: data.grossProfit,
      operatingProfit: data.operatingProfit,
      operatingCashFlow: data.operatingCashFlow,
      freeCashFlow: data.freeCashFlow,
    };
  });
}

export function mergeFinancialPeriods(
  existing: readonly FinancialBarPeriod[] = [],
  incoming: readonly FinancialBarPeriod[] = [],
  maxPeriods = 8
): FinancialBarPeriod[] {
  const mergedMap = new Map<string, FinancialBarPeriod>();

  for (const p of existing) {
    if (p && p.asOfDate) mergedMap.set(p.asOfDate, p);
  }

  for (const p of incoming) {
    if (p && p.asOfDate) {
      const prev = mergedMap.get(p.asOfDate);
      if (!prev) {
        mergedMap.set(p.asOfDate, p);
      } else {
        mergedMap.set(p.asOfDate, {
          period: p.period || prev.period,
          asOfDate: p.asOfDate,
          totalRevenue: p.totalRevenue !== null ? p.totalRevenue : prev.totalRevenue,
          grossProfit: p.grossProfit !== null ? p.grossProfit : prev.grossProfit,
          operatingProfit: p.operatingProfit !== null ? p.operatingProfit : prev.operatingProfit,
          operatingCashFlow: p.operatingCashFlow !== null ? p.operatingCashFlow : prev.operatingCashFlow,
          freeCashFlow: p.freeCashFlow !== null ? p.freeCashFlow : prev.freeCashFlow,
        });
      }
    }
  }

  const sorted = Array.from(mergedMap.values()).sort((a, b) => a.asOfDate.localeCompare(b.asOfDate));
  return sorted.slice(-maxPeriods);
}

export function computeSeriesLegendStats(
  periods: readonly FinancialBarPeriod[],
  key: keyof Omit<FinancialBarPeriod, 'period' | 'asOfDate'>,
  label: string,
  color: string,
  frequency: 'quarterly' | 'annual'
): SeriesLegendStats {
  const validPoints = periods
    .map(p => p[key])
    .filter((v): v is number => typeof v === 'number' && !isNaN(v));

  if (validPoints.length < 2) {
    return {
      key,
      label,
      color,
      totalChangePct: null,
      cagrPct: null,
    };
  }

  const first = validPoints[0];
  const last = validPoints[validPoints.length - 1];

  let totalChangePct: number | null = null;
  if (first !== 0) {
    const rawChange = ((last - first) / Math.abs(first)) * 100;
    totalChangePct = Number(rawChange.toFixed(2));
  }

  let cagrPct: number | null = null;
  if (first > 0 && last > 0) {
    const periodsCount = validPoints.length;
    const nYears = frequency === 'quarterly' ? periodsCount / 4 : periodsCount;
    if (nYears > 0) {
      const rawCagr = (Math.pow(last / first, 1 / nYears) - 1) * 100;
      cagrPct = Number(rawCagr.toFixed(1));
    }
  }

  return {
    key,
    label,
    color,
    totalChangePct,
    cagrPct,
  };
}

export interface BuildCompanyStatsParams {
  readonly finnhubMetric?: Record<string, any> | null;
  readonly finnhubProfile?: Record<string, any> | null;
  readonly marketStats?: Record<string, any> | null;
  readonly dcfCalc?: { readonly implied_share_price?: number | null } | null;
  readonly currentPrice?: number | null;
}

export function buildCompanyStatistics({
  finnhubMetric = {},
  finnhubProfile = {},
  marketStats = null,
  dcfCalc = null,
  currentPrice = null,
}: BuildCompanyStatsParams) {
  const m = finnhubMetric || {};
  const p = finnhubProfile || {};
  const s = marketStats || {};

  // Profile fields (Finnhub profile marketCapitalization is already in Millions USD)
  const marketCapVal = typeof p.marketCapitalization === 'number'
    ? p.marketCapitalization
    : (typeof s.market_cap === 'number' ? s.market_cap : null);

  const evVal = typeof p.enterpriseValue === 'number'
    ? p.enterpriseValue
    : (typeof m.enterpriseValue === 'number' ? m.enterpriseValue : null);

  const sharesVal = typeof p.shareOutstanding === 'number'
    ? p.shareOutstanding
    : null;

  // Revenues TTM (in Millions USD)
  const revTTM = typeof s.revenues === 'number'
    ? s.revenues
    : (typeof m.revenueTTM === 'number'
      ? m.revenueTTM
      : (typeof m.revenuePerShareTTM === 'number' && typeof sharesVal === 'number'
        ? m.revenuePerShareTTM * sharesVal
        : null));

  // 52W High / Low
  const h52 = typeof m['52WeekHigh'] === 'number' ? m['52WeekHigh'] : (typeof s.fifty_two_week_high === 'number' ? s.fifty_two_week_high : null);
  const l52 = typeof m['52WeekLow'] === 'number' ? m['52WeekLow'] : (typeof s.fifty_two_week_low === 'number' ? s.fifty_two_week_low : null);
  const highLow52Str = (h52 !== null && l52 !== null) ? `$${h52.toFixed(1)} / $${l52.toFixed(1)}` : '—';

  // ATH / ATL
  const ath = typeof s.all_time_high === 'number' ? s.all_time_high : null;
  const atl = typeof s.all_time_low === 'number' ? s.all_time_low : null;
  const athAtlStr = (ath !== null && atl !== null) ? `$${ath.toFixed(1)} / $${atl.toFixed(1)}` : '—';

  // Margins TTM
  const grossMargin = typeof m.grossMarginTTM === 'number'
    ? m.grossMarginTTM
    : (typeof s.gross_profit_margin === 'number' ? s.gross_profit_margin * 100 : null);

  const ebitdaMargin = typeof m.ebitdPerShareTTM === 'number' && typeof m.revenuePerShareTTM === 'number' && m.revenuePerShareTTM > 0
    ? (m.ebitdPerShareTTM / m.revenuePerShareTTM) * 100
    : null;

  const opMargin = typeof m.operatingMarginTTM === 'number'
    ? m.operatingMarginTTM
    : (typeof s.operating_margin === 'number' ? s.operating_margin * 100 : null);

  const pretaxMargin = typeof m.pretaxMarginTTM === 'number' ? m.pretaxMarginTTM : null;
  const netMargin = typeof m.netProfitMarginTTM === 'number' ? m.netProfitMarginTTM : null;
  const fcfMargin = typeof s.fcf_margin === 'number'
    ? s.fcf_margin * 100
    : (typeof m.psTTM === 'number' && typeof m.pfcfShareTTM === 'number' && m.pfcfShareTTM > 0
      ? (m.psTTM / m.pfcfShareTTM) * 100
      : null);

  // Returns
  const roaTTM = typeof m.roaTTM === 'number' ? m.roaTTM : null;
  const roa5Y = typeof m.roa5Y === 'number' ? m.roa5Y : (typeof m.roaRfy === 'number' ? m.roaRfy : null);
  const roaStr = (roaTTM !== null && roa5Y !== null) ? `${roaTTM.toFixed(1)}% / ${roa5Y.toFixed(1)}%` : (roaTTM !== null ? `${roaTTM.toFixed(1)}%` : '—');

  const roeTTM = typeof m.roeTTM === 'number' ? m.roeTTM : null;
  const roe5Y = typeof m.roe5Y === 'number' ? m.roe5Y : (typeof m.roeRfy === 'number' ? m.roeRfy : null);
  const roeStr = (roeTTM !== null && roe5Y !== null) ? `${roeTTM.toFixed(1)}% / ${roe5Y.toFixed(1)}%` : (roeTTM !== null ? `${roeTTM.toFixed(1)}%` : '—');

  const roiTTM = typeof m.roiTTM === 'number' ? m.roiTTM : null;
  const roi5Y = typeof m.roi5Y === 'number' ? m.roi5Y : null;
  const roiStr = (roiTTM !== null && roi5Y !== null) ? `${roiTTM.toFixed(1)}% / ${roi5Y.toFixed(1)}%` : (roiTTM !== null ? `${roiTTM.toFixed(1)}%` : '—');

  const assetTurnover = typeof m.assetTurnoverTTM === 'number' ? m.assetTurnoverTTM : null;

  // Valuation TTM
  const pe = typeof m.peBasicExclExtraTTM === 'number' ? m.peBasicExclExtraTTM : (typeof m.peTTM === 'number' ? m.peTTM : (typeof s.p_e === 'number' ? s.p_e : null));
  const pb = typeof m.pbQuarterly === 'number' ? m.pbQuarterly : (typeof m.pbAnnual === 'number' ? m.pbAnnual : (typeof m.pb === 'number' ? m.pb : null));
  const ps = typeof m.psTTM === 'number' ? m.psTTM : (typeof s.ev_sales === 'number' ? s.ev_sales : null);
  const evSales = typeof m.evRevenueTTM === 'number' ? m.evRevenueTTM : (typeof s.ev_sales === 'number' ? s.ev_sales : null);
  const evEbitda = typeof m.evEbitdaTTM === 'number' ? m.evEbitdaTTM : null;
  const evEbit = typeof s.ev_ebit === 'number' ? s.ev_ebit : null;
  const pOcf = typeof m.pcfShareTTM === 'number' ? m.pcfShareTTM : (typeof s.p_ocf === 'number' ? s.p_ocf : null);
  const pFcf = typeof m.pfcfShareTTM === 'number' ? m.pfcfShareTTM : (typeof s.p_fcf === 'number' ? s.p_fcf : null);

  // Valuation Forward & Intrinsic
  const fwdPe = typeof m.forwardPE === 'number' ? m.forwardPE : (typeof m.peNormalizedAnnual === 'number' ? m.peNormalizedAnnual : null);
  const pegTtm = typeof m.pegTTM === 'number' ? m.pegTTM : null;
  const fwdPeg = typeof m.pegNormal === 'number' ? m.pegNormal : (typeof m.forwardPEG === 'number' ? m.forwardPEG : null);

  const dcfFairValue = typeof dcfCalc?.implied_share_price === 'number' ? dcfCalc.implied_share_price : null;
  let marginOfSafety: number | null = null;
  if (dcfFairValue !== null && dcfFairValue > 0 && typeof currentPrice === 'number' && currentPrice > 0) {
    marginOfSafety = ((dcfFairValue - currentPrice) / dcfFairValue) * 100;
  }

  // Financial Health
  const cashVal = typeof s.total_cash === 'number' ? s.total_cash : null;
  const debtVal = typeof s.total_debt === 'number' ? s.total_debt : (typeof m.totalDebtQuarterly === 'number' ? m.totalDebtQuarterly : null);
  const netDebtVal = typeof s.net_debt === 'number' ? s.net_debt : (typeof m.netDebtQuarterly === 'number' ? m.netDebtQuarterly : null);
  const deVal = typeof m['totalDebt/totalEquityQuarterly'] === 'number'
    ? m['totalDebt/totalEquityQuarterly']
    : (typeof s.debt_equity === 'number' ? s.debt_equity : null);
  const curRatio = typeof m.currentRatioQuarterly === 'number' ? m.currentRatioQuarterly : null;
  const intCoverage = typeof m.netInterestCoverageTTM === 'number' ? m.netInterestCoverageTTM : null;

  // Growth & Dividends
  const revGrowthQYoy = typeof m.revenueGrowthQuarterlyYoy === 'number'
    ? m.revenueGrowthQuarterlyYoy
    : (typeof s.revenue_growth_quarterly_yoy === 'number' ? s.revenue_growth_quarterly_yoy * 100 : null);

  const revGrowth1Y = typeof m.revenueGrowthTTMYoy === 'number'
    ? m.revenueGrowthTTMYoy
    : (typeof s.revenue_1y_growth === 'number' ? s.revenue_1y_growth * 100 : null);

  const revGrowth3Y = typeof m.revenueGrowth3Y === 'number'
    ? m.revenueGrowth3Y
    : (typeof s.revenue_3y_cagr === 'number' ? s.revenue_3y_cagr * 100 : null);

  const revGrowth5Y = typeof m.revenueGrowth5Y === 'number'
    ? m.revenueGrowth5Y
    : (typeof s.revenue_5y_cagr === 'number' ? s.revenue_5y_cagr * 100 : null);

  const epsGrowth1Y = typeof m.epsGrowthTTMYoy === 'number' ? m.epsGrowthTTMYoy : null;
  const epsGrowth3Y = typeof m.epsGrowth3Y === 'number' ? m.epsGrowth3Y : null;
  const epsGrowth5Y = typeof m.epsGrowth5Y === 'number' ? m.epsGrowth5Y : null;
  const ebitdaCagr5Y = typeof m.ebitdaCagr5Y === 'number' ? m.ebitdaCagr5Y : null;
  const fcfCagr5Y = typeof m.focfCagr5Y === 'number' ? m.focfCagr5Y : null;
  const capexCagr5Y = typeof m.capexCagr5Y === 'number' ? m.capexCagr5Y : null;
  const tbvCagr5Y = typeof m.tbvCagr5Y === 'number' ? m.tbvCagr5Y : null;

  const divYield = typeof m.currentDividendYieldTTM === 'number'
    ? m.currentDividendYieldTTM
    : (typeof s.dividend_yield === 'number' ? s.dividend_yield * 100 : null);

  const payoutRatio = typeof m.payoutRatioTTM === 'number' ? m.payoutRatioTTM : null;
  const dpsIndicated = typeof m.dividendIndicatedAnnual === 'number' ? m.dividendIndicatedAnnual : null;
  const rdRev = typeof s.rd_to_revenue === 'number' ? s.rd_to_revenue * 100 : null;
  const capexOcf = typeof s.capex_to_ocf === 'number' ? s.capex_to_ocf * 100 : null;
  const revEmployee = typeof m.revenueEmployeeTTM === 'number' ? m.revenueEmployeeTTM : null;

  return {
    profileMarginsReturns: [
      {
        category: 'Profile',
        items: [
          { label: 'Market Cap', value: formatCompactCurrency(marketCapVal), raw: marketCapVal },
          { label: 'Enterprise Value', value: formatCompactCurrency(evVal), raw: evVal },
          { label: 'Shares Out', value: formatShares(sharesVal), raw: sharesVal },
          { label: 'Revenue (TTM)', value: formatCompactCurrency(revTTM), raw: revTTM },
          { label: '52W High / Low', value: highLow52Str },
          { label: 'ATH / ATL', value: athAtlStr },
        ],
      },
      {
        category: 'Margins (TTM)',
        items: [
          { label: 'Gross', value: formatPercent(grossMargin), raw: grossMargin },
          { label: 'EBITDA', value: formatPercent(ebitdaMargin), raw: ebitdaMargin },
          { label: 'Operating', value: formatPercent(opMargin), raw: opMargin },
          { label: 'Pre-Tax', value: formatPercent(pretaxMargin), raw: pretaxMargin },
          { label: 'Net', value: formatPercent(netMargin), raw: netMargin },
          { label: 'FCF', value: formatPercent(fcfMargin), raw: fcfMargin },
        ],
      },
      {
        category: 'Returns (TTM / 5Y Avg)',
        items: [
          { label: 'ROA (TTM / 5Y)', value: roaStr },
          { label: 'ROE (TTM / 5Y)', value: roeStr },
          { label: 'ROI (TTM / 5Y)', value: roiStr },
          { label: 'Asset Turnover', value: formatMultiple(assetTurnover) },
        ],
      },
    ],
    valuationHealth: [
      {
        category: 'Valuation (TTM)',
        items: [
          { label: 'P/E', value: formatMultiple(pe), raw: pe },
          { label: 'P/B', value: formatMultiple(pb), raw: pb },
          { label: 'P/S', value: formatMultiple(ps), raw: ps },
          { label: 'EV/Sales', value: formatMultiple(evSales), raw: evSales },
          { label: 'EV/EBITDA', value: formatMultiple(evEbitda), raw: evEbitda },
          { label: 'EV/EBIT', value: formatMultiple(evEbit), raw: evEbit },
          { label: 'P/OCF', value: formatMultiple(pOcf), raw: pOcf },
          { label: 'P/FCF', value: formatMultiple(pFcf), raw: pFcf },
        ],
      },
      {
        category: 'Valuation (Forward & Intrinsic)',
        items: [
          { label: 'Forward P/E', value: formatMultiple(fwdPe), raw: fwdPe },
          { label: 'PEG (TTM)', value: formatRatio(pegTtm), raw: pegTtm },
          { label: 'Forward PEG', value: formatRatio(fwdPeg), raw: fwdPeg },
          { label: 'DCF Base Value', value: dcfFairValue !== null ? `$${dcfFairValue.toFixed(2)}` : '—', raw: dcfFairValue },
          {
            label: 'Margin of Safety',
            value: marginOfSafety !== null ? `${marginOfSafety > 0 ? '+' : ''}${marginOfSafety.toFixed(1)}%` : '—',
            raw: marginOfSafety,
            highlight: (marginOfSafety !== null ? (marginOfSafety > 0 ? 'positive' : 'negative') : 'neutral') as 'positive' | 'negative' | 'neutral',
          },
        ],
      },
      {
        category: 'Financial Health',
        items: [
          { label: 'Cash', value: formatCompactCurrency(cashVal), raw: cashVal },
          { label: 'Total Debt', value: formatCompactCurrency(debtVal), raw: debtVal },
          { label: 'Net Debt', value: formatCompactCurrency(netDebtVal), raw: netDebtVal },
          { label: 'Debt/Equity', value: formatRatio(deVal), raw: deVal },
          { label: 'Current Ratio', value: formatRatio(curRatio), raw: curRatio },
          { label: 'EBIT/Interest', value: formatMultiple(intCoverage), raw: intCoverage },
        ],
      },
    ],
    growthDividends: [
      {
        category: 'Growth (CAGR / YoY)',
        items: [
          { label: 'Rev Growth (Q YoY)', value: formatPercent(revGrowthQYoy), raw: revGrowthQYoy },
          { label: 'Rev 1Yr (TTM)', value: formatPercent(revGrowth1Y), raw: revGrowth1Y },
          { label: 'Rev 3Yr CAGR', value: formatPercent(revGrowth3Y), raw: revGrowth3Y },
          { label: 'Rev 5Yr CAGR', value: formatPercent(revGrowth5Y), raw: revGrowth5Y },
          { label: 'EPS 1Yr (TTM)', value: formatPercent(epsGrowth1Y), raw: epsGrowth1Y },
          { label: 'Dil EPS 3Yr CAGR', value: formatPercent(epsGrowth3Y), raw: epsGrowth3Y },
          { label: 'Dil EPS 5Yr CAGR', value: formatPercent(epsGrowth5Y), raw: epsGrowth5Y },
          { label: 'EBITDA 5Yr CAGR', value: formatPercent(ebitdaCagr5Y), raw: ebitdaCagr5Y },
          { label: 'FCF 5Yr CAGR', value: formatPercent(fcfCagr5Y), raw: fcfCagr5Y },
          { label: 'CapEx 5Yr CAGR', value: formatPercent(capexCagr5Y), raw: capexCagr5Y },
          { label: 'TBV 5Yr CAGR', value: formatPercent(tbvCagr5Y), raw: tbvCagr5Y },
        ],
      },
      {
        category: 'Dividends & R&D Efficiency',
        items: [
          { label: 'Dividend Yield', value: formatPercent(divYield), raw: divYield },
          { label: 'Payout Ratio', value: formatPercent(payoutRatio), raw: payoutRatio },
          { label: 'DPS (Indicated)', value: dpsIndicated !== null ? `$${dpsIndicated.toFixed(2)}` : '—', raw: dpsIndicated },
          { label: 'R&D / Revenue', value: formatPercent(rdRev), raw: rdRev },
          { label: 'CapEx / OCF', value: formatPercent(capexOcf), raw: capexOcf },
          { label: 'Rev / Employee', value: revEmployee !== null ? `$${revEmployee.toFixed(2)}M` : '—', raw: revEmployee },
        ],
      },
    ],
  };
}

export async function fetchFinancialOverview(
  env: any,
  rawSymbol: string,
  forceRefresh = false
): Promise<CompanyOverviewPayload> {
  const symbol = rawSymbol.trim().toUpperCase();
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const now = new Date();

  // 1. Check existing D1 cached record in market_stats
  let existingRow: any = null;
  try {
    existingRow = await env.DB.prepare(
      'SELECT symbol, market_cap, revenues, revenue_3y_cagr, revenue_1y_growth, gross_profit_margin, operating_margin, ev_ebit, ev_sales, p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity, p_e, fcf_margin, total_cash, total_debt, net_debt, dividend_yield, fifty_two_week_high, fifty_two_week_low, all_time_high, all_time_low, overview_json, overview_updated_at FROM market_stats WHERE symbol = ?'
    ).bind(symbol).first();
  } catch (err) {
    console.warn(`[fetchFinancialOverview] Error querying market_stats for ${symbol}:`, err);
  }

  if (existingRow?.overview_json && !forceRefresh) {
    const updatedAt = existingRow.overview_updated_at ? new Date(existingRow.overview_updated_at).getTime() : 0;
    if (Date.now() - updatedAt < SIX_HOURS_MS) {
      try {
        const cached = JSON.parse(existingRow.overview_json);
        if (cached && Array.isArray(cached.quarterly)) {
          return cached;
        }
      } catch (err) {
        console.warn(`[fetchFinancialOverview] Corrupt overview_json cache for ${symbol}, refetching:`, err);
      }
    }
  }

  // 2. Fetch external & D1 data in parallel
  const apiKey = env.FINNHUB_API_KEY;
  const encodedSymbol = encodeURIComponent(symbol);

  const fetchFinnhubMetric = apiKey
    ? fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodedSymbol}&metric=all&token=${apiKey}`)
        .then(r => r.ok ? r.json() : null)
        .catch(e => { console.warn(`Finnhub metric fetch failed for ${symbol}:`, e); return null; })
    : Promise.resolve(null);

  const fetchFinnhubProfile = apiKey
    ? fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodedSymbol}&token=${apiKey}`)
        .then(r => r.ok ? r.json() : null)
        .catch(e => { console.warn(`Finnhub profile2 fetch failed for ${symbol}:`, e); return null; })
    : Promise.resolve(null);

  const fetchFinnhubQuote = apiKey
    ? fetch(`https://finnhub.io/api/v1/quote?symbol=${encodedSymbol}&token=${apiKey}`)
        .then(r => r.ok ? r.json() : null)
        .catch(e => { console.warn(`Finnhub quote fetch failed for ${symbol}:`, e); return null; })
    : Promise.resolve(null);

  const yfQuarterlyUrl = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodedSymbol}?type=quarterlyTotalRevenue,quarterlyGrossProfit,quarterlyOperatingIncome,quarterlyOperatingCashFlow,quarterlyFreeCashFlow&period1=1600000000&period2=2100000000`;
  const fetchYfQuarterly = fetch(yfQuarterlyUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    .then(r => r.ok ? r.json() : null)
    .catch(e => { console.warn(`Yahoo timeseries quarterly fetch failed for ${symbol}:`, e); return null; });

  const yfAnnualUrl = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodedSymbol}?type=annualTotalRevenue,annualGrossProfit,annualOperatingIncome,annualOperatingCashFlow,annualFreeCashFlow&period1=1500000000&period2=2100000000`;
  const fetchYfAnnual = fetch(yfAnnualUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    .then(r => r.ok ? r.json() : null)
    .catch(e => { console.warn(`Yahoo timeseries annual fetch failed for ${symbol}:`, e); return null; });

  const fetchDcf = env.DB.prepare(
    'SELECT implied_share_price FROM dcf_calculations WHERE symbol = ? AND scenario_name = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(symbol, 'Base Case').first().catch((e: any) => { console.warn(`DCF query failed for ${symbol}:`, e); return null; });

  const fetchWatchlist = env.DB.prepare(
    'SELECT sector_label FROM watchlist WHERE symbol = ? LIMIT 1'
  ).bind(symbol).first().catch((e: any) => { console.warn(`Watchlist query failed for ${symbol}:`, e); return null; });

  const [
    finnhubMetricRes,
    finnhubProfileRes,
    finnhubQuoteRes,
    yfQuarterlyRes,
    yfAnnualRes,
    dcfRes,
    watchlistRes,
  ] = await Promise.all([
    fetchFinnhubMetric,
    fetchFinnhubProfile,
    fetchFinnhubQuote,
    fetchYfQuarterly,
    fetchYfAnnual,
    fetchDcf,
    fetchWatchlist,
  ]);

  // Read previous periods from existing cached overview if any
  let prevQuarterly: FinancialBarPeriod[] = [];
  let prevAnnual: FinancialBarPeriod[] = [];
  if (existingRow?.overview_json) {
    try {
      const prev = JSON.parse(existingRow.overview_json);
      if (Array.isArray(prev.quarterly)) prevQuarterly = prev.quarterly;
      if (Array.isArray(prev.annual)) prevAnnual = prev.annual;
    } catch {}
  }

  // Parse incoming timeseries
  const incomingQuarterly = parseYahooTimeseries(yfQuarterlyRes, 'quarterly');
  const incomingAnnual = parseYahooTimeseries(yfAnnualRes, 'annual');

  const mergedQuarterly = mergeFinancialPeriods(prevQuarterly, incomingQuarterly, 8);
  const mergedAnnual = mergeFinancialPeriods(prevAnnual, incomingAnnual, 6);

  const currentPrice = (finnhubQuoteRes as any)?.c ?? null;

  const companyStats = buildCompanyStatistics({
    finnhubMetric: (finnhubMetricRes as any)?.metric || {},
    finnhubProfile: (finnhubProfileRes as any) || {},
    marketStats: existingRow,
    dcfCalc: dcfRes as any,
    currentPrice,
  });

  const profile = (finnhubProfileRes as any) || {};

  const payload: CompanyOverviewPayload = {
    symbol,
    name: profile.name || symbol,
    logo: profile.logo || null,
    sector: (watchlistRes as any)?.sector_label || profile.finnhubIndustry || 'General',
    industry: profile.finnhubIndustry || (watchlistRes as any)?.sector_label || '—',
    exchange: profile.exchange || '—',
    ipoDate: profile.ipo || null,
    currency: 'USD',
    quarterly: mergedQuarterly,
    annual: mergedAnnual,
    companyStatistics: companyStats,
    updatedAt: now.toISOString(),
  };

  // 3. Persist to D1 market_stats asynchronously
  const serialized = JSON.stringify(payload);
  const isoNow = now.toISOString();

  try {
    if (existingRow) {
      await env.DB.prepare(
        'UPDATE market_stats SET overview_json = ?, overview_updated_at = ? WHERE symbol = ?'
      ).bind(serialized, isoNow, symbol).run();
    } else {
      await env.DB.prepare(
        'INSERT INTO market_stats (symbol, overview_json, overview_updated_at) VALUES (?, ?, ?)'
      ).bind(symbol, serialized, isoNow).run();
    }
  } catch (err) {
    console.warn(`[fetchFinancialOverview] Error saving overview cache to D1 for ${symbol}:`, err);
  }

  return payload;
}
