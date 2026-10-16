import { describe, it, expect, vi, beforeEach } from 'vitest';
import fundamentals from './fundamentals';

describe('Empirical Challenge: Fundamentals Routes (/api/fundamentals)', () => {
  let mockDb: any;
  let mockEnv: any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('1. GET /api/fundamentals/status', () => {
    it('handles empty watchlist: returns empty array and 0 summary counts', async () => {
      mockDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockImplementation(async () => {
            return { results: [] };
          })
        }))
      };
      mockEnv = { DB: mockDb };

      const res = await fundamentals.request('/api/fundamentals/status', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.items).toEqual([]);
      expect(body.summary).toEqual({
        total: 0,
        active: 0,
        stale: 0,
        missing: 0
      });
    });

    it('handles tickers without fundamentals: verifies status === "missing" and safe defaults', async () => {
      mockDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM watchlist w')) {
              return {
                results: [
                  {
                    symbol: 'PLTR',
                    company_name: 'Palantir Technologies',
                    as_of_date: null,
                    source_count: null,
                    updated_at: null
                  },
                  {
                    symbol: 'SNOW',
                    company_name: null, // missing company name
                    as_of_date: undefined,
                    source_count: undefined,
                    updated_at: null
                  },
                  {
                    symbol: 'MDB',
                    company_name: 'MongoDB Inc',
                    as_of_date: '', // empty string date
                    source_count: 0,
                    updated_at: '2026-01-01'
                  },
                  {
                    symbol: 'DDOG',
                    company_name: 'Datadog',
                    as_of_date: 'invalid-date-string', // unparseable date
                    source_count: 3,
                    updated_at: '2026-01-01'
                  }
                ]
              };
            }
            if (sql.includes('FROM theme_symbol_mappings tsm')) {
              return { results: [] };
            }
            return { results: [] };
          })
        }))
      };
      mockEnv = { DB: mockDb };

      const res = await fundamentals.request('/api/fundamentals/status', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.items).toHaveLength(4);
      expect(body.summary).toEqual({
        total: 4,
        active: 0,
        stale: 0,
        missing: 4
      });

      const pltr = body.items.find((i: any) => i.symbol === 'PLTR');
      expect(pltr.status).toBe('missing');
      expect(pltr.as_of_date).toBeNull();
      expect(pltr.source_count).toBe(0);
      expect(pltr.theme_tags).toEqual([]);

      const snow = body.items.find((i: any) => i.symbol === 'SNOW');
      expect(snow.company_name).toBe('SNOW'); // fallback to symbol
      expect(snow.status).toBe('missing');
      expect(snow.as_of_date).toBeNull();

      const mdb = body.items.find((i: any) => i.symbol === 'MDB');
      expect(mdb.status).toBe('missing');
      expect(mdb.source_count).toBe(0);

      const ddog = body.items.find((i: any) => i.symbol === 'DDOG');
      expect(ddog.status).toBe('missing');
    });

    it('evaluates exact 90-day boundary conditions (89 days -> active, 90 days -> stale)', async () => {
      // Reference date: 2026-08-15T00:00:00Z
      // 89 days before: 2026-05-18T00:00:00Z -> active
      // 90 days before: 2026-05-17T00:00:00Z -> stale
      // 91 days before: 2026-05-16T00:00:00Z -> stale
      // 0 days before:  2026-08-15T00:00:00Z -> active
      mockDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM watchlist w')) {
              return {
                results: [
                  {
                    symbol: 'T89',
                    company_name: 'Day 89 Stock',
                    as_of_date: '2026-05-18',
                    source_count: 1,
                    updated_at: '2026-05-18'
                  },
                  {
                    symbol: 'T90',
                    company_name: 'Day 90 Stock',
                    as_of_date: '2026-05-17',
                    source_count: 1,
                    updated_at: '2026-05-17'
                  },
                  {
                    symbol: 'T91',
                    company_name: 'Day 91 Stock',
                    as_of_date: '2026-05-16',
                    source_count: 1,
                    updated_at: '2026-05-16'
                  },
                  {
                    symbol: 'T00',
                    company_name: 'Day 0 Stock',
                    as_of_date: '2026-08-15',
                    source_count: 1,
                    updated_at: '2026-08-15'
                  }
                ]
              };
            }
            return { results: [] };
          })
        }))
      };
      mockEnv = { DB: mockDb };

      const res = await fundamentals.request('/api/fundamentals/status?as_of=2026-08-15', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.items).toHaveLength(4);

      const t89 = body.items.find((i: any) => i.symbol === 'T89');
      const t90 = body.items.find((i: any) => i.symbol === 'T90');
      const t91 = body.items.find((i: any) => i.symbol === 'T91');
      const t00 = body.items.find((i: any) => i.symbol === 'T00');

      expect(t89.status).toBe('active');
      expect(t90.status).toBe('stale');
      expect(t91.status).toBe('stale');
      expect(t00.status).toBe('active');

      expect(body.summary).toEqual({
        total: 4,
        active: 2,
        stale: 2,
        missing: 0
      });
    });

    it('tests linked themes: multiple distinct themes and verifies deduplication behavior', async () => {
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
                    source_count: 10,
                    updated_at: '2026-08-02'
                  },
                  {
                    symbol: 'AMD',
                    company_name: 'Advanced Micro Devices',
                    as_of_date: '2026-08-01',
                    source_count: 4,
                    updated_at: '2026-08-02'
                  }
                ]
              };
            }
            if (sql.includes('FROM theme_symbol_mappings tsm')) {
              return {
                results: [
                  // NVDA has two distinct themes
                  { symbol: 'NVDA', theme_name: 'AI Accelerators' },
                  { symbol: 'NVDA', theme_name: 'Datacenter Silicon' },
                  // What if AMD has a duplicated theme name from two different notebooks?
                  { symbol: 'AMD', theme_name: 'AI Accelerators' },
                  { symbol: 'AMD', theme_name: 'AI Accelerators' },
                  { symbol: 'AMD', theme_name: 'Client Computing' }
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

      const body = (await res.json()) as any;
      const nvda = body.items.find((i: any) => i.symbol === 'NVDA');
      expect(nvda.theme_tags).toEqual(['AI Accelerators', 'Datacenter Silicon']);

      const amd = body.items.find((i: any) => i.symbol === 'AMD');
      // Empirical verification of deduplication requirement:
      expect(amd.theme_tags).toEqual(['AI Accelerators', 'Client Computing']);
    });
  });

  describe('2. GET /api/fundamentals', () => {
    it('returns 404 with exact contract { error, symbol, fundamental: null, themes: [] } for unknown symbol', async () => {
      mockDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }))
      };
      mockEnv = { DB: mockDb };

      const res = await fundamentals.request('/api/fundamentals?symbol=NONEXISTENT_XYZ', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(404);

      const body = (await res.json()) as any;
      expect(body).toEqual({
        error: 'Fundamental brief not found for NONEXISTENT_XYZ',
        symbol: 'NONEXISTENT_XYZ',
        fundamental: null,
        themes: []
      });
    });

    it('returns 400 for missing symbol, empty symbol, and whitespace-only symbol', async () => {
      mockDb = { prepare: vi.fn() };
      mockEnv = { DB: mockDb };

      // Missing
      const resMissing = await fundamentals.request('/api/fundamentals', { method: 'GET' }, mockEnv);
      expect(resMissing.status).toBe(400);
      const bodyMissing = (await resMissing.json()) as any;
      expect(bodyMissing.error).toBe('symbol query parameter is required');

      // Empty string
      const resEmpty = await fundamentals.request('/api/fundamentals?symbol=', { method: 'GET' }, mockEnv);
      expect(resEmpty.status).toBe(400);

      // Whitespace spaces
      const resSpaces = await fundamentals.request('/api/fundamentals?symbol=%20%20%20', { method: 'GET' }, mockEnv);
      expect(resSpaces.status).toBe(400);

      // Whitespace tabs/newlines
      const resTabs = await fundamentals.request('/api/fundamentals?symbol=%09%0A', { method: 'GET' }, mockEnv);
      expect(resTabs.status).toBe(400);
    });

    it('handles case-insensitivity and surrounding whitespace (e.g. ?symbol=  arm  -> ARM)', async () => {
      let boundSymbolToFundamental: any = null;
      let boundSymbolToTheme: any = null;

      mockDb = {
        prepare: vi.fn((sql: string) => {
          const stmt: any = {
            bind: vi.fn().mockImplementation((...args: any[]) => {
              if (sql.includes('FROM stock_fundamentals')) {
                boundSymbolToFundamental = args[0];
              }
              if (sql.includes('FROM theme_sector_contexts t')) {
                boundSymbolToTheme = args[0];
              }
              return stmt;
            }),
            first: vi.fn().mockImplementation(async () => {
              if (sql.includes('FROM stock_fundamentals')) {
                return {
                  symbol: 'ARM',
                  business_model: 'Licensing and royalties',
                  moat: 'Ecosystem switching cost',
                  as_of_date: '2026-07-29',
                  source_count: 4
                };
              }
              return null;
            }),
            all: vi.fn().mockImplementation(async () => {
              if (sql.includes('FROM theme_sector_contexts t')) {
                return {
                  results: [
                    {
                      notebook_id: 'nb_1',
                      theme_name: 'Compute Architecture',
                      industry_dynamics: 'Shifting to RISC-V and ARM',
                      updated_at: '2026-08-01'
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

      const res = await fundamentals.request('/api/fundamentals?symbol=%20arm%20', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(200);

      expect(boundSymbolToFundamental).toBe('ARM');
      expect(boundSymbolToTheme).toBe('ARM');

      const body = (await res.json()) as any;
      expect(body.symbol).toBe('ARM');
      expect(body.fundamental.symbol).toBe('ARM');
      expect(body.fundamental.business_model).toBe('Licensing and royalties');
      expect(body.themes).toHaveLength(1);
      expect(body.themes[0].symbols).toEqual(['ARM']);
    });

    it('handles corrupt JSON in stock_fundamentals columns defensively', async () => {
      mockDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            symbol: 'CORRUPT_CO',
            business_model: null,
            moat: null,
            competitors: '{not valid json',
            guidance: '[1, 2, 3]', // invalid guidance format
            key_risks: 'not a json array',
            thesis_kpis: null,
            as_of_date: '2026-07-01',
            source_count: null,
            updated_at: null
          }),
          all: vi.fn().mockResolvedValue({ results: [] })
        }))
      };
      mockEnv = { DB: mockDb };

      const res = await fundamentals.request('/api/fundamentals?symbol=CORRUPT_CO', { method: 'GET' }, mockEnv);
      expect(res.status).toBe(200);

      const body = (await res.json()) as any;
      expect(body.symbol).toBe('CORRUPT_CO');
      expect(body.fundamental.competitors).toEqual([]);
      expect(body.fundamental.key_risks).toEqual([]);
      expect(body.fundamental.thesis_kpis).toEqual([]);
      expect(body.fundamental.business_model).toBe('');
      expect(body.fundamental.source_count).toBe(1); // default
    });
  });
});
