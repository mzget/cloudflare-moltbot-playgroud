import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveDcfScenarios, getDcfModel, listDcfSymbols, SaveDcfScenariosArgs } from './dcfTools';

describe('dcfTools', () => {
  let mockDb: any;
  let mockEnv: any;
  let executedBatches: any[];
  let preparedStatements: { sql: string; params: any[] }[];

  beforeEach(() => {
    vi.resetAllMocks();
    executedBatches = [];
    preparedStatements = [];

    mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        const stmt = {
          sql,
          params: [] as any[],
          bind: vi.fn().mockImplementation((...args: any[]) => {
            stmt.params = args;
            preparedStatements.push({ sql, params: args });
            return stmt;
          }),
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM market_stats WHERE symbol = ?')) {
              return { price: 120.0, market_cap: 3000000, pe_ratio: 45.0 };
            }
            return null;
          }),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM dcf_calculations') && sql.includes('WHERE symbol = ?')) {
              return {
                results: [
                  {
                    symbol: 'NVDA',
                    scenario_name: 'Base Case',
                    base_revenue: 130.5,
                    implied_share_price: 150.0,
                    wacc: 10.0,
                    terminal_growth: 3.0,
                    shares_outstanding: 24500,
                    yearly_growth: JSON.stringify([30, 25, 20, 15, 10]),
                    yearly_op_margin: JSON.stringify([58, 59, 60, 60, 59]),
                    yearly_fcf_conv: JSON.stringify([80, 80, 82, 85, 85]),
                    rationale: 'Solid AI chip growth',
                    source: 'gemini_spark',
                    created_at: '2026-10-08 23:00:00'
                  },
                  {
                    symbol: 'NVDA',
                    scenario_name: 'Bear Case',
                    base_revenue: 130.5,
                    implied_share_price: 90.0,
                    wacc: 11.0,
                    terminal_growth: 2.5,
                    shares_outstanding: 24500,
                    yearly_growth: JSON.stringify([15, 10, 8, 5, 5]),
                    yearly_op_margin: JSON.stringify([50, 48, 46, 45, 45]),
                    yearly_fcf_conv: JSON.stringify([75, 75, 75, 75, 75]),
                    rationale: 'Capex digestion cycle',
                    source: 'gemini_spark',
                    created_at: '2026-10-08 23:00:00'
                  }
                ]
              };
            }
            if (sql.includes('FROM dcf_calculations d')) {
              return {
                results: [
                  {
                    symbol: 'NVDA',
                    base_case_price: 150.0,
                    bull_case_price: 200.0,
                    bear_case_price: 90.0,
                    last_updated: '2026-10-08 23:00:00',
                    source: 'gemini_spark',
                    current_price: 120.0
                  }
                ]
              };
            }
            return { results: [] };
          })
        };
        return stmt;
      }),
      batch: vi.fn().mockImplementation(async (statements: any[]) => {
        executedBatches.push(statements);
        return statements.map(() => ({ success: true }));
      })
    };

    mockEnv = {
      DB: mockDb
    };
  });

  describe('saveDcfScenarios', () => {
    const validBasePayload: SaveDcfScenariosArgs = {
      symbol: 'NVDA',
      scenarios: [
        {
          scenario_name: 'Base Case',
          mode: 'detailed',
          base_revenue: 130.5,
          shares_outstanding: 24500, // Millions!
          net_cash: 28.5,
          wacc: 10.5,
          terminal_growth: 3.0,
          tax_rate: 21.0,
          exit_multiple: 25.0,
          target_shares: 24500,
          implied_share_price: 142.50,
          yearly_growth: [35, 25, 20, 15, 12],
          yearly_op_margin: [58, 59, 60, 60, 59],
          yearly_fcf_conv: [80, 80, 82, 85, 85],
          rationale: 'Solid Blackwell ramp',
          source: 'gemini_spark'
        },
        {
          scenario_name: 'Bull Case',
          mode: 'detailed',
          base_revenue: 130.5,
          shares_outstanding: 24500,
          net_cash: 28.5,
          wacc: 9.5,
          terminal_growth: 3.5,
          implied_share_price: 195.00,
          yearly_growth: [45, 35, 25, 20, 15],
          yearly_op_margin: [60, 62, 63, 63, 62],
          yearly_fcf_conv: [85, 85, 87, 88, 88],
          rationale: 'Hyper-accelerated adoption',
          source: 'gemini_spark'
        }
      ]
    };

    it('saves scenarios successfully with atomic D1 batch', async () => {
      const res = await saveDcfScenarios(mockEnv, validBasePayload);
      expect(res.success).toBe(true);
      expect(res.symbol).toBe('NVDA');
      expect(res.saved_scenarios).toEqual(['Base Case', 'Bull Case']);
      expect(mockDb.batch).toHaveBeenCalledTimes(1);

      // 2 scenarios * 2 statements each (DELETE + INSERT) = 4 statements
      const batchArgs = executedBatches[0];
      expect(batchArgs.length).toBe(4);
    });

    it('syncs target_price to watchlist when sync_target_price is true', async () => {
      const payload: SaveDcfScenariosArgs = {
        ...validBasePayload,
        sync_target_price: true
      };

      const res = await saveDcfScenarios(mockEnv, payload);
      expect(res.success).toBe(true);
      expect(res.target_price_synced).toBe(true);

      // 4 statements (2 x DELETE + INSERT) + 1 UPDATE watchlist = 5 statements
      const batchArgs = executedBatches[0];
      expect(batchArgs.length).toBe(5);
    });

    it('rejects suspicious shares_outstanding < 50 (guardrail against Billion unit confusion)', async () => {
      const badPayload: SaveDcfScenariosArgs = {
        symbol: 'NVDA',
        scenarios: [
          {
            scenario_name: 'Base Case',
            base_revenue: 130.5,
            shares_outstanding: 24.5, // Bad! Passed Billions instead of Millions
            wacc: 10.0,
            terminal_growth: 3.0,
            implied_share_price: 140.0
          }
        ]
      };

      const res = await saveDcfScenarios(mockEnv, badPayload);
      expect(res.error).toBeDefined();
      expect(res.error).toContain('Shares MUST be in Millions');
      expect(mockDb.batch).not.toHaveBeenCalled();
    });

    it('rejects when terminal_growth >= wacc', async () => {
      const badPayload: SaveDcfScenariosArgs = {
        symbol: 'NVDA',
        scenarios: [
          {
            scenario_name: 'Base Case',
            base_revenue: 130.5,
            shares_outstanding: 24500,
            wacc: 3.0,
            terminal_growth: 3.5, // Bad! terminal_growth > wacc
            implied_share_price: 140.0
          }
        ]
      };

      const res = await saveDcfScenarios(mockEnv, badPayload);
      expect(res.error).toBeDefined();
      expect(res.error).toContain('terminal_growth (3.5%) must be strictly less than wacc (3%)');
      expect(mockDb.batch).not.toHaveBeenCalled();
    });

    it('rejects invalid scenario_name or duplicates', async () => {
      const invalidNamePayload: SaveDcfScenariosArgs = {
        symbol: 'NVDA',
        scenarios: [
          {
            scenario_name: 'Extreme Case' as any,
            base_revenue: 130.5,
            shares_outstanding: 24500,
            wacc: 10.0,
            terminal_growth: 3.0,
            implied_share_price: 140.0
          }
        ]
      };

      const res = await saveDcfScenarios(mockEnv, invalidNamePayload);
      expect(res.error).toContain("Must be one of: 'Base Case', 'Bull Case', 'Bear Case'");

      const duplicatePayload: SaveDcfScenariosArgs = {
        symbol: 'NVDA',
        scenarios: [
          {
            scenario_name: 'Base Case',
            base_revenue: 130.5,
            shares_outstanding: 24500,
            wacc: 10.0,
            terminal_growth: 3.0,
            implied_share_price: 140.0
          },
          {
            scenario_name: 'Base Case',
            base_revenue: 130.5,
            shares_outstanding: 24500,
            wacc: 10.0,
            terminal_growth: 3.0,
            implied_share_price: 140.0
          }
        ]
      };

      const dupRes = await saveDcfScenarios(mockEnv, duplicatePayload);
      expect(dupRes.error).toContain("Duplicate scenario_name: 'Base Case'");
    });

    it('rejects yearly array when length is not 5', async () => {
      const badArrayPayload: SaveDcfScenariosArgs = {
        symbol: 'NVDA',
        scenarios: [
          {
            scenario_name: 'Base Case',
            base_revenue: 130.5,
            shares_outstanding: 24500,
            wacc: 10.0,
            terminal_growth: 3.0,
            implied_share_price: 140.0,
            yearly_growth: [30, 20, 10] // only 3 items
          }
        ]
      };

      const res = await saveDcfScenarios(mockEnv, badArrayPayload);
      expect(res.error).toContain('yearly_growth for \'Base Case\' must have exactly 5 elements');
    });

    it('rejects empty or missing symbol', async () => {
      const res = await saveDcfScenarios(mockEnv, { symbol: '', scenarios: [] });
      expect(res.error).toContain('symbol is required');
    });
  });

  describe('getDcfModel', () => {
    it('returns formatted scenarios and calculates upside/downside and margin of safety', async () => {
      const res = await getDcfModel(mockEnv, 'nvda');
      expect(res.symbol).toBe('NVDA');
      expect(res.current_price).toBe(120.0);
      expect(res.scenario_count).toBe(2);

      const base = res.scenarios[0];
      expect(base.scenario_name).toBe('Base Case');
      expect(base.implied_share_price).toBe(150.0);
      // ((150 - 120) / 120) * 100 = 25% upside
      expect(base.upside_downside_pct).toBe(25.0);
      // ((150 - 120) / 150) * 100 = 20% margin of safety
      expect(base.margin_of_safety_pct).toBe(20.0);
      expect(base.rationale).toBe('Solid AI chip growth');
      expect(base.source).toBe('gemini_spark');

      const bear = res.scenarios[1];
      expect(bear.scenario_name).toBe('Bear Case');
      expect(bear.implied_share_price).toBe(90.0);
      // ((90 - 120) / 120) * 100 = -25% downside
      expect(bear.upside_downside_pct).toBe(-25.0);
      expect(bear.margin_of_safety_pct).toBe(0);
    });

    it('returns error when symbol is missing', async () => {
      const res = await getDcfModel(mockEnv, '');
      expect(res.error).toBe('symbol is required');
    });
  });

  describe('listDcfSymbols', () => {
    it('lists all symbols with valuations and upside', async () => {
      const res = await listDcfSymbols(mockEnv);
      expect(res.total_symbols).toBe(1);
      expect(res.symbols[0].symbol).toBe('NVDA');
      expect(res.symbols[0].base_case_price).toBe(150.0);
      expect(res.symbols[0].bull_case_price).toBe(200.0);
      expect(res.symbols[0].bear_case_price).toBe(90.0);
      expect(res.symbols[0].base_upside_pct).toBe(25.0);
    });
  });
});

