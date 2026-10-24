import { describe, it, expect, vi } from 'vitest';
import risk, { loadPortfolioRiskData } from './risk';

describe('Risk Routes & Portfolio Risk Logic', () => {
  const createMockDb = (options: {
    holdings?: any[];
    themes?: any[];
    dcf?: any[];
    fundamentals?: any[];
    prices?: any[];
    advisory?: any;
    throwOnHoldings?: boolean;
    throwOnAdvisoryInsert?: boolean;
  } = {}) => {
    return {
      batch: vi.fn().mockImplementation((stmts: any[]) => Promise.resolve(stmts.map(() => ({ meta: {} })))),
      prepare: vi.fn((sql: string) => {
        if (options.throwOnHoldings && sql.includes('FROM holdings h')) {
          throw new Error('D1 Query Failed');
        }

        if (sql.includes('FROM holdings h')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: options.holdings ?? [
                { symbol: 'AAPL', shares: 10, avg_cost: 140, total_cost: 1400, status: 'Open', name: 'Apple Inc.', sector_label: 'Tech', last_price: 150, previous_close: 148 },
                { symbol: 'MSFT', shares: 20, avg_cost: 380, total_cost: 7600, status: 'Open', name: 'Microsoft Corp.', sector_label: 'Tech', last_price: 400, previous_close: 395 },
              ]
            })
          };
        }
        if (sql.includes('FROM theme_symbol_mappings m') || sql.includes('FROM theme_sector_contexts c')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: options.themes ?? [
                { symbol: 'AAPL', notebook_id: 'nb-1', theme_name: 'Consumer Tech' },
                { symbol: 'MSFT', notebook_id: 'nb-2', theme_name: 'AI & Cloud Infrastructure' },
              ]
            })
          };
        }
        if (sql.includes('FROM dcf_calculations')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: options.dcf ?? [
                { symbol: 'AAPL', scenario_name: 'Base Case', implied_share_price: 180 },
                { symbol: 'AAPL', scenario_name: 'Bear Case', implied_share_price: 130 },
              ]
            })
          };
        }
        if (sql.includes('FROM stock_fundamentals')) {
          return {
            all: vi.fn().mockResolvedValue({
              results: options.fundamentals ?? [
                { symbol: 'AAPL', debate_json: '{"round": 3, "synthesis": {"conviction_score": 85}}' },
              ]
            })
          };
        }
        if (sql.includes('FROM historical_prices')) {
          return {
            bind: vi.fn().mockReturnValue({
              all: vi.fn().mockResolvedValue({
                results: options.prices ?? [
                  { symbol: 'AAPL', date: '2026-01-01', close: 148 },
                  { symbol: 'AAPL', date: '2026-01-02', close: 150 },
                  { symbol: '^GSPC', date: '2026-01-01', close: 5000 },
                  { symbol: '^GSPC', date: '2026-01-02', close: 5050 },
                ]
              }),
              first: vi.fn().mockResolvedValue({ maxDate: '2026-01-02' }),
            })
          };
        }
        if (sql.includes('FROM portfolio_risk_advisories')) {
          return {
            first: vi.fn().mockResolvedValue(options.advisory !== undefined ? options.advisory : {
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
        if (sql.includes('INSERT INTO portfolio_risk_advisories')) {
          if (options.throwOnAdvisoryInsert) {
            throw new Error('Failed to insert advisory');
          }
          return {
            bind: vi.fn().mockReturnValue({
              run: vi.fn().mockResolvedValue({
                meta: { last_row_id: 101 }
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
    } as unknown as D1Database;
  };

  const createMockEnv = (db: D1Database, aiOverrides?: Partial<any>) => {
    return {
      DB: db,
      default_ai_model: '@cf/google/gemma-4-26b-a4b-it',
      AI: {
        run: vi.fn().mockResolvedValue({
          response: JSON.stringify({
            executive_summary: 'Portfolio is concentrated in Tech with moderate beta.',
            key_warnings: ['MSFT exceeds target weight of 8%'],
            rebalancing_actions: ['Trim MSFT to target 8%']
          })
        }),
        ...aiOverrides,
      }
    };
  };

  describe('loadPortfolioRiskData', () => {
    it('loads holdings, themes, DCF, fundamentals, historical prices, and latest advisory', async () => {
      const mockDb = createMockDb();
      const waitUntilMock = vi.fn();
      const ctx = { waitUntil: waitUntilMock };

      const data = await loadPortfolioRiskData(mockDb, ctx);

      expect(data.riskHoldings.length).toBe(2);
      expect(data.riskHoldings[0].symbol).toBe('AAPL');
      expect(data.themeMappings.length).toBe(2);
      expect(data.dcfBySymbol['AAPL']?.baseMoS).toBe(20);
      expect(data.dcfBySymbol['AAPL']?.baseIntrinsic).toBe(180);
      expect(data.dcfBySymbol['AAPL']?.bearMoS).toBe(-13.3);
      expect(data.dcfBySymbol['AAPL']?.bearIntrinsic).toBe(130);
      expect(data.fundamentalsBySymbol['AAPL']?.convictionScore).toBe(85);
      expect(data.priceSeries['AAPL'].length).toBe(2);
      expect(data.latestAdvisory?.health_score).toBe(90);
      expect(data.latestAdvisory?.key_warnings).toEqual(['Keep an eye on MSFT']);
      // MSFT has missing prices in historical_prices mock, so waitUntil should be triggered
      expect(waitUntilMock).toHaveBeenCalled();
    });

    it('safely handles missing, invalid, or duplicate DCF calculations and computes MoS accurately', async () => {
      const mockDb = createMockDb({
        holdings: [
          { symbol: 'AAPL', shares: 10, avg_cost: 140, total_cost: 1400, status: 'Open', name: 'Apple Inc.', sector_label: 'Tech', last_price: 150, previous_close: 148 },
          { symbol: 'TSLA', shares: 5, avg_cost: 200, total_cost: 1000, status: 'Open', name: 'Tesla Inc.', sector_label: 'Auto', last_price: null, previous_close: null },
        ],
        dcf: [
          // AAPL has multiple rows ordered by id desc (simulating newer run overriding older run)
          { symbol: 'AAPL', scenario_name: 'Base Case', implied_share_price: 180 },
          { symbol: 'AAPL', scenario_name: 'Base Case', implied_share_price: 120 }, // older row, should be ignored
          // TSLA has null price, so MoS should be undefined even if implied_share_price exists
          { symbol: 'TSLA', scenario_name: 'Base Case', implied_share_price: 250 },
          // Legacy format fallback check (scenario + margin_of_safety_pct)
          { symbol: 'LEGACY', scenario: 'Base Case', intrinsic_price: 50, margin_of_safety_pct: 15 },
        ]
      });

      const data = await loadPortfolioRiskData(mockDb);

      // AAPL should pick the first (newest) row: 180 with last_price 150 => MoS = (180 - 150) / 150 * 100 = 20%
      expect(data.dcfBySymbol['AAPL']?.baseIntrinsic).toBe(180);
      expect(data.dcfBySymbol['AAPL']?.baseMoS).toBe(20);

      // TSLA has no valid last_price, MoS is undefined
      expect(data.dcfBySymbol['TSLA']?.baseIntrinsic).toBe(250);
      expect(data.dcfBySymbol['TSLA']?.baseMoS).toBeUndefined();

      // LEGACY fallback check
      expect(data.dcfBySymbol['LEGACY']?.baseIntrinsic).toBe(50);
      expect(data.dcfBySymbol['LEGACY']?.baseMoS).toBe(15);
    });

    it('dispatches the 5 independent D1 queries concurrently via Promise.all before resolving', async () => {
      const callOrder: string[] = [];
      let resolveAll!: () => void;
      const gate = new Promise<void>(r => {
        resolveAll = r;
      });

      const mockDb = {
        prepare: vi.fn((sql: string) => {
          if (sql.includes('FROM holdings h')) {
            callOrder.push('holdings');
            return { all: vi.fn(() => gate.then(() => ({ results: [{ symbol: 'AAPL', shares: 10, last_price: 150, status: 'Open' }] }))) };
          }
          if (sql.includes('FROM theme_sector_contexts c')) {
            callOrder.push('themes');
            return { all: vi.fn(() => gate.then(() => ({ results: [{ symbol: 'AAPL', notebook_id: 'nb-1', theme_name: 'Consumer Tech' }] }))) };
          }
          if (sql.includes('FROM dcf_calculations')) {
            callOrder.push('dcf');
            return { all: vi.fn(() => gate.then(() => ({ results: [] }))) };
          }
          if (sql.includes('FROM stock_fundamentals')) {
            callOrder.push('fundamentals');
            return { all: vi.fn(() => gate.then(() => ({ results: [] }))) };
          }
          if (sql.includes('FROM portfolio_risk_advisories')) {
            callOrder.push('advisories');
            return { first: vi.fn(() => gate.then(() => null)) };
          }
          if (sql.includes('FROM historical_prices')) {
            callOrder.push('historical_prices');
            return {
              bind: vi.fn().mockReturnValue({
                all: vi.fn().mockResolvedValue({ results: [] }),
              }),
            };
          }
          return { all: vi.fn().mockResolvedValue({ results: [] }), first: vi.fn().mockResolvedValue(null) };
        }),
      } as unknown as D1Database;

      const promise = loadPortfolioRiskData(mockDb);
      // Before gate resolves, all 5 independent queries must already be initiated concurrently
      expect(callOrder).toEqual(['holdings', 'themes', 'dcf', 'fundamentals', 'advisories']);

      resolveAll();
      const result = await promise;
      expect(callOrder).toEqual(['holdings', 'themes', 'dcf', 'fundamentals', 'advisories', 'historical_prices']);
      expect(result.riskHoldings.length).toBe(1);
    });
  });

  describe('GET /api/portfolio/risk-audit', () => {
    it('returns 200 with concentration, correlation, health score, holdings sizing, and themeMappings', async () => {
      const mockDb = createMockDb();
      const mockEnv = createMockEnv(mockDb);

      const res = await risk.request('/api/portfolio/risk-audit', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(200);

      const json = await res.json() as any;
      expect(json.concentration).toBeDefined();
      expect(json.concentration.totalStockPortfolioUsd).toBe(9500); // AAPL 1500 + MSFT 8000
      expect(json.correlation).toBeDefined();
      expect(json.health).toBeDefined();
      expect(json.health.healthScore).toBeGreaterThanOrEqual(0);
      expect(json.holdingsSizing.length).toBe(2);
      expect(json.themeMappings).toBeDefined();
      expect(json.themeMappings.length).toBe(2);
      expect(json.themeMappings[0]).toEqual({ symbol: 'AAPL', themeName: 'Consumer Tech', notebookId: 'nb-1' });
      expect(json.latestAdvisory).toBeDefined();
      expect(json.latestAdvisory.health_score).toBe(90);
    });

    it('handles empty portfolio gracefully', async () => {
      const mockDb = createMockDb({ holdings: [], themes: [], dcf: [], fundamentals: [], prices: [], advisory: null });
      const mockEnv = createMockEnv(mockDb);

      const res = await risk.request('/api/portfolio/risk-audit', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(200);

      const json = await res.json() as any;
      expect(json.concentration.totalStockPortfolioUsd).toBe(0);
      expect(json.holdingsSizing).toEqual([]);
      expect(json.themeMappings).toEqual([]);
      expect(json.latestAdvisory).toBeNull();
    });

    it('returns 500 when database query throws', async () => {
      const mockDb = createMockDb({ throwOnHoldings: true });
      const mockEnv = createMockEnv(mockDb);

      const res = await risk.request('/api/portfolio/risk-audit', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(500);

      const json = await res.json() as any;
      expect(json.error).toContain('D1 Query Failed');
    });
  });

  describe('POST /api/portfolio/position-sizing', () => {
    it('returns 400 when symbol is missing or empty', async () => {
      const mockDb = createMockDb();
      const mockEnv = createMockEnv(mockDb);

      const res = await risk.request(
        '/api/portfolio/position-sizing',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: '' })
        },
        mockEnv
      );
      expect(res.status).toBe(400);

      const json = await res.json() as any;
      expect(json.error).toBe('symbol is required');
    });

    it('returns 200 with sizing and pre-trade simulation impact', async () => {
      const mockDb = createMockDb();
      const mockEnv = createMockEnv(mockDb);

      const res = await risk.request(
        '/api/portfolio/position-sizing',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'AAPL',
            price: 150,
            shares: 5,
            type: 'Buy',
            config: {
              targetWeightPct: 8,
              maxStockCapPct: 15,
            }
          })
        },
        mockEnv
      );
      expect(res.status).toBe(200);

      const json = await res.json() as any;
      expect(json.symbol).toBe('AAPL');
      expect(json.sizing).toBeDefined();
      expect(json.sizing.maxStockCapPct).toBe(15);
      expect(json.simulation).toBeDefined();
      expect(json.simulation.causesStockCapBreach).toBeDefined();
      expect(json.simulation.tradeValueUsd).toBe(750);
      expect(json.simulation.projectedStockWeightPct).toBeGreaterThan(0);
    });

    it('returns 500 when database fails during position sizing', async () => {
      const mockDb = createMockDb({ throwOnHoldings: true });
      const mockEnv = createMockEnv(mockDb);

      const res = await risk.request(
        '/api/portfolio/position-sizing',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: 'AAPL', price: 150 })
        },
        mockEnv
      );
      expect(res.status).toBe(500);

      const json = await res.json() as any;
      expect(json.error).toContain('D1 Query Failed');
    });
  });

  describe('POST /api/portfolio/risk-advisory', () => {
    it('executes Workers AI audit, parses JSON response, and saves into D1', async () => {
      const mockDb = createMockDb();
      const mockEnv = createMockEnv(mockDb);

      const res = await risk.request(
        '/api/portfolio/risk-advisory',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        },
        mockEnv
      );
      expect(res.status).toBe(200);

      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.advisory).toBeDefined();
      expect(json.advisory.id).toBe(101);
      expect(json.advisory.executive_summary).toContain('Portfolio is concentrated in Tech');
      expect(json.advisory.key_warnings).toEqual(['MSFT exceeds target weight of 8%']);
      expect(json.advisory.rebalancing_actions).toEqual(['Trim MSFT to target 8%']);
      expect(mockEnv.AI.run).toHaveBeenCalled();
    });

    it('handles AI execution failure with 500', async () => {
      const mockDb = createMockDb();
      const mockEnv = createMockEnv(mockDb, {
        run: vi.fn().mockRejectedValue(new Error('Workers AI model overloaded'))
      });

      const res = await risk.request(
        '/api/portfolio/risk-advisory',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        },
        mockEnv
      );
      expect(res.status).toBe(500);

      const json = await res.json() as any;
      expect(json.error).toContain('Workers AI model overloaded');
    });
  });

  describe('DELETE /api/portfolio/themes/:name', () => {
    it('deletes theme and its mappings via atomic batch', async () => {
      const mockDb = createMockDb();
      const mockEnv = createMockEnv(mockDb);

      const res = await risk.request(
        '/api/portfolio/themes/AI%20%26%20Cloud%20Infrastructure',
        { method: 'DELETE' },
        mockEnv
      );

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.deletedTheme).toBe('AI & Cloud Infrastructure');
      expect(mockDb.batch).toHaveBeenCalledTimes(1);
    });

    it('falls back to individual queries if batch is not available', async () => {
      const mockDb = createMockDb() as any;
      delete mockDb.batch;
      const mockEnv = createMockEnv(mockDb);

      const res = await risk.request(
        '/api/portfolio/themes/Consumer%20Tech',
        { method: 'DELETE' },
        mockEnv
      );

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.deletedTheme).toBe('Consumer Tech');
    });

    it('returns 500 when database throws during deletion', async () => {
      const mockDb = createMockDb();
      (mockDb as any).batch = vi.fn().mockRejectedValue(new Error('D1 Delete Failed'));
      const mockEnv = createMockEnv(mockDb);

      const res = await risk.request(
        '/api/portfolio/themes/Faulty%20Theme',
        { method: 'DELETE' },
        mockEnv
      );

      expect(res.status).toBe(500);
      const json = await res.json() as any;
      expect(json.error).toContain('D1 Delete Failed');
    });
  });

  describe('PUT /api/portfolio/themes/:name', () => {
    it('renames a theme in theme_sector_contexts', async () => {
      const mockDb = createMockDb();
      const mockEnv = createMockEnv(mockDb);

      const res = await risk.request(
        '/api/portfolio/themes/Consumer%20Tech',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newThemeName: 'Global Consumer Technology' }),
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.oldThemeName).toBe('Consumer Tech');
      expect(json.newThemeName).toBe('Global Consumer Technology');
    });

    it('returns 400 when newThemeName is empty or missing', async () => {
      const mockDb = createMockDb();
      const mockEnv = createMockEnv(mockDb);

      const res = await risk.request(
        '/api/portfolio/themes/Consumer%20Tech',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newThemeName: '   ' }),
        },
        mockEnv
      );

      expect(res.status).toBe(400);
      const json = await res.json() as any;
      expect(json.error).toContain('New theme name is required');
    });

    it('returns 400 when attempting to rename to or from Unassigned', async () => {
      const mockDb = createMockDb();
      const mockEnv = createMockEnv(mockDb);

      const resToUnassigned = await risk.request(
        '/api/portfolio/themes/Consumer%20Tech',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newThemeName: 'Unassigned' }),
        },
        mockEnv
      );
      expect(resToUnassigned.status).toBe(400);

      const resFromUnassigned = await risk.request(
        '/api/portfolio/themes/Unassigned',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newThemeName: 'Valid Theme' }),
        },
        mockEnv
      );
      expect(resFromUnassigned.status).toBe(400);
    });

    it('returns 500 when database throws during theme rename', async () => {
      const mockDb = createMockDb();
      (mockDb as any).prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error('D1 Update Failed')),
        }),
      });
      const mockEnv = createMockEnv(mockDb);

      const res = await risk.request(
        '/api/portfolio/themes/Consumer%20Tech',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newThemeName: 'New Consumer Tech' }),
        },
        mockEnv
      );

      expect(res.status).toBe(500);
      const json = await res.json() as any;
      expect(json.error).toContain('D1 Update Failed');
    });
  });
});
