import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  WorkflowEntrypoint: class {},
  WorkflowStep: class {},
}));

import worker from './index';

describe('Analysis API - DCF Calculations', () => {
  let mockDb: any;
  let mockEnv: any;
  let executedSqls: string[];
  let boundParams: any[][];

  beforeEach(() => {
    vi.resetAllMocks();
    executedSqls = [];
    boundParams = [];

    mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        executedSqls.push(sql);
        let currentParams: any[] = [];
        const stmt = {
          bind: vi.fn().mockImplementation((...args: any[]) => {
            currentParams = args;
            boundParams.push(args);
            return stmt;
          }),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM dcf_calculations WHERE symbol = ?')) {
              return {
                results: [
                  {
                    id: 1,
                    symbol: 'NVDA',
                    scenario_name: 'Base Case',
                    base_revenue: 130.5,
                    implied_share_price: 142.5,
                    rationale: 'Solid AI growth',
                    source: 'gemini_spark',
                    created_at: '2026-10-08 23:00:00',
                  },
                ],
              };
            }
            return { results: [] };
          }),
          run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
        };
        return stmt;
      }),
    };

    mockEnv = {
      DB: mockDb,
      IS_LOCAL: 'true',
      JWT_SECRET: 'test-secret',
    };
  });

  describe('POST /api/analysis/dcf-save', () => {
    it('saves DCF calculation with rationale and source', async () => {
      const payload = {
        symbol: 'NVDA',
        scenarioName: 'Base Case',
        baseRevenue: 130.5,
        revenueGrowth: 35,
        baseGrossMargin: 58,
        grossMarginImprovement: 1,
        opexMargin: 0,
        taxRate: 21,
        fcfConversion: 80,
        wacc: 10.5,
        terminalGrowth: 3.0,
        sharesOutstanding: 24500,
        netCash: 28.5,
        exitMultiple: 25.0,
        targetShares: 24500,
        impliedSharePrice: 142.5,
        mode: 'detailed',
        yearlyGrowth: [35, 25, 20, 15, 12],
        yearlyOpMargin: [58, 59, 60, 60, 59],
        yearlyFcfConv: [80, 80, 82, 85, 85],
        rationale: 'Robust demand for Blackwell AI compute',
        source: 'gemini_spark',
      };

      const req = new Request('http://localhost/api/analysis/dcf-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);

      // Verify DELETE was called for overwrite
      expect(executedSqls[0]).toContain('DELETE FROM dcf_calculations WHERE symbol = ? AND scenario_name = ?');
      expect(boundParams[0]).toEqual(['NVDA', 'Base Case']);

      // Verify INSERT includes rationale and source
      expect(executedSqls[1]).toContain('INSERT INTO dcf_calculations');
      expect(executedSqls[1]).toContain('rationale, source');
      const insertParams = boundParams[1];
      expect(insertParams[insertParams.length - 2]).toBe('Robust demand for Blackwell AI compute');
      expect(insertParams[insertParams.length - 1]).toBe('gemini_spark');
    });

    it('defaults source to manual when omitted', async () => {
      const payload = {
        symbol: 'AAPL',
        baseRevenue: 390.0,
        revenueGrowth: 5,
        baseGrossMargin: 45,
        grossMarginImprovement: 0,
        opexMargin: 0,
        taxRate: 21,
        fcfConversion: 100,
        wacc: 8.5,
        terminalGrowth: 2.5,
        sharesOutstanding: 15000,
        impliedSharePrice: 240.0,
      };

      const req = new Request('http://localhost/api/analysis/dcf-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(200);

      const insertParams = boundParams[1];
      expect(insertParams[insertParams.length - 1]).toBe('manual');
    });

    it('returns 400 when symbol is missing', async () => {
      const req = new Request('http://localhost/api/analysis/dcf-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseRevenue: 100 }),
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error).toBe('symbol is required');
    });
  });

  describe('GET /api/analysis/dcf-history', () => {
    it('returns DCF history including rationale and source', async () => {
      const req = new Request('http://localhost/api/analysis/dcf-history?symbol=NVDA', {
        method: 'GET',
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(200);
      const data = await res.json() as any[];
      expect(data.length).toBe(1);
      expect(data[0].rationale).toBe('Solid AI growth');
      expect(data[0].source).toBe('gemini_spark');
    });

    it('returns 400 when symbol query param is missing', async () => {
      const req = new Request('http://localhost/api/analysis/dcf-history', {
        method: 'GET',
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(400);
    });
  });
});

