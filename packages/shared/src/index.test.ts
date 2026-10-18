import { describe, it, expect } from 'vitest';
import {
  sortTransactions,
  calculateCAGR,
  calculateDiscountFactor,
  roundTo,
  formatCurrency,
  formatPercent,
  DCF_SCENARIO_NAMES,
  type CompanyStats,
  type AnalysisCoverage,
  type AnalysisCoverageMap,
  type DcfScenarioInput,
  type DcfScenarioName,
  type GuidanceInfo,
  type StockFundamental,
  type PortfolioTransaction,
  type PortfolioLot,
} from './index';

describe('@oaktree/shared utilities', () => {
  describe('sortTransactions', () => {
    it('should sort transactions chronologically in ascending order', () => {
      const txs = [
        { id: 1, date: '2026-05-12', type: 'Buy' },
        { id: 2, date: '2026-03-04', type: 'Buy' },
        { id: 3, date: '2026-04-28', type: 'Buy' },
      ];
      const sorted = sortTransactions(txs);
      expect(sorted.map((t) => t.date)).toEqual([
        '2026-03-04',
        '2026-04-28',
        '2026-05-12',
      ]);
    });

    it('should sort Buy before Sell when transactions occur on the same day', () => {
      const txs = [
        { id: 1, date: '2025-08-07', type: 'Sell', shares: 36 },
        { id: 2, date: '2025-08-07', type: 'Buy', shares: 13 },
        { id: 3, date: '2025-08-07', type: 'Buy', shares: 15 },
      ];
      const sorted = sortTransactions(txs);

      expect(sorted[0]).toEqual({ id: 2, date: '2025-08-07', type: 'Buy', shares: 13 });
      expect(sorted[1]).toEqual({ id: 3, date: '2025-08-07', type: 'Buy', shares: 15 });
      expect(sorted[2]).toEqual({ id: 1, date: '2025-08-07', type: 'Sell', shares: 36 });
    });

    it('should sort Buy before Sell on same day regardless of initial input order', () => {
      const txs = [
        { id: 1, date: '2025-08-07', type: 'Buy', shares: 13 },
        { id: 2, date: '2025-08-07', type: 'Sell', shares: 36 },
        { id: 3, date: '2025-08-07', type: 'Buy', shares: 15 },
      ];
      const sorted = sortTransactions(txs);

      expect(sorted[0].type).toBe('Buy');
      expect(sorted[1].type).toBe('Buy');
      expect(sorted[2].type).toBe('Sell');
    });

    it('should default missing transaction type to Buy', () => {
      const txs = [
        { id: 1, date: '2025-08-07', type: 'Sell', shares: 10 },
        { id: 2, date: '2025-08-07', shares: 10 },
      ];
      const sorted = sortTransactions(txs);
      expect(sorted[0].id).toBe(2);
      expect(sorted[1].id).toBe(1);
    });

    it('should not mutate original input array (pure immutability)', () => {
      const txs = [
        { id: 1, date: '2026-05-12', type: 'Buy' },
        { id: 2, date: '2026-03-04', type: 'Buy' },
      ];
      const copy = [...txs];
      const sorted = sortTransactions(txs);
      expect(txs).toEqual(copy);
      expect(sorted).not.toBe(txs);
    });

    it('should handle empty and non-array inputs gracefully', () => {
      expect(sortTransactions([])).toEqual([]);
      // @ts-expect-error test non-array defensive branch
      expect(sortTransactions(null)).toEqual([]);
      // @ts-expect-error test non-array defensive branch
      expect(sortTransactions(undefined)).toEqual([]);
    });
  });

  describe('calculateCAGR', () => {
    it('should calculate CAGR correctly for standard growth', () => {
      // 100 to 121 in 2 years = (1.21)^(1/2) - 1 = 0.10 (10%)
      const cagr = calculateCAGR(100, 121, 2);
      expect(cagr).toBeCloseTo(0.1, 5);
    });

    it('should return 0 when start value equals end value', () => {
      const cagr = calculateCAGR(100, 100, 5);
      expect(cagr).toBe(0);
    });

    it('should calculate CAGR for 1-year period', () => {
      const cagr = calculateCAGR(50, 100, 1);
      expect(cagr).toBeCloseTo(1.0, 5);
    });

    it('should handle negative growth (decline)', () => {
      // 100 to 64 in 2 years = (0.64)^(0.5) - 1 = 0.8 - 1 = -0.2 (-20%)
      const cagr = calculateCAGR(100, 64, 2);
      expect(cagr).toBeCloseTo(-0.2, 5);
    });

    it('should return 0 for invalid or boundary inputs', () => {
      expect(calculateCAGR(0, 100, 5)).toBe(0);
      expect(calculateCAGR(-100, 100, 5)).toBe(0);
      expect(calculateCAGR(100, -50, 5)).toBe(0);
      expect(calculateCAGR(100, 150, 0)).toBe(0);
      expect(calculateCAGR(100, 150, -2)).toBe(0);
      expect(calculateCAGR(NaN, 150, 2)).toBe(0);
      expect(calculateCAGR(100, NaN, 2)).toBe(0);
      expect(calculateCAGR(100, 150, NaN)).toBe(0);
    });
  });

  describe('calculateDiscountFactor', () => {
    it('should calculate discount factor for positive rate and year', () => {
      // 1 / (1 + 0.10)^1 = 1 / 1.1 ≈ 0.9090909
      expect(calculateDiscountFactor(0.1, 1)).toBeCloseTo(0.9090909, 6);
      // 1 / (1 + 0.08)^5 ≈ 0.6805832
      expect(calculateDiscountFactor(0.08, 5)).toBeCloseTo(0.6805832, 6);
    });

    it('should return 1 when year is 0', () => {
      expect(calculateDiscountFactor(0.1, 0)).toBe(1);
      expect(calculateDiscountFactor(0, 0)).toBe(1);
    });

    it('should return 1 when rate is 0', () => {
      expect(calculateDiscountFactor(0, 5)).toBe(1);
    });

    it('should return 0 for negative year or invalid rate', () => {
      expect(calculateDiscountFactor(0.1, -1)).toBe(0);
      expect(calculateDiscountFactor(-1, 2)).toBe(0);
      expect(calculateDiscountFactor(-1.5, 2)).toBe(0);
      expect(calculateDiscountFactor(NaN, 2)).toBe(0);
      expect(calculateDiscountFactor(0.1, NaN)).toBe(0);
    });
  });

  describe('roundTo', () => {
    it('should round numbers to specified decimal places', () => {
      expect(roundTo(1.23456, 2)).toBe(1.23);
      expect(roundTo(1.23556, 2)).toBe(1.24);
      expect(roundTo(1.23456, 4)).toBe(1.2346);
    });

    it('should round to integer when decimals is 0', () => {
      expect(roundTo(12.4, 0)).toBe(12);
      expect(roundTo(12.6, 0)).toBe(13);
    });

    it('should round negative numbers correctly', () => {
      expect(roundTo(-1.23456, 2)).toBe(-1.23);
      expect(roundTo(-1.23556, 2)).toBe(-1.24);
    });

    it('should return 0 for non-finite or NaN inputs', () => {
      expect(roundTo(NaN, 2)).toBe(0);
      expect(roundTo(Infinity, 2)).toBe(0);
      expect(roundTo(-Infinity, 2)).toBe(0);
    });
  });

  describe('formatCurrency', () => {
    it('should format positive values with default currency symbol ($)', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(1000000.5)).toBe('$1,000,000.50');
    });

    it('should format zero as $0.00', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format negative values with minus prefix before currency symbol', () => {
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
    });

    it('should accept custom currency symbols', () => {
      expect(formatCurrency(500, '฿')).toBe('฿500.00');
      expect(formatCurrency(-500, '฿')).toBe('-฿500.00');
      expect(formatCurrency(123.4, 'EUR ')).toBe('EUR 123.40');
    });

    it('should return -- for null, undefined, or NaN', () => {
      expect(formatCurrency(null)).toBe('--');
      expect(formatCurrency(undefined)).toBe('--');
      expect(formatCurrency(NaN)).toBe('--');
    });
  });

  describe('formatPercent', () => {
    it('should format positive percentage with fixed 2 decimals by default', () => {
      expect(formatPercent(12.3456)).toBe('12.35%');
      expect(formatPercent(5)).toBe('5.00%');
    });

    it('should format negative percentage', () => {
      expect(formatPercent(-4.2)).toBe('-4.20%');
      expect(formatPercent(-0.05)).toBe('-0.05%');
    });

    it('should format zero as 0.00%', () => {
      expect(formatPercent(0)).toBe('0.00%');
    });

    it('should support custom decimal precision', () => {
      expect(formatPercent(12.3456, 1)).toBe('12.3%');
      expect(formatPercent(12.3456, 3)).toBe('12.346%');
      expect(formatPercent(12.3456, 0)).toBe('12%');
    });

    it('should return -- for null, undefined, or NaN', () => {
      expect(formatPercent(null)).toBe('--');
      expect(formatPercent(undefined)).toBe('--');
      expect(formatPercent(NaN)).toBe('--');
    });
  });

  describe('domain types & constants contracts', () => {
    it('should export DCF_SCENARIO_NAMES with expected presets', () => {
      expect(DCF_SCENARIO_NAMES).toEqual(['Base Case', 'Bull Case', 'Bear Case']);
      expect(Object.isFrozen(DCF_SCENARIO_NAMES) || Array.isArray(DCF_SCENARIO_NAMES)).toBe(true);
    });

    it('should satisfy type checking for domain models', () => {
      const stats: CompanyStats = {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        exchange: 'NasdaqGS',
        price: 220.5,
        market_cap: 3400000000000,
        gross_profit_margin: 0.46,
      };
      expect(stats.symbol).toBe('AAPL');

      const coverage: AnalysisCoverage = {
        report: true,
        dcf: true,
        thesis: false,
        count: 2,
      };
      const coverageMap: AnalysisCoverageMap = new Map();
      coverageMap.set('AAPL', coverage);
      expect(coverageMap.get('AAPL')?.count).toBe(2);

      const scenario: DcfScenarioInput = {
        scenario_name: 'Base Case',
        base_revenue: 383,
        shares_outstanding: 15300,
        wacc: 8.5,
        terminal_growth: 3.0,
        implied_share_price: 225.4,
      };
      expect(scenario.scenario_name).toBe('Base Case');

      const guidance: GuidanceInfo = {
        revenue_target: '20-25% YoY',
        margin_target: '75-80% gross margin',
        timeframe: 'FY27',
      };
      expect(guidance.timeframe).toBe('FY27');

      const fundamental: StockFundamental = {
        symbol: 'AAPL',
        business_model: 'Hardware, services, ecosystem subscription',
        as_of_date: '2026-10-18',
        guidance,
      };
      expect(fundamental.symbol).toBe('AAPL');

      const lot: PortfolioLot = {
        id: 1,
        symbol: 'AAPL',
        date: '2026-01-15',
        shares: 50,
        cost_per_share: 210,
        total_cost: 10500,
      };
      expect(lot.shares).toBe(50);

      const txn: PortfolioTransaction = {
        id: 1,
        symbol: 'AAPL',
        date: '2026-01-15',
        type: 'Buy',
        shares: 50,
        cost_per_share: 210,
        total_cost: 10500,
      };
      expect(txn.type).toBe('Buy');
    });
  });
});
