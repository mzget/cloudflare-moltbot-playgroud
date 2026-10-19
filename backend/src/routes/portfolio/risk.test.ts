import { describe, it, expect, vi } from 'vitest';
import { loadPortfolioRiskData } from './risk';

describe('loadPortfolioRiskData', () => {
  it('loads holdings, themes, DCF, fundamentals, historical prices, and latest advisory', async () => {
    const mockDb = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes('FROM holdings h')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                { symbol: 'AAPL', shares: 10, avg_cost: 140, total_cost: 1400, status: 'Open', name: 'Apple Inc.', sector_label: 'Tech', last_price: 150, previous_close: 148 },
                { symbol: 'MSFT', shares: 20, avg_cost: 380, total_cost: 7600, status: 'Open', name: 'Microsoft Corp.', sector_label: 'Tech', last_price: 400, previous_close: 395 },
              ]
            })
          };
        }
        if (sql.includes('FROM theme_symbol_mappings m')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                { symbol: 'AAPL', notebook_id: 'nb-1', theme_name: 'Consumer Tech' },
                { symbol: 'MSFT', notebook_id: 'nb-2', theme_name: 'AI & Cloud Infrastructure' },
              ]
            })
          };
        }
        if (sql.includes('FROM dcf_calculations')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                { symbol: 'AAPL', scenario: 'Base Case', intrinsic_price: 180, margin_of_safety_pct: 20, upside_downside_pct: 20 },
                { symbol: 'AAPL', scenario: 'Bear Case', intrinsic_price: 130, margin_of_safety_pct: -13.3, upside_downside_pct: -13.3 },
              ]
            })
          };
        }
        if (sql.includes('FROM stock_fundamentals')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: [
                { symbol: 'AAPL', conviction_score: 85, debate_json: '{"round": 3}' },
              ]
            })
          };
        }
        if (sql.includes('FROM historical_prices')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: [
                  { symbol: 'AAPL', date: '2026-01-01', close: 148 },
                  { symbol: 'AAPL', date: '2026-01-02', close: 150 },
                  { symbol: '^GSPC', date: '2026-01-01', close: 5000 },
                  { symbol: '^GSPC', date: '2026-01-02', close: 5050 },
                ]
              })
            })
          };
        }
        if (sql.includes('FROM portfolio_risk_advisories')) {
          return {
            first: vi.fn().mockResolvedValue({
              id: 1,
              health_score: 90,
              risk_level: 'Low',
              executive_summary: 'Healthy portfolio balance.',
              key_warnings_json: '["Keep an eye on MSFT"]',
              rebalancing_actions_json: '["None needed"]',
              source: 'workers_ai',
              created_at: '2026-10-19T10:00:00.000Z',
            })
          };
        }
        return {
          all: vi.fn().mockResolvedValue({ results: [] }),
          first: vi.fn().mockResolvedValue(null),
          bind: vi.fn().mockReturnValue({
            all: vi.fn().mockResolvedValue({ results: [] }),
            first: vi.fn().mockResolvedValue(null),
          })
        };
      })
    } as unknown as D1Database;

    const waitUntilMock = vi.fn();
    const ctx = { waitUntil: waitUntilMock };

    const data = await loadPortfolioRiskData(mockDb, ctx);

    expect(data.riskHoldings.length).toBe(2);
    expect(data.riskHoldings[0].symbol).toBe('AAPL');
    expect(data.themeMappings.length).toBe(2);
    expect(data.dcfBySymbol['AAPL']?.baseMoS).toBe(20);
    expect(data.fundamentalsBySymbol['AAPL']?.convictionScore).toBe(85);
    expect(data.priceSeries['AAPL'].length).toBe(2);
    expect(data.latestAdvisory?.health_score).toBe(90);
    expect(data.latestAdvisory?.key_warnings).toEqual(['Keep an eye on MSFT']);
    // MSFT has missing prices in historical_prices mock, so waitUntil should be triggered
    expect(waitUntilMock).toHaveBeenCalled();
  });
});
