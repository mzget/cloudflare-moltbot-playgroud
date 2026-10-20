import { describe, it, expect, vi } from 'vitest';
import {
  getPortfolioRiskAudit,
  calculatePositionSize,
  saveRiskAdvisory,
} from './riskTools';

describe('mcp-worker riskTools', () => {
  const createMockDb = () => {
    return {
      prepare: vi.fn((sql: string) => {
        if (sql.includes('FROM holdings h')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                { symbol: 'AAPL', shares: 100, last_price: 150, status: 'Open', name: 'Apple Inc.' },
                { symbol: 'MSFT', shares: 50, last_price: 400, status: 'Open', name: 'Microsoft' },
              ]
            })
          };
        }
        if (sql.includes('FROM theme_symbol_mappings m')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                { symbol: 'AAPL', theme_name: 'Consumer Tech', notebook_id: 'nb-1' },
                { symbol: 'MSFT', theme_name: 'AI & Cloud Infrastructure', notebook_id: 'nb-2' },
              ]
            })
          };
        }
        if (sql.includes('FROM dcf_calculations')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                { symbol: 'AAPL', scenario: 'Base Case', intrinsic_price: 180, margin_of_safety_pct: 20 },
              ]
            })
          };
        }
        if (sql.includes('FROM stock_fundamentals')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                { symbol: 'AAPL', conviction_score: 90, debate_json: '{}' },
              ]
            })
          };
        }
        if (sql.includes('FROM historical_prices')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [
                  { symbol: 'AAPL', date: '2026-01-01', close: 145 },
                  { symbol: 'AAPL', date: '2026-01-02', close: 150 },
                  { symbol: 'MSFT', date: '2026-01-01', close: 390 },
                  { symbol: 'MSFT', date: '2026-01-02', close: 400 },
                  { symbol: '^GSPC', date: '2026-01-01', close: 5000 },
                  { symbol: '^GSPC', date: '2026-01-02', close: 5050 },
                ]
              })
            })
          };
        }
        if (sql.includes('FROM portfolio_risk_advisories')) {
          return {
            first: vi.fn().mockResolvedValue(null)
          };
        }
        if (sql.includes('INSERT INTO portfolio_risk_advisories')) {
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({
                meta: { last_row_id: 42 }
              })
            })
          };
        }
        return {
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({ meta: {} }),
          })
        };
      })
    };
  };

  it('getPortfolioRiskAudit computes audit and returns structured data', async () => {
    const mockEnv = { DB: createMockDb() };
    const res = await getPortfolioRiskAudit(mockEnv);

    expect(res).toBeDefined();
    if ('error' in res) {
      throw new Error(res.error);
    }
    expect(res.concentration.totalStockPortfolioUsd).toBe(35000); // AAPL 15k + MSFT 20k
    expect(res.concentration.stockConcentrations.length).toBe(2);
    expect(res.health).toBeDefined();
    expect(res.health.healthScore).toBeGreaterThanOrEqual(0);
    expect(res.holdingsSizing.length).toBe(2);
  });

  it('calculatePositionSize calculates room and simulation for a ticker', async () => {
    const mockEnv = { DB: createMockDb() };
    const res = await calculatePositionSize(mockEnv, {
      symbol: 'AAPL',
      price: 150,
      shares: 10,
      type: 'Buy'
    });

    expect(res.symbol).toBe('AAPL');
    if ('error' in res) {
      throw new Error(res.error);
    }
    expect(res.sizing).toBeDefined();
    expect(res.sizing.maxStockCapPct).toBe(15);
    expect(res.simulation).toBeDefined();
    expect(res.simulation?.causesStockCapBreach).toBeDefined();
  });

  it('saveRiskAdvisory validates input and inserts into D1', async () => {
    const mockDb = createMockDb();
    const mockEnv = { DB: mockDb };

    const res = await saveRiskAdvisory(mockEnv, {
      health_score: 85,
      risk_level: 'Low',
      executive_summary: 'Disciplined portfolio allocation.',
      key_warnings: ['Monitor MSFT concentration'],
      rebalancing_actions: ['Trim MSFT to target 8%'],
      source: 'gemini_spark'
    });

    expect(res.success).toBe(true);
    expect(res.id).toBe(42);
  });

  it('saveRiskAdvisory rejects invalid health_score or risk_level', async () => {
    const mockEnv = { DB: createMockDb() };

    const res1 = await saveRiskAdvisory(mockEnv, {
      health_score: 150, // invalid > 100
      risk_level: 'Low',
      executive_summary: 'Test',
      key_warnings: [],
      rebalancing_actions: [],
    });
    expect(res1.error).toContain('health_score must be a number between 0 and 100');

    const res2 = await saveRiskAdvisory(mockEnv, {
      health_score: 80,
      risk_level: 'SuperDangerous' as any, // invalid level
      executive_summary: 'Test',
      key_warnings: [],
      rebalancing_actions: [],
    });
    expect(res2.error).toContain('risk_level must be one of');
  });
});
