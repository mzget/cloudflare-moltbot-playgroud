import { describe, it, expect, vi, beforeEach } from 'vitest';
import analysis from './analysis';

// Mock fetchFinancialOverview
vi.mock('../stockOverview', () => ({
  fetchFinancialOverview: vi.fn(),
}));

import { fetchFinancialOverview } from '../stockOverview';

describe('Analysis Routes Overview Endpoints', () => {
  let mockEnv: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockEnv = {
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      },
    };
  });

  describe('GET /api/analysis/overview', () => {
    it('returns 400 when symbol query parameter is missing', async () => {
      const res = await analysis.request('/api/analysis/overview', {}, mockEnv);
      expect(res.status).toBe(400);
      const json = await res.json() as any;
      expect(json.error).toBe('symbol parameter is required');
    });

    it('returns financial overview successfully with query parameter', async () => {
      const mockData = {
        symbol: 'META',
        name: 'Meta Platforms Inc',
        dcfScenarios: { bear: 369.43, base: 657.89, bull: 979.81, price: 642.62 },
      };
      (fetchFinancialOverview as any).mockResolvedValueOnce(mockData);

      const res = await analysis.request('/api/analysis/overview?symbol=META', {}, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(mockData);
      expect(fetchFinancialOverview).toHaveBeenCalledWith(mockEnv, 'META', false);
    });

    it('passes refresh flag when refresh=true', async () => {
      (fetchFinancialOverview as any).mockResolvedValueOnce({ symbol: 'META' });

      const res = await analysis.request('/api/analysis/overview?symbol=META&refresh=true', {}, mockEnv);
      expect(res.status).toBe(200);
      expect(fetchFinancialOverview).toHaveBeenCalledWith(mockEnv, 'META', true);
    });

    it('returns 500 when fetchFinancialOverview throws', async () => {
      (fetchFinancialOverview as any).mockRejectedValueOnce(new Error('Finnhub timeout'));

      const res = await analysis.request('/api/analysis/overview?symbol=META', {}, mockEnv);
      expect(res.status).toBe(500);
      const json = await res.json() as any;
      expect(json.error).toBe('Finnhub timeout');
    });
  });

  describe('GET /api/stocks/:symbol/overview (Alias route)', () => {
    it('returns financial overview successfully using route param', async () => {
      const mockData = {
        symbol: 'META',
        name: 'Meta Platforms Inc',
        dcfScenarios: { bear: 369.43, base: 657.89, bull: 979.81, price: 642.62 },
      };
      (fetchFinancialOverview as any).mockResolvedValueOnce(mockData);

      const res = await analysis.request('/api/stocks/META/overview', {}, mockEnv);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(mockData);
      expect(fetchFinancialOverview).toHaveBeenCalledWith(mockEnv, 'META', false);
    });

    it('supports refresh query parameter on alias route', async () => {
      (fetchFinancialOverview as any).mockResolvedValueOnce({ symbol: 'AAPL' });

      const res = await analysis.request('/api/stocks/AAPL/overview?refresh=true', {}, mockEnv);
      expect(res.status).toBe(200);
      expect(fetchFinancialOverview).toHaveBeenCalledWith(mockEnv, 'AAPL', true);
    });
  });
});
