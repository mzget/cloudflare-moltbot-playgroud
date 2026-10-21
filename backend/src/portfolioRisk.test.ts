import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RISK_CONFIG,
  computeConcentrationAudit,
  computeCorrelationAndBeta,
  calculateFixedBasePositionSize,
  simulatePreTradeImpact,
  computePortfolioHealthScore,
  type RiskHoldingInput,
  type ThemeMappingInput,
  type PriceSeriesBySymbol,
} from './portfolioRisk';

describe('portfolioRisk engine', () => {
  const mockHoldings: readonly RiskHoldingInput[] = [
    { symbol: 'AAPL', shares: 100, lastPrice: 150, status: 'Open' }, // $15,000 (15%)
    { symbol: 'MSFT', shares: 50, lastPrice: 400, status: 'Open' },  // $20,000 (20%) - breach > 15%
    { symbol: 'NVDA', shares: 40, lastPrice: 250, status: 'Open' },  // $10,000 (10%) - warning >= 10%
    { symbol: 'GOOGL', shares: 35, lastPrice: 1000, status: 'Closed' }, // Closed holding should be ignored
    { symbol: 'AMZN', shares: 55, lastPrice: 1000, status: 'Open' }, // $55,000 (55%) - breach > 15%
  ];
  // Total open stock portfolio USD = 15k + 20k + 10k + 55k = $100,000

  const mockThemeMappings: readonly ThemeMappingInput[] = [
    { symbol: 'AAPL', themeName: 'Consumer Tech', notebookId: 'nb-1' },
    { symbol: 'MSFT', themeName: 'AI & Cloud Infrastructure', notebookId: 'nb-2' },
    { symbol: 'NVDA', themeName: 'AI & Cloud Infrastructure', notebookId: 'nb-2' },
    { symbol: 'NVDA', themeName: 'Semiconductor Leaders', notebookId: 'nb-3' },
    // AMZN is intentionally unassigned to any theme
  ];

  describe('computeConcentrationAudit', () => {
    it('correctly calculates total stock portfolio USD and stock weights', () => {
      const audit = computeConcentrationAudit(mockHoldings, mockThemeMappings, DEFAULT_RISK_CONFIG);

      expect(audit.totalStockPortfolioUsd).toBe(100000);
      expect(audit.openHoldingsCount).toBe(4);

      const aapl = audit.stockConcentrations.find(s => s.symbol === 'AAPL');
      expect(aapl).toBeDefined();
      expect(aapl?.marketValueUsd).toBe(15000);
      expect(aapl?.weightPct).toBe(15);
      expect(aapl?.status).toBe('warning'); // exactly 15% is warning, >15% is breach

      const msft = audit.stockConcentrations.find(s => s.symbol === 'MSFT');
      expect(msft?.weightPct).toBe(20);
      expect(msft?.status).toBe('breach');
      expect(msft?.trimToCapUsd).toBe(5000); // 20k - 15k cap = 5k to trim
      expect(msft?.trimToCapShares).toBe(12.5); // 5000 / 400

      const amzn = audit.stockConcentrations.find(s => s.symbol === 'AMZN');
      expect(amzn?.status).toBe('breach');
      expect(amzn?.themes).toEqual(['Unassigned']);
    });

    it('aggregates multi-theme exposures and flags warnings/breaches', () => {
      const audit = computeConcentrationAudit(mockHoldings, mockThemeMappings, DEFAULT_RISK_CONFIG);

      // AI & Cloud Infrastructure has MSFT ($20k) + NVDA ($10k) = $30k (30%)
      const aiCloud = audit.themeExposures.find(t => t.themeName === 'AI & Cloud Infrastructure');
      expect(aiCloud).toBeDefined();
      expect(aiCloud?.marketValueUsd).toBe(30000);
      expect(aiCloud?.weightPct).toBe(30);
      expect(aiCloud?.status).toBe('warning'); // exactly 30% is warning, >30% is breach
      expect(aiCloud?.symbols).toEqual(['MSFT', 'NVDA']);

      // Semiconductor Leaders has NVDA ($10k) = 10%
      const semi = audit.themeExposures.find(t => t.themeName === 'Semiconductor Leaders');
      expect(semi?.weightPct).toBe(10);
      expect(semi?.status).toBe('ok');

      // Unassigned bucket for AMZN ($55k = 55%)
      const unassigned = audit.themeExposures.find(t => t.isUnassigned);
      expect(unassigned).toBeDefined();
      expect(unassigned?.symbols).toEqual(['AMZN']);
      expect(unassigned?.weightPct).toBeCloseTo(55, 2);
      expect(unassigned?.status).toBe('ok'); // Unassigned never flags breach
    });

    it('calculates HHI, Effective Positions, and Top concentration', () => {
      const audit = computeConcentrationAudit(mockHoldings, mockThemeMappings, DEFAULT_RISK_CONFIG);
      // Weights: 0.15, 0.20, 0.10, 0.55
      // Sum of squares: 0.0225 + 0.0400 + 0.0100 + 0.3025 = 0.375
      expect(audit.hhi).toBeCloseTo(0.375, 3);
      expect(audit.effectivePositions).toBeCloseTo(1 / 0.375, 2); // ~2.67
      expect(audit.top3ConcentrationPct).toBeCloseTo(90, 2); // 55 + 20 + 15 = 90
    });

    it('includes unused themes with 0 open holdings with zero weight and status ok', () => {
      const mappingsWithUnused: readonly ThemeMappingInput[] = [
        ...mockThemeMappings,
        { symbol: 'INTC', themeName: 'Legacy Computing', notebookId: 'nb-unused' },
        { symbol: '', themeName: 'Empty Unused Theme', notebookId: 'nb-empty' },
      ];
      const audit = computeConcentrationAudit(mockHoldings, mappingsWithUnused, DEFAULT_RISK_CONFIG);

      const legacy = audit.themeExposures.find(t => t.themeName === 'Legacy Computing');
      expect(legacy).toBeDefined();
      expect(legacy?.marketValueUsd).toBe(0);
      expect(legacy?.weightPct).toBe(0);
      expect(legacy?.status).toBe('ok');
      expect(legacy?.symbols).toEqual(['INTC']);
      expect(legacy?.roomToCapUsd).toBe(30000);

      const emptyTheme = audit.themeExposures.find(t => t.themeName === 'Empty Unused Theme');
      expect(emptyTheme).toBeDefined();
      expect(emptyTheme?.marketValueUsd).toBe(0);
      expect(emptyTheme?.weightPct).toBe(0);
      expect(emptyTheme?.status).toBe('ok');
      expect(emptyTheme?.symbols).toEqual([]);
    });

    it('handles empty portfolio gracefully', () => {
      const audit = computeConcentrationAudit([], [], DEFAULT_RISK_CONFIG);
      expect(audit.totalStockPortfolioUsd).toBe(0);
      expect(audit.stockConcentrations).toEqual([]);
      expect(audit.themeExposures).toEqual([]);
      expect(audit.hhi).toBe(0);
      expect(audit.effectivePositions).toBe(0);
    });
  });

  describe('calculateFixedBasePositionSize', () => {
    it('calculates sizing room against fixed current portfolio USD', () => {
      const audit = computeConcentrationAudit(mockHoldings, mockThemeMappings, DEFAULT_RISK_CONFIG);

      // Sizing for NVDA: current value $10,000 (10%), price $250
      // Target: 8% of $100k = $8,000 -> NVDA already at $10k, so roomToTarget is $0
      // Max stock cap: 15% of $100k = $15,000 -> roomToStockCap is $5,000 (20 shares)
      // NVDA mapped to 'AI & Cloud' ($30k, 30% cap) and 'Semiconductor' ($10k)
      // Strictest theme is 'AI & Cloud' at $30,000 (30% of $100k) -> theme cap room is $0!
      // Therefore, maxAllowedBuyUsd is constrained to $0 by strictest theme
      const sizingNvda = calculateFixedBasePositionSize({
        symbol: 'NVDA',
        currentPrice: 250,
        audit,
        themeMappings: mockThemeMappings,
        config: DEFAULT_RISK_CONFIG,
      });

      expect(sizingNvda.currentMarketValueUsd).toBe(10000);
      expect(sizingNvda.currentWeightPct).toBe(10);
      expect(sizingNvda.roomToTargetUsd).toBe(0);
      expect(sizingNvda.roomToStockCapUsd).toBe(5000);
      expect(sizingNvda.strictestTheme?.themeName).toBe('AI & Cloud Infrastructure');
      expect(sizingNvda.roomToThemeCapUsd).toBe(0);
      expect(sizingNvda.maxAllowedBuyUsd).toBe(0);
      expect(sizingNvda.maxAllowedBuyShares).toBe(0);
      expect(sizingNvda.bindingCapReason).toBe('Strictest Theme Cap Reached (AI & Cloud Infrastructure at 30.0%)');
    });

    it('allows buying up to stock cap when stock is Unassigned to any theme', () => {
      const audit = computeConcentrationAudit(mockHoldings, mockThemeMappings, DEFAULT_RISK_CONFIG);

      // Brand new ticker 'XYZ' not in any theme
      const sizingNew = calculateFixedBasePositionSize({
        symbol: 'XYZ',
        currentPrice: 100,
        audit,
        themeMappings: mockThemeMappings,
        config: DEFAULT_RISK_CONFIG,
      });

      // Target = 8% of 100k = $8,000 (80 shares)
      // Stock Cap = 15% of 100k = $15,000 (150 shares)
      // Theme: Unassigned -> does NOT restrict
      expect(sizingNew.roomToTargetUsd).toBe(8000);
      expect(sizingNew.roomToTargetShares).toBe(80);
      expect(sizingNew.roomToStockCapUsd).toBe(15000);
      expect(sizingNew.roomToStockCapShares).toBe(150);
      expect(sizingNew.strictestTheme).toBeNull();
      expect(sizingNew.roomToThemeCapUsd).toBeNull();
      expect(sizingNew.maxAllowedBuyUsd).toBe(15000);
      expect(sizingNew.maxAllowedBuyShares).toBe(150);
      expect(sizingNew.bindingCapReason).toBe('Single-Stock Cap (15%)');
    });
  });

  describe('simulatePreTradeImpact', () => {
    it('simulates post-trade weight against fixed portfolio USD', () => {
      const audit = computeConcentrationAudit(mockHoldings, mockThemeMappings, DEFAULT_RISK_CONFIG);

      // Buy 10 shares of AAPL at $150 = $1,500
      const sim = simulatePreTradeImpact({
        audit,
        order: {
          symbol: 'AAPL',
          type: 'Buy',
          shares: 10,
          price: 150,
        },
        themeMappings: mockThemeMappings,
        config: DEFAULT_RISK_CONFIG,
      });

      // AAPL starts at $15,000 (15.0%)
      expect(sim.currentStockWeightPct).toBe(15);
      // New value = $16,500. Against fixed denominator $100,000 = 16.5%
      expect(sim.projectedStockWeightPct).toBe(16.5);
      expect(sim.causesStockCapBreach).toBe(true);
      expect(sim.causesThemeCapBreach).toBe(false); // Consumer Tech goes to 16.5% <= 30%
    });

    it('simulates Sell reducing weight', () => {
      const audit = computeConcentrationAudit(mockHoldings, mockThemeMappings, DEFAULT_RISK_CONFIG);

      // Sell 20 shares of MSFT at $400 = $8,000
      const sim = simulatePreTradeImpact({
        audit,
        order: {
          symbol: 'MSFT',
          type: 'Sell',
          shares: 20,
          price: 400,
        },
        themeMappings: mockThemeMappings,
        config: DEFAULT_RISK_CONFIG,
      });

      // MSFT starts at $20,000 (20.0%)
      expect(sim.currentStockWeightPct).toBe(20);
      // After sell: $12,000 / $100,000 = 12.0%
      expect(sim.projectedStockWeightPct).toBe(12);
      expect(sim.causesStockCapBreach).toBe(false);
    });
  });

  describe('computeCorrelationAndBeta', () => {
    it('computes beta against benchmark and flags pairs with r >= 0.70', () => {
      // 5 daily price points (4 daily returns)
      // Benchmark returns: [0.01, -0.02, 0.03, 0.01]
      // Stock A moves identically with 1.5x amplitude: [0.015, -0.03, 0.045, 0.015] -> beta = 1.5, r = 1.0
      // Stock B moves inversely: [-0.01, 0.02, -0.03, -0.01] -> r = -1.0
      const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05'];
      const priceSeries: PriceSeriesBySymbol = {
        '^GSPC': [
          { date: dates[0], close: 100 },
          { date: dates[1], close: 101 },
          { date: dates[2], close: 98.98 },
          { date: dates[3], close: 101.9494 },
          { date: dates[4], close: 102.968894 },
        ],
        'STK_A': [
          { date: dates[0], close: 100 },
          { date: dates[1], close: 101.5 },
          { date: dates[2], close: 98.455 },
          { date: dates[3], close: 102.885475 },
          { date: dates[4], close: 104.428757 },
        ],
        'STK_B': [
          { date: dates[0], close: 100 },
          { date: dates[1], close: 101.5 },
          { date: dates[2], close: 98.455 },
          { date: dates[3], close: 102.885475 },
          { date: dates[4], close: 104.428757 },
        ],
      };

      const testHoldings: readonly RiskHoldingInput[] = [
        { symbol: 'STK_A', shares: 50, lastPrice: 100, status: 'Open' },
        { symbol: 'STK_B', shares: 50, lastPrice: 100, status: 'Open' },
      ];

      const res = computeCorrelationAndBeta(testHoldings, priceSeries, '^GSPC', 0.70);

      expect(res.stockBetas['STK_A']).toBeCloseTo(1.5, 1);
      expect(res.portfolioBeta).toBeCloseTo(1.5, 1);
      expect(res.highCorrelationPairs.length).toBe(1);
      expect(res.highCorrelationPairs[0].symbolA).toBe('STK_A');
      expect(res.highCorrelationPairs[0].symbolB).toBe('STK_B');
      expect(res.highCorrelationPairs[0].correlation).toBeCloseTo(1.0, 2);
    });

    it('handles missing series without crashing', () => {
      const testHoldings: readonly RiskHoldingInput[] = [
        { symbol: 'UNKNOWN', shares: 10, lastPrice: 50, status: 'Open' },
      ];
      const res = computeCorrelationAndBeta(testHoldings, {}, '^GSPC', 0.70);
      expect(res.portfolioBeta).toBe(1.0); // defaults to 1.0 when no data
      expect(res.highCorrelationPairs).toEqual([]);
    });
  });

  describe('computePortfolioHealthScore', () => {
    it('scores 100 for a perfectly balanced portfolio with no breaches', () => {
      const concentration = {
        totalStockPortfolioUsd: 100000,
        openHoldingsCount: 10,
        stockConcentrations: [
          { symbol: 'A', marketValueUsd: 10000, weightPct: 10, status: 'ok' as const, trimToCapUsd: 0, trimToCapShares: 0, themes: [] },
        ],
        themeExposures: [
          { themeName: 'Tech', marketValueUsd: 20000, weightPct: 20, status: 'ok' as const, symbols: ['A'], roomToCapUsd: 10000, isUnassigned: false },
        ],
        hhi: 0.1,
        effectivePositions: 10,
        top3ConcentrationPct: 30,
        top5ConcentrationPct: 50,
      };

      const correlation = {
        stockBetas: { A: 1.0 },
        stockAnnualizedVolatilities: { A: 18.5 },
        portfolioBeta: 1.05,
        highCorrelationPairs: [],
      };

      const health = computePortfolioHealthScore(concentration, correlation);
      expect(health.healthScore).toBe(100);
      expect(health.riskLevel).toBe('Low');
    });

    it('penalizes health score heavily when multiple caps are breached', () => {
      const concentration = {
        totalStockPortfolioUsd: 100000,
        openHoldingsCount: 3,
        stockConcentrations: [
          { symbol: 'A', marketValueUsd: 40000, weightPct: 40, status: 'breach' as const, trimToCapUsd: 25000, trimToCapShares: 25, themes: ['T1'] },
          { symbol: 'B', marketValueUsd: 35000, weightPct: 35, status: 'breach' as const, trimToCapUsd: 20000, trimToCapShares: 20, themes: ['T1'] },
        ],
        themeExposures: [
          { themeName: 'T1', marketValueUsd: 75000, weightPct: 75, status: 'breach' as const, symbols: ['A', 'B'], roomToCapUsd: 0, isUnassigned: false },
        ],
        hhi: 0.4,
        effectivePositions: 2.5,
        top3ConcentrationPct: 100,
        top5ConcentrationPct: 100,
      };

      const correlation = {
        stockBetas: { A: 1.8, B: 1.7 },
        stockAnnualizedVolatilities: { A: 35, B: 38 },
        portfolioBeta: 1.75,
        highCorrelationPairs: [
          { symbolA: 'A', symbolB: 'B', correlation: 0.92, combinedWeightPct: 75 },
        ],
      };

      const health = computePortfolioHealthScore(concentration, correlation);
      expect(health.healthScore).toBeLessThan(60);
      expect(health.riskLevel).toBe('High');
      expect(health.deductions.length).toBeGreaterThan(0);
    });

    it('handles zero or null prices in holdings gracefully', () => {
      const holdingsWithNulls: readonly RiskHoldingInput[] = [
        { symbol: 'ZERO_SHARES', shares: 0, lastPrice: 100, status: 'Open' },
        { symbol: 'NULL_PRICE', shares: 50, lastPrice: null, status: 'Open' },
        { symbol: 'VALID', shares: 10, lastPrice: 100, status: 'Open' }, // $1,000
      ];
      const audit = computeConcentrationAudit(holdingsWithNulls, [], DEFAULT_RISK_CONFIG);
      expect(audit.totalStockPortfolioUsd).toBe(1000);
      expect(audit.openHoldingsCount).toBe(3);
      const nullHolding = audit.stockConcentrations.find(s => s.symbol === 'NULL_PRICE');
      expect(nullHolding?.marketValueUsd).toBe(0);
      expect(nullHolding?.trimToCapShares).toBe(0);
    });

    it('handles single price point for beta computation without dividing by zero', () => {
      const priceSeries: PriceSeriesBySymbol = {
        '^GSPC': [{ date: '2026-01-01', close: 100 }],
        'AAPL': [{ date: '2026-01-01', close: 150 }],
      };
      const holdings: readonly RiskHoldingInput[] = [
        { symbol: 'AAPL', shares: 10, lastPrice: 150, status: 'Open' },
      ];
      const res = computeCorrelationAndBeta(holdings, priceSeries, '^GSPC', 0.70);
      expect(res.stockBetas['AAPL']).toBe(1.0);
      expect(res.portfolioBeta).toBe(1.0);
      expect(res.highCorrelationPairs).toEqual([]);
    });
  });
});
