import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('cloudflare:workers', () => ({
  WorkflowEntrypoint: class {},
  WorkflowStep: class {},
}));

import worker from './index';

describe('Content API - Daily Reports', () => {
  let mockDb: any;
  let mockEnv: any;

  beforeEach(() => {
    vi.resetAllMocks();

    mockDb = {
      prepare: vi.fn().mockImplementation((sql: string) => {
        const stmt = {
          bind: vi.fn().mockImplementation((...args: any[]) => stmt),
          all: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM (SELECT DISTINCT symbol FROM daily_reports)')) {
              return {
                results: [
                  {
                    id: 1,
                    symbol: 'AAPL',
                    source_type: 'daily_report',
                    summary: 'Apple report summary',
                    sentiment_score: 0.8,
                    is_readed: 0,
                    created_at: '2026-10-01 12:00:00',
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

  describe('GET /api/reports', () => {
    it('returns daily reports with source_type = daily_report', async () => {
      const req = new Request('http://localhost/api/reports', {
        method: 'GET',
      });

      const res = await worker.fetch(req, mockEnv, {} as any);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any[];
      expect(data).toHaveLength(1);
      expect(data[0].symbol).toBe('AAPL');
      expect(data[0].source_type).toBe('daily_report');
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining("'daily_report' as source_type")
      );
    });
  });
});

