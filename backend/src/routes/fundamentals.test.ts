import { describe, it, expect, vi, beforeEach } from 'vitest';
import fundamentals from './fundamentals';

describe('Fundamentals Routes (/api/fundamentals)', () => {
  let mockDb: any;
  let mockEnv: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/fundamentals/status', () => {
    it('returns watchlist items with active, stale, and missing statuses and aggregated theme tags', async () => {
      mockDb = {
        prepare: vi.fn((sql: string) => {
          const stmt: any = {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockImplementation(async () => {
              if (sql.includes('FROM watchlist w')) {
                return {
                  results: [
                    {
                      symbol: 'ARM',
                      company_name: 'Arm Holdings plc',
                      as_of_date: '2026-07-29',
                      source_count: 5,
                      updated_at: '2026-08-01T12:00:00Z'
                    },
                    {
                      symbol: 'INTC',
                      company_name: 'Intel Corp',
                      as_of_date: '2026-01-01',
                      source_count: 2,
                      updated_at: '2026-01-02T10:00:00Z'
                    },
                    {
                      symbol: 'PLTR',
                      company_name: 'Palantir Technologies',
                      as_of_date: null,
                      source_count: null,
                      updated_at: null
                    }
                  ]
                };
              }
              if (sql.includes('FROM theme_symbol_mappings tsm')) {
                return {
                  results: [
                    { symbol: 'ARM', theme_name: 'SemiAnalysis AI & Compute Dynamics' },
                    { symbol: 'ARM', theme_name: 'Edge AI Silicon' },
                    { symbol: 'INTC', theme_name: 'Foundry Wars' }
                  ]
                };
              }
              return { results: [] };
            })
          };
          return stmt;
        })
      };

      mockEnv = { DB: mockDb };

      // Pass as_of reference date of 2026-08-15
      // ARM (2026-07-29) is 17 days old -> active
      // INTC (2026-01-01) is 226 days old -> stale
      // PLTR (null) -> missing
      const res = await fundamentals.request('/api/fundamentals/status?as_of=2026-08-15', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.items).toHaveLength(3);

      const arm = data.items.find((i: any) => i.symbol === 'ARM');
      expect(arm).toBeDefined();
      expect(arm.company_name).toBe('Arm Holdings plc');
      expect(arm.status).toBe('active');
      expect(arm.source_count).toBe(5);
      expect(arm.theme_tags).toEqual(['SemiAnalysis AI & Compute Dynamics', 'Edge AI Silicon']);

      const intc = data.items.find((i: any) => i.symbol === 'INTC');
      expect(intc).toBeDefined();
      expect(intc.status).toBe('stale');
      expect(intc.source_count).toBe(2);
      expect(intc.theme_tags).toEqual(['Foundry Wars']);

      const pltr = data.items.find((i: any) => i.symbol === 'PLTR');
      expect(pltr).toBeDefined();
      expect(pltr.status).toBe('missing');
      expect(pltr.as_of_date).toBeNull();
      expect(pltr.source_count).toBe(0);
      expect(pltr.theme_tags).toEqual([]);

      expect(data.summary).toEqual({
        total: 3,
        active: 1,
        stale: 1,
        missing: 1
      });
    });

    it('returns empty list and zero summary counts when watchlist is empty', async () => {
      mockDb = {
        prepare: vi.fn(() => ({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] })
        }))
      };
      mockEnv = { DB: mockDb };

      const res = await fundamentals.request('/api/fundamentals/status', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.items).toEqual([]);
      expect(data.summary).toEqual({
        total: 0,
        active: 0,
        stale: 0,
        missing: 0
      });
    });

    it('deduplicates theme_tags when a symbol is mapped to multiple notebooks with the same theme name', async () => {
      mockDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM watchlist w')) {
              return {
                results: [
                  {
                    symbol: 'NVDA',
                    company_name: 'NVIDIA Corp',
                    as_of_date: '2026-08-01',
                    source_count: 5,
                    updated_at: '2026-08-01T12:00:00Z'
                  }
                ]
              };
            }
            if (sql.includes('FROM theme_symbol_mappings tsm')) {
              return {
                results: [
                  { symbol: 'NVDA', theme_name: 'AI Accelerators' },
                  { symbol: 'NVDA', theme_name: 'AI Accelerators' }, // duplicate theme name
                  { symbol: 'NVDA', theme_name: 'Datacenter Silicon' }
                ]
              };
            }
            return { results: [] };
          })
        }))
      };
      mockEnv = { DB: mockDb };

      const res = await fundamentals.request('/api/fundamentals/status', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.items).toHaveLength(1);
      const nvda = data.items[0];
      expect(nvda.theme_tags).toEqual(['AI Accelerators', 'Datacenter Silicon']);
    });

    it('returns HTTP 500 when database query throws', async () => {
      mockDb = {
        prepare: vi.fn(() => {
          throw new Error('D1 query failure');
        })
      };
      mockEnv = { DB: mockDb };

      const res = await fundamentals.request('/api/fundamentals/status', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.error).toBe('D1 query failure');
    });
  });

  describe('GET /api/fundamentals', () => {
    it('returns 400 when symbol query parameter is missing or whitespace', async () => {
      mockDb = { prepare: vi.fn() };
      mockEnv = { DB: mockDb };

      const res1 = await fundamentals.request('/api/fundamentals', { method: 'GET' }, mockEnv);
      expect(res1.status).toBe(400);
      const data1 = (await res1.json()) as any;
      expect(data1.error).toContain('symbol');

      const res2 = await fundamentals.request('/api/fundamentals?symbol=%20%20', { method: 'GET' }, mockEnv);
      expect(res2.status).toBe(400);
    });

    it('returns 404 when fundamental record is not found for symbol', async () => {
      mockDb = {
        prepare: vi.fn(() => ({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }))
      };
      mockEnv = { DB: mockDb };

      const res = await fundamentals.request('/api/fundamentals?symbol=UNKNOWN', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(404);
      const data = (await res.json()) as any;
      expect(data.symbol).toBe('UNKNOWN');
      expect(data.fundamental).toBeNull();
      expect(data.themes).toEqual([]);
    });

    it('returns 200 with deserialized fundamental profile and linked theme contexts', async () => {
      mockDb = {
        prepare: vi.fn((sql: string) => {
          const stmt: any = {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockImplementation(async () => {
              if (sql.includes('FROM stock_fundamentals')) {
                return {
                  symbol: 'ARM',
                  business_model: 'High-margin IP licensing and royalty model',
                  moat: 'Architecture lock-in with pervasive ARMv9 instruction set',
                  competitors: JSON.stringify(['x86', 'RISC-V']),
                  guidance: JSON.stringify({
                    revenue_target: 'Mid-20s % revenue CAGR',
                    margin_target: '60% non-GAAP operating margin'
                  }),
                  key_risks: JSON.stringify(['Customer architecture in-housing', 'China joint venture']),
                  thesis_kpis: JSON.stringify(['Royalty per chip', 'CSS adoption rate']),
                  as_of_date: '2026-07-29',
                  notebook_id: 'nb_arm_123',
                  source_count: 8,
                  updated_at: '2026-08-01'
                };
              }
              return null;
            }),
            all: vi.fn().mockImplementation(async () => {
              if (sql.includes('FROM theme_sector_contexts t')) {
                return {
                  results: [
                    {
                      notebook_id: 'nb_semi_001',
                      theme_name: 'SemiAnalysis AI & Compute Dynamics',
                      industry_dynamics: 'Capex shift towards custom silicon',
                      supply_chain_bottlenecks: 'CoWoS-L packaging constraints',
                      competitive_landscape: 'TSMC advanced node monopoly',
                      macro_trends: 'Hyperscaler sovereign AI buildout',
                      updated_at: '2026-08-10'
                    }
                  ]
                };
              }
              return { results: [] };
            })
          };
          return stmt;
        })
      };
      mockEnv = { DB: mockDb };

      // Case-insensitive query: "arm"
      const res = await fundamentals.request('/api/fundamentals?symbol=arm', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.symbol).toBe('ARM');
      expect(data.fundamental.symbol).toBe('ARM');
      expect(data.fundamental.business_model).toContain('IP licensing');
      expect(data.fundamental.competitors).toEqual(['x86', 'RISC-V']);
      expect(data.fundamental.guidance.revenue_target).toBe('Mid-20s % revenue CAGR');
      expect(data.fundamental.key_risks).toHaveLength(2);
      expect(data.fundamental.thesis_kpis).toEqual(['Royalty per chip', 'CSS adoption rate']);
      expect(data.fundamental.as_of_date).toBe('2026-07-29');

      expect(data.themes).toHaveLength(1);
      expect(data.themes[0].theme_name).toBe('SemiAnalysis AI & Compute Dynamics');
      expect(data.themes[0].supply_chain_bottlenecks).toBe('CoWoS-L packaging constraints');
      expect(data.themes[0].symbols).toEqual(['ARM']);
    });

    it('returns 200 with empty themes when no themes are mapped', async () => {
      mockDb = {
        prepare: vi.fn((sql: string) => {
          const stmt: any = {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockImplementation(async () => {
              if (sql.includes('FROM stock_fundamentals')) {
                return {
                  symbol: 'AAPL',
                  business_model: 'Consumer electronics & services',
                  moat: 'Ecosystem lock-in',
                  as_of_date: '2026-08-01',
                  source_count: 1
                };
              }
              return null;
            }),
            all: vi.fn().mockResolvedValue({ results: [] })
          };
          return stmt;
        })
      };
      mockEnv = { DB: mockDb };

      const res = await fundamentals.request('/api/fundamentals?symbol=AAPL', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.symbol).toBe('AAPL');
      expect(data.fundamental.symbol).toBe('AAPL');
      expect(data.themes).toEqual([]);
    });

    it('deduplicates themes by theme_name, preserving the most recently updated entry', async () => {
      mockDb = {
        prepare: vi.fn((sql: string) => {
          const stmt: any = {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockImplementation(async () => {
              if (sql.includes('FROM stock_fundamentals')) {
                return {
                  symbol: 'NVDA',
                  business_model: 'Accelerated computing and AI hardware/software platforms',
                  moat: 'CUDA ecosystem and interconnect fabric',
                  competitors: JSON.stringify(['AMD', 'Intel']),
                  guidance: JSON.stringify({ revenue_target: '$30B+' }),
                  key_risks: JSON.stringify(['Export restrictions', 'Supply concentration']),
                  thesis_kpis: JSON.stringify(['Data center revenue', 'Gross margin']),
                  as_of_date: '2026-08-01',
                  notebook_id: 'nb_nvda_primary',
                  source_count: 10,
                  updated_at: '2026-08-05'
                };
              }
              return null;
            }),
            all: vi.fn().mockImplementation(async () => {
              if (sql.includes('FROM theme_sector_contexts t')) {
                return {
                  results: [
                    {
                      notebook_id: 'nb_ai_v2',
                      theme_name: 'AI Accelerators',
                      industry_dynamics: 'Updated: Blackwell ramp accelerates hyperscaler capex',
                      supply_chain_bottlenecks: 'CoWoS packaging capacity',
                      competitive_landscape: 'Monopoly in training',
                      macro_trends: 'GenAI enterprise deployment',
                      updated_at: '2026-08-10'
                    },
                    {
                      notebook_id: 'nb_ai_v1',
                      theme_name: 'AI Accelerators', // duplicate theme name from older notebook
                      industry_dynamics: 'Older context: Hopper demand strong',
                      supply_chain_bottlenecks: 'HBM supply tightness',
                      competitive_landscape: 'CUDA dominance',
                      macro_trends: 'Hyperscaler capex',
                      updated_at: '2026-06-01'
                    },
                    {
                      notebook_id: 'nb_dc_silicon',
                      theme_name: 'Datacenter Silicon',
                      industry_dynamics: 'Custom ASIC vs GPU debate',
                      supply_chain_bottlenecks: null,
                      competitive_landscape: null,
                      macro_trends: null,
                      updated_at: '2026-07-15'
                    }
                  ]
                };
              }
              return { results: [] };
            })
          };
          return stmt;
        })
      };
      mockEnv = { DB: mockDb };

      const res = await fundamentals.request('/api/fundamentals?symbol=NVDA', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.symbol).toBe('NVDA');
      expect(data.themes).toHaveLength(2);
      expect(data.themes[0].theme_name).toBe('AI Accelerators');
      expect(data.themes[0].notebook_id).toBe('nb_ai_v2'); // Preserved newest record
      expect(data.themes[0].industry_dynamics).toContain('Updated: Blackwell ramp');
      expect(data.themes[1].theme_name).toBe('Datacenter Silicon');
      expect(data.themes[1].notebook_id).toBe('nb_dc_silicon');
    });

    it('returns HTTP 500 when database throws during symbol lookup', async () => {
      mockDb = {
        prepare: vi.fn(() => {
          throw new Error('Database connection reset');
        })
      };
      mockEnv = { DB: mockDb };

      const res = await fundamentals.request('/api/fundamentals?symbol=ARM', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.error).toBe('Database connection reset');
    });
  });
});
