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

describe('portfolioRisk engine (@oaktree/shared)', () => {
  const mockHoldings: readonly RiskHoldingInput[] = [
    { symbol: 'AAPL', shares: 100, lastPrice: 150, status: 'Open' }, // $15,000 (15%)
    { symbol: 'MSFT', shares: 50, lastPrice: 400, status: 'Open' },  // $20,000 (20%) - breach > 15%
    { symbol: 'NVDA', shares: 40, lastPrice: 250, status: 'Open' },  // $10,000 (10%) - warning >= 10%
    { symbol: 'GOOGL', shares: 35, lastPrice: 1000, status: 'Closed' }, // Closed holding should be ignored
    { symbol: 'AMZN', shares: 55, lastPrice: 1000, status: 'Open' }, // $55,000 (55%) - breach > 15%
  ];

  const mockThemeMappings: readonly ThemeMappingInput[] = [
    { symbol: 'AAPL', themeName: 'Consumer Tech', notebookId: 'nb-1' },
    { symbol: 'MSFT', themeName: 'AI & Cloud Infrastructure', notebookId: 'nb-2' },
    { symbol: 'NVDA', themeName: 'AI & Cloud Infrastructure', notebookId: 'nb-2' },
    { symbol: 'NVDA', themeName: 'Semiconductor Leaders', notebookId: 'nb-3' },
  ];

  it('correctly calculates concentration, sizing room, pre-trade simulation, beta, and health score', () => {
    const audit = computeConcentrationAudit(mockHoldings, mockThemeMappings, DEFAULT_RISK_CONFIG);
    expect(audit.totalStockPortfolioUsd).toBe(100000);
    expect(audit.openHoldingsCount).toBe(4);

    const sizingNvda = calculateFixedBasePositionSize({
      symbol: 'NVDA',
      currentPrice: 250,
      audit,
      themeMappings: mockThemeMappings,
      config: DEFAULT_RISK_CONFIG,
    });
    expect(sizingNvda.roomToStockCapUsd).toBe(5000);
    expect(sizingNvda.roomToThemeCapUsd).toBe(0);
    expect(sizingNvda.maxAllowedBuyUsd).toBe(0);

    const sim = simulatePreTradeImpact({
      audit,
      order: { symbol: 'AAPL', type: 'Buy', shares: 10, price: 150 },
      themeMappings: mockThemeMappings,
      config: DEFAULT_RISK_CONFIG,
    });
    expect(sim.currentStockWeightPct).toBe(15);
    expect(sim.projectedStockWeightPct).toBe(16.5);
    expect(sim.causesStockCapBreach).toBe(true);

    const corr = computeCorrelationAndBeta(mockHoldings, {}, '^GSPC', 0.70);
    const health = computePortfolioHealthScore(audit, corr);
    expect(health.healthScore).toBeGreaterThanOrEqual(0);
    expect(health.healthScore).toBeLessThanOrEqual(100);
  });
});
