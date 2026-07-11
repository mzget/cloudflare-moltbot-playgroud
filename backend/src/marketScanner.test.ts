import { vi, describe, it, expect } from 'vitest';
import { scanMarketBreakouts } from './marketScanner';

const mockFetch = vi.fn().mockImplementation((url) => {
	if (url.includes('scanner.tradingview.com')) {
		return Promise.resolve({
			ok: true,
			json: () => Promise.resolve({
				data: [
					{
						s: 'NASDAQ:AAPL',
						d: ['AAPL', 'Apple Inc.', 200, 1.5, 190, 120]
					},
					{
						s: 'NASDAQ:MSFT',
						d: ['MSFT', 'Microsoft Corporation', 100, -2.0, 400, 110]
					},
					{
						s: 'NASDAQ:TSLA',
						d: ['TSLA', 'Tesla Inc.', 250, 0.5, 300, 200]
					}
				]
			})
		});
	}
	return Promise.reject(new Error('Unknown fetch URL'));
});

vi.stubGlobal('fetch', mockFetch);

describe('scanMarketBreakouts', () => {
	it('should correctly identify 52w highs and 52w lows', async () => {
		const mockStmt = {
			bind: vi.fn().mockImplementation(() => mockStmt),
			all: vi.fn().mockResolvedValue({ results: [{ symbol: 'AAPL' }] }),
			first: vi.fn().mockResolvedValue(null),
			run: vi.fn().mockResolvedValue({ success: true })
		};

		const mockDb = {
			prepare: vi.fn().mockReturnValue(mockStmt),
			batch: vi.fn().mockResolvedValue([])
		};

		const result = await scanMarketBreakouts(mockDb as any, 'dummy-api-key');

		// AAPL (price 200 >= yearHigh 190) -> 52w_high
		// MSFT (price 100 <= yearLow 110) -> 52w_low
		// TSLA (price 250 is between 200 and 300) -> no breakout
		expect(result).toHaveLength(2);

		const aapl = result.find(r => r.symbol === 'AAPL');
		const msft = result.find(r => r.symbol === 'MSFT');

		expect(aapl).toBeDefined();
		expect(aapl!.breakoutType).toBe('52w_high');
		expect(aapl!.name).toBe('Apple Inc.');

		expect(msft).toBeDefined();
		expect(msft!.breakoutType).toBe('52w_low');
		expect(msft!.name).toBe('Microsoft Corporation');

		// Verify D1 operations were called
		expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM market_breakouts'));
		expect(mockDb.batch).toHaveBeenCalled();
	});
});
