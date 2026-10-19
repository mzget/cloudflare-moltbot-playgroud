/**
 * Pure Functional Programming Portfolio Risk & Position Sizing Engine.
 * All computations are deterministic, side-effect-free, and use readonly data structures.
 */

export interface RiskCapConfig {
  readonly targetWeightPct: number;      // default: 8%
  readonly stockWarningPct: number;      // default: 10%
  readonly maxStockCapPct: number;       // default: 15%
  readonly themeWarningPct: number;      // default: 25%
  readonly maxThemeCapPct: number;       // default: 30%
  readonly correlationThreshold: number; // default: 0.70
}

export const DEFAULT_RISK_CONFIG: RiskCapConfig = {
  targetWeightPct: 8,
  stockWarningPct: 10,
  maxStockCapPct: 15,
  themeWarningPct: 25,
  maxThemeCapPct: 30,
  correlationThreshold: 0.70,
};

export interface RiskHoldingInput {
  readonly symbol: string;
  readonly shares: number;
  readonly lastPrice: number | null;
  readonly status?: string | null;
}

export interface ThemeMappingInput {
  readonly symbol: string;
  readonly themeName: string;
  readonly notebookId?: string;
}

export interface StockConcentration {
  readonly symbol: string;
  readonly marketValueUsd: number;
  readonly weightPct: number;
  readonly status: 'ok' | 'warning' | 'breach';
  readonly trimToCapUsd: number;
  readonly trimToCapShares: number;
  readonly themes: readonly string[];
}

export interface ThemeExposure {
  readonly themeName: string;
  readonly marketValueUsd: number;
  readonly weightPct: number;
  readonly status: 'ok' | 'warning' | 'breach';
  readonly symbols: readonly string[];
  readonly roomToCapUsd: number;
  readonly isUnassigned: boolean;
}

export interface PortfolioConcentrationAudit {
  readonly totalStockPortfolioUsd: number;
  readonly openHoldingsCount: number;
  readonly stockConcentrations: readonly StockConcentration[];
  readonly themeExposures: readonly ThemeExposure[];
  readonly hhi: number;
  readonly effectivePositions: number;
  readonly top3ConcentrationPct: number;
  readonly top5ConcentrationPct: number;
}

export interface PricePoint {
  readonly date: string;
  readonly close: number;
}

export type PriceSeriesBySymbol = {
  readonly [symbol: string]: readonly PricePoint[];
};

export interface HighCorrelationPair {
  readonly symbolA: string;
  readonly symbolB: string;
  readonly correlation: number;
  readonly combinedWeightPct: number;
}

export interface PortfolioCorrelationAndBetaResult {
  readonly stockBetas: { readonly [symbol: string]: number };
  readonly stockAnnualizedVolatilities: { readonly [symbol: string]: number };
  readonly portfolioBeta: number;
  readonly highCorrelationPairs: readonly HighCorrelationPair[];
}

export interface SizingInput {
  readonly symbol: string;
  readonly currentPrice: number;
  readonly audit: PortfolioConcentrationAudit;
  readonly themeMappings: readonly ThemeMappingInput[];
  readonly config?: RiskCapConfig;
}

export interface PositionSizingResult {
  readonly symbol: string;
  readonly currentPrice: number;
  readonly currentMarketValueUsd: number;
  readonly currentWeightPct: number;
  readonly targetWeightPct: number;
  readonly maxStockCapPct: number;
  readonly maxThemeCapPct: number;
  readonly roomToTargetUsd: number;
  readonly roomToTargetShares: number;
  readonly roomToStockCapUsd: number;
  readonly roomToStockCapShares: number;
  readonly strictestTheme: ThemeExposure | null;
  readonly roomToThemeCapUsd: number | null;
  readonly maxAllowedBuyUsd: number;
  readonly maxAllowedBuyShares: number;
  readonly bindingCapReason: string;
}

export interface PreTradeSimulationOrder {
  readonly symbol: string;
  readonly type: 'Buy' | 'Sell';
  readonly shares: number;
  readonly price: number;
}

export interface PreTradeSimulationResult {
  readonly symbol: string;
  readonly type: 'Buy' | 'Sell';
  readonly tradeValueUsd: number;
  readonly currentStockWeightPct: number;
  readonly projectedStockWeightPct: number;
  readonly causesStockCapBreach: boolean;
  readonly affectedThemes: readonly {
    readonly themeName: string;
    readonly currentWeightPct: number;
    readonly projectedWeightPct: number;
    readonly isBreach: boolean;
  }[];
  readonly causesThemeCapBreach: boolean;
}

export interface HealthScoreDeduction {
  readonly reason: string;
  readonly points: number;
}

export interface PortfolioHealthScoreResult {
  readonly healthScore: number;
  readonly riskLevel: 'Low' | 'Moderate' | 'Elevated' | 'High';
  readonly deductions: readonly HealthScoreDeduction[];
}

/**
 * 1. Compute Stock & Theme Concentration Audit
 */
export function computeConcentrationAudit(
  holdings: readonly RiskHoldingInput[],
  themeMappings: readonly ThemeMappingInput[],
  config: RiskCapConfig = DEFAULT_RISK_CONFIG
): PortfolioConcentrationAudit {
  const openHoldings = holdings.filter(h => (h.status || 'Open').toLowerCase() === 'open');

  const stockValueMap = new Map<string, number>();
  let totalStockPortfolioUsd = 0;

  for (const h of openHoldings) {
    const val = (h.shares > 0 && h.lastPrice && h.lastPrice > 0)
      ? h.shares * h.lastPrice
      : 0;
    stockValueMap.set(h.symbol, val);
    totalStockPortfolioUsd += val;
  }

  // Symbol -> themes array
  const symbolThemesMap = new Map<string, string[]>();
  const themeSymbolsMap = new Map<string, Set<string>>();

  for (const tm of themeMappings) {
    if (!symbolThemesMap.has(tm.symbol)) {
      symbolThemesMap.set(tm.symbol, []);
    }
    const themes = symbolThemesMap.get(tm.symbol)!;
    if (!themes.includes(tm.themeName)) {
      themes.push(tm.themeName);
    }

    if (!themeSymbolsMap.has(tm.themeName)) {
      themeSymbolsMap.set(tm.themeName, new Set());
    }
    themeSymbolsMap.get(tm.themeName)!.add(tm.symbol);
  }

  // Build stock concentrations
  const stockConcentrations: StockConcentration[] = openHoldings.map(h => {
    const marketValueUsd = stockValueMap.get(h.symbol) || 0;
    const weightPct = totalStockPortfolioUsd > 0
      ? (marketValueUsd / totalStockPortfolioUsd) * 100
      : 0;

    let status: 'ok' | 'warning' | 'breach' = 'ok';
    if (weightPct > config.maxStockCapPct) {
      status = 'breach';
    } else if (weightPct >= config.stockWarningPct) {
      status = 'warning';
    }

    const trimToCapUsd = weightPct > config.maxStockCapPct
      ? Math.max(0, marketValueUsd - (config.maxStockCapPct / 100) * totalStockPortfolioUsd)
      : 0;

    const trimToCapShares = trimToCapUsd > 0 && h.lastPrice && h.lastPrice > 0
      ? trimToCapUsd / h.lastPrice
      : 0;

    const themes = symbolThemesMap.get(h.symbol);
    const assignedThemes = themes && themes.length > 0 ? themes : ['Unassigned'];

    return {
      symbol: h.symbol,
      marketValueUsd,
      weightPct,
      status,
      trimToCapUsd,
      trimToCapShares,
      themes: assignedThemes,
    };
  }).sort((a, b) => b.marketValueUsd - a.marketValueUsd);

  // Build theme exposures
  const themeExposures: ThemeExposure[] = [];
  const coveredSymbols = new Set<string>();

  for (const [themeName, symbolsSet] of themeSymbolsMap.entries()) {
    // Collect open holdings that match this theme
    const openSymbolsInTheme = openHoldings
      .filter(h => symbolsSet.has(h.symbol))
      .map(h => h.symbol);

    if (openSymbolsInTheme.length === 0) continue;

    openSymbolsInTheme.forEach(s => coveredSymbols.add(s));

    const themeValueUsd = openSymbolsInTheme.reduce(
      (sum, sym) => sum + (stockValueMap.get(sym) || 0),
      0
    );
    const weightPct = totalStockPortfolioUsd > 0
      ? (themeValueUsd / totalStockPortfolioUsd) * 100
      : 0;

    let status: 'ok' | 'warning' | 'breach' = 'ok';
    if (weightPct > config.maxThemeCapPct) {
      status = 'breach';
    } else if (weightPct >= config.themeWarningPct) {
      status = 'warning';
    }

    const roomToCapUsd = Math.max(
      0,
      (config.maxThemeCapPct / 100) * totalStockPortfolioUsd - themeValueUsd
    );

    themeExposures.push({
      themeName,
      marketValueUsd: themeValueUsd,
      weightPct,
      status,
      symbols: openSymbolsInTheme,
      roomToCapUsd,
      isUnassigned: false,
    });
  }

  // Handle unassigned stocks
  const unassignedSymbols = openHoldings
    .filter(h => !coveredSymbols.has(h.symbol))
    .map(h => h.symbol);

  if (unassignedSymbols.length > 0) {
    const unassignedValueUsd = unassignedSymbols.reduce(
      (sum, sym) => sum + (stockValueMap.get(sym) || 0),
      0
    );
    const weightPct = totalStockPortfolioUsd > 0
      ? (unassignedValueUsd / totalStockPortfolioUsd) * 100
      : 0;

    themeExposures.push({
      themeName: 'Unassigned',
      marketValueUsd: unassignedValueUsd,
      weightPct,
      status: 'ok', // Unassigned never blocks
      symbols: unassignedSymbols,
      roomToCapUsd: 0,
      isUnassigned: true,
    });
  }

  themeExposures.sort((a, b) => b.marketValueUsd - a.marketValueUsd);

  // Compute HHI, Effective Positions, and Top concentration
  let hhi = 0;
  if (totalStockPortfolioUsd > 0) {
    for (const sc of stockConcentrations) {
      const fraction = sc.weightPct / 100;
      hhi += fraction * fraction;
    }
  }

  const effectivePositions = hhi > 0 ? 1 / hhi : 0;

  const top3ConcentrationPct = stockConcentrations
    .slice(0, 3)
    .reduce((sum, s) => sum + s.weightPct, 0);

  const top5ConcentrationPct = stockConcentrations
    .slice(0, 5)
    .reduce((sum, s) => sum + s.weightPct, 0);

  return {
    totalStockPortfolioUsd,
    openHoldingsCount: openHoldings.length,
    stockConcentrations,
    themeExposures,
    hhi,
    effectivePositions,
    top3ConcentrationPct,
    top5ConcentrationPct,
  };
}

/**
 * 2. Position Sizing Engine with Fixed Current Portfolio Denominator
 */
export function calculateFixedBasePositionSize(input: SizingInput): PositionSizingResult {
  const { symbol, currentPrice, audit, themeMappings } = input;
  const config = input.config || DEFAULT_RISK_CONFIG;

  const totalStockPortfolioUsd = audit.totalStockPortfolioUsd;
  const existingStock = audit.stockConcentrations.find(s => s.symbol === symbol);
  const currentMarketValueUsd = existingStock ? existingStock.marketValueUsd : 0;
  const currentWeightPct = existingStock ? existingStock.weightPct : 0;

  const targetBudgetUsd = (config.targetWeightPct / 100) * totalStockPortfolioUsd;
  const stockCapBudgetUsd = (config.maxStockCapPct / 100) * totalStockPortfolioUsd;
  const themeCapBudgetUsd = (config.maxThemeCapPct / 100) * totalStockPortfolioUsd;

  const roomToTargetUsd = Math.max(0, targetBudgetUsd - currentMarketValueUsd);
  const roomToStockCapUsd = Math.max(0, stockCapBudgetUsd - currentMarketValueUsd);

  // Identify themes for this symbol
  const mappedThemeNames = themeMappings
    .filter(tm => tm.symbol === symbol)
    .map(tm => tm.themeName);

  let strictestTheme: ThemeExposure | null = null;
  let roomToThemeCapUsd: number | null = null;

  if (mappedThemeNames.length > 0) {
    // Find all theme exposures that match
    const matchingThemes = audit.themeExposures.filter(
      te => !te.isUnassigned && mappedThemeNames.includes(te.themeName)
    );

    if (matchingThemes.length > 0) {
      // Pick theme with highest exposure (highest marketValueUsd / weightPct)
      strictestTheme = matchingThemes.reduce((prev, curr) =>
        curr.marketValueUsd > prev.marketValueUsd ? curr : prev
      );
      roomToThemeCapUsd = Math.max(0, themeCapBudgetUsd - strictestTheme.marketValueUsd);
    } else {
      // Theme exists in mappings but no open holdings yet in that theme
      strictestTheme = {
        themeName: mappedThemeNames[0],
        marketValueUsd: 0,
        weightPct: 0,
        status: 'ok',
        symbols: [symbol],
        roomToCapUsd: themeCapBudgetUsd,
        isUnassigned: false,
      };
      roomToThemeCapUsd = themeCapBudgetUsd;
    }
  }

  let maxAllowedBuyUsd: number;
  let bindingCapReason: string;

  if (roomToThemeCapUsd !== null && roomToThemeCapUsd < roomToStockCapUsd) {
    maxAllowedBuyUsd = roomToThemeCapUsd;
    bindingCapReason = `Strictest Theme Cap Reached (${strictestTheme!.themeName} at ${strictestTheme!.weightPct.toFixed(1)}%)`;
  } else {
    maxAllowedBuyUsd = roomToStockCapUsd;
    bindingCapReason = `Single-Stock Cap (${config.maxStockCapPct}%)`;
  }

  const roomToTargetShares = currentPrice > 0 ? Math.floor(roomToTargetUsd / currentPrice) : 0;
  const roomToStockCapShares = currentPrice > 0 ? Math.floor(roomToStockCapUsd / currentPrice) : 0;
  const maxAllowedBuyShares = currentPrice > 0 ? Math.floor(maxAllowedBuyUsd / currentPrice) : 0;

  return {
    symbol,
    currentPrice,
    currentMarketValueUsd,
    currentWeightPct,
    targetWeightPct: config.targetWeightPct,
    maxStockCapPct: config.maxStockCapPct,
    maxThemeCapPct: config.maxThemeCapPct,
    roomToTargetUsd,
    roomToTargetShares,
    roomToStockCapUsd,
    roomToStockCapShares,
    strictestTheme,
    roomToThemeCapUsd,
    maxAllowedBuyUsd,
    maxAllowedBuyShares,
    bindingCapReason,
  };
}

/**
 * 3. Simulate Pre-Trade Impact
 */
export function simulatePreTradeImpact(input: {
  readonly audit: PortfolioConcentrationAudit;
  readonly order: PreTradeSimulationOrder;
  readonly themeMappings: readonly ThemeMappingInput[];
  readonly config?: RiskCapConfig;
}): PreTradeSimulationResult {
  const { audit, order, themeMappings } = input;
  const config = input.config || DEFAULT_RISK_CONFIG;

  const tradeDeltaUsd = order.type === 'Buy'
    ? order.shares * order.price
    : -order.shares * order.price;

  const currentStock = audit.stockConcentrations.find(s => s.symbol === order.symbol);
  const currentStockValue = currentStock ? currentStock.marketValueUsd : 0;
  const projectedStockValue = Math.max(0, currentStockValue + tradeDeltaUsd);

  const denom = audit.totalStockPortfolioUsd > 0 ? audit.totalStockPortfolioUsd : projectedStockValue;
  const currentStockWeightPct = denom > 0 ? (currentStockValue / denom) * 100 : 0;
  const projectedStockWeightPct = denom > 0 ? (projectedStockValue / denom) * 100 : 0;

  const causesStockCapBreach = projectedStockWeightPct > config.maxStockCapPct;

  // Affected themes
  const mappedThemes = themeMappings
    .filter(tm => tm.symbol === order.symbol)
    .map(tm => tm.themeName);

  const affectedThemes = mappedThemes.map(themeName => {
    const existingTheme = audit.themeExposures.find(t => t.themeName === themeName);
    const curVal = existingTheme ? existingTheme.marketValueUsd : 0;
    const projVal = Math.max(0, curVal + tradeDeltaUsd);
    const currentWeightPct = denom > 0 ? (curVal / denom) * 100 : 0;
    const projectedWeightPct = denom > 0 ? (projVal / denom) * 100 : 0;

    return {
      themeName,
      currentWeightPct,
      projectedWeightPct,
      isBreach: projectedWeightPct > config.maxThemeCapPct,
    };
  });

  const causesThemeCapBreach = affectedThemes.some(t => t.isBreach);

  return {
    symbol: order.symbol,
    type: order.type,
    tradeValueUsd: Math.abs(tradeDeltaUsd),
    currentStockWeightPct,
    projectedStockWeightPct,
    causesStockCapBreach,
    affectedThemes,
    causesThemeCapBreach,
  };
}

/**
 * 4. 252-Trading-Day Correlation & Beta Engine
 */
export function computeCorrelationAndBeta(
  holdings: readonly RiskHoldingInput[],
  priceSeriesBySymbol: PriceSeriesBySymbol,
  benchmarkSymbol = '^GSPC',
  threshold = 0.70
): PortfolioCorrelationAndBetaResult {
  const openHoldings = holdings.filter(h => (h.status || 'Open').toLowerCase() === 'open');

  // Convert prices to date->close maps
  const dateMapBySymbol = new Map<string, Map<string, number>>();
  for (const [sym, series] of Object.entries(priceSeriesBySymbol)) {
    const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
    const m = new Map<string, number>();
    for (const pt of sorted) {
      if (typeof pt.close === 'number' && !isNaN(pt.close) && pt.close > 0) {
        m.set(pt.date, pt.close);
      }
    }
    dateMapBySymbol.set(sym, m);
  }

  // Calculate daily returns for each symbol
  const returnsBySymbol = new Map<string, Map<string, number>>();

  for (const [sym, dateMap] of dateMapBySymbol.entries()) {
    const dates = Array.from(dateMap.keys()).sort();
    const retMap = new Map<string, number>();
    for (let i = 1; i < dates.length; i++) {
      const prev = dateMap.get(dates[i - 1])!;
      const curr = dateMap.get(dates[i])!;
      retMap.set(dates[i], (curr - prev) / prev);
    }
    returnsBySymbol.set(sym, retMap);
  }

  // Benchmark returns
  const benchReturnsMap = returnsBySymbol.get(benchmarkSymbol);

  const stockBetas: Record<string, number> = {};
  const stockAnnualizedVolatilities: Record<string, number> = {};

  for (const h of openHoldings) {
    const symReturns = returnsBySymbol.get(h.symbol);
    if (!symReturns || symReturns.size < 2) {
      stockBetas[h.symbol] = 1.0;
      stockAnnualizedVolatilities[h.symbol] = 20.0;
      continue;
    }

    // Align with benchmark if available
    if (benchReturnsMap && benchReturnsMap.size >= 2) {
      const commonDates = Array.from(symReturns.keys())
        .filter(d => benchReturnsMap.has(d))
        .sort()
        .slice(-252); // latest 252 days

      if (commonDates.length >= 2) {
        const x: number[] = [];
        const y: number[] = [];
        for (const d of commonDates) {
          x.push(benchReturnsMap.get(d)!);
          y.push(symReturns.get(d)!);
        }

        const meanX = x.reduce((a, b) => a + b, 0) / x.length;
        const meanY = y.reduce((a, b) => a + b, 0) / y.length;

        let cov = 0;
        let varX = 0;
        let varY = 0;

        for (let i = 0; i < x.length; i++) {
          const dx = x[i] - meanX;
          const dy = y[i] - meanY;
          cov += dx * dy;
          varX += dx * dx;
          varY += dy * dy;
        }

        cov /= (x.length - 1);
        varX /= (x.length - 1);
        varY /= (y.length - 1);

        stockBetas[h.symbol] = varX > 0 ? cov / varX : 1.0;
        const dailyStd = Math.sqrt(varY);
        stockAnnualizedVolatilities[h.symbol] = dailyStd * Math.sqrt(252) * 100;
        continue;
      }
    }

    // Fallback if no benchmark
    const allReturns = Array.from(symReturns.values()).slice(-252);
    const mean = allReturns.reduce((a, b) => a + b, 0) / allReturns.length;
    const variance = allReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (allReturns.length - 1);
    stockBetas[h.symbol] = 1.0;
    stockAnnualizedVolatilities[h.symbol] = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  // Portfolio-Weighted Beta
  let totalStockVal = 0;
  let weightedBetaSum = 0;

  for (const h of openHoldings) {
    const val = (h.shares > 0 && h.lastPrice && h.lastPrice > 0)
      ? h.shares * h.lastPrice
      : 0;
    totalStockVal += val;
    weightedBetaSum += val * (stockBetas[h.symbol] ?? 1.0);
  }

  const portfolioBeta = totalStockVal > 0 ? weightedBetaSum / totalStockVal : 1.0;

  // Pairwise Pearson correlation among open holdings
  const highCorrelationPairs: HighCorrelationPair[] = [];
  const symbols = openHoldings.map(h => h.symbol);

  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const symA = symbols[i];
      const symB = symbols[j];

      const retA = returnsBySymbol.get(symA);
      const retB = returnsBySymbol.get(symB);
      if (!retA || !retB || retA.size < 2 || retB.size < 2) continue;

      const commonDates = Array.from(retA.keys())
        .filter(d => retB.has(d))
        .sort()
        .slice(-252);

      if (commonDates.length < 2) continue;

      const a: number[] = [];
      const b: number[] = [];
      for (const d of commonDates) {
        a.push(retA.get(d)!);
        b.push(retB.get(d)!);
      }

      const meanA = a.reduce((sum, v) => sum + v, 0) / a.length;
      const meanB = b.reduce((sum, v) => sum + v, 0) / b.length;

      let cov = 0;
      let varA = 0;
      let varB = 0;

      for (let k = 0; k < a.length; k++) {
        const da = a[k] - meanA;
        const db = b[k] - meanB;
        cov += da * db;
        varA += da * da;
        varB += db * db;
      }

      if (varA <= 0 || varB <= 0) continue;

      const r = cov / (Math.sqrt(varA) * Math.sqrt(varB));

      if (r >= threshold) {
        const hA = openHoldings.find(h => h.symbol === symA);
        const hB = openHoldings.find(h => h.symbol === symB);
        const valA = (hA?.shares || 0) * (hA?.lastPrice || 0);
        const valB = (hB?.shares || 0) * (hB?.lastPrice || 0);
        const combinedWeightPct = totalStockVal > 0
          ? ((valA + valB) / totalStockVal) * 100
          : 0;

        highCorrelationPairs.push({
          symbolA: symA,
          symbolB: symB,
          correlation: r,
          combinedWeightPct,
        });
      }
    }
  }

  highCorrelationPairs.sort((x, y) => y.correlation - x.correlation);

  return {
    stockBetas,
    stockAnnualizedVolatilities,
    portfolioBeta,
    highCorrelationPairs,
  };
}

/**
 * 5. Compute Deterministic Portfolio Health Score (0-100)
 */
export function computePortfolioHealthScore(
  concentration: PortfolioConcentrationAudit,
  correlation: PortfolioCorrelationAndBetaResult
): PortfolioHealthScoreResult {
  let score = 100;
  const deductions: HealthScoreDeduction[] = [];

  // Stock breaches & warnings
  for (const s of concentration.stockConcentrations) {
    if (s.status === 'breach') {
      const pts = 15;
      score -= pts;
      deductions.push({
        reason: `${s.symbol} exceeds 15% Single-Stock Cap (${s.weightPct.toFixed(1)}%)`,
        points: pts,
      });
    } else if (s.status === 'warning') {
      const pts = 5;
      score -= pts;
      deductions.push({
        reason: `${s.symbol} at warning concentration (${s.weightPct.toFixed(1)}%)`,
        points: pts,
      });
    }
  }

  // Theme breaches & warnings (ignore Unassigned)
  for (const t of concentration.themeExposures) {
    if (t.isUnassigned) continue;
    if (t.status === 'breach') {
      const pts = 20;
      score -= pts;
      deductions.push({
        reason: `Theme '${t.themeName}' exceeds 30% Theme Cap (${t.weightPct.toFixed(1)}%)`,
        points: pts,
      });
    } else if (t.status === 'warning') {
      const pts = 8;
      score -= pts;
      deductions.push({
        reason: `Theme '${t.themeName}' at warning concentration (${t.weightPct.toFixed(1)}%)`,
        points: pts,
      });
    }
  }

  // High correlation pairs penalty
  for (const p of correlation.highCorrelationPairs) {
    if (p.combinedWeightPct > 30) {
      const pts = 10;
      score -= pts;
      deductions.push({
        reason: `Correlated pair ${p.symbolA} - ${p.symbolB} (r = ${p.correlation.toFixed(2)}) holds ${p.combinedWeightPct.toFixed(1)}% weight`,
        points: pts,
      });
    } else if (p.combinedWeightPct > 20) {
      const pts = 5;
      score -= pts;
      deductions.push({
        reason: `Correlated pair ${p.symbolA} - ${p.symbolB} (r = ${p.correlation.toFixed(2)}) holds ${p.combinedWeightPct.toFixed(1)}% weight`,
        points: pts,
      });
    }
  }

  // Portfolio Beta penalty (> 1.30)
  if (correlation.portfolioBeta > 1.30) {
    const pts = Math.min(15, Math.round((correlation.portfolioBeta - 1.30) * 30));
    score -= pts;
    deductions.push({
      reason: `Elevated Portfolio Beta (${correlation.portfolioBeta.toFixed(2)} vs S&P 500)`,
      points: pts,
    });
  }

  // Concentration HHI penalty
  if (concentration.hhi > 0.25) {
    const pts = 10;
    score -= pts;
    deductions.push({
      reason: `High Portfolio Concentration (HHI: ${concentration.hhi.toFixed(2)}, Effective Positions: ${concentration.effectivePositions.toFixed(1)})`,
      points: pts,
    });
  }

  const healthScore = Math.max(0, Math.min(100, score));

  let riskLevel: 'Low' | 'Moderate' | 'Elevated' | 'High';
  if (healthScore >= 80) {
    riskLevel = 'Low';
  } else if (healthScore >= 65) {
    riskLevel = 'Moderate';
  } else if (healthScore >= 50) {
    riskLevel = 'Elevated';
  } else {
    riskLevel = 'High';
  }

  return {
    healthScore,
    riskLevel,
    deductions,
  };
}
