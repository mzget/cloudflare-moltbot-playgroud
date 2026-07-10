import { vi, describe, it, expect } from 'vitest';
import { scanMarketBreakouts } from './marketScanner';

vi.mock('./fmpClient', () => {
	return {
		fetchExchangeQuotes: vi.fn().mockImplementation((apiKey, exchange) => {
			if (exchange === 'nasdaq') {
				return Promise.resolve([
					{
						symbol: 'AAPL',
						name: 'Apple Inc.',
						price: 200,
						changesPercentage: 1.5,
						yearHigh: 190,
						yearLow: 120
					},
					{
						symbol: 'MSFT',
						name: 'Microsoft Corp.',
						price: 100,
						changesPercentage: -2.0,
						yearHigh: 400,
						yearLow: 110
					},
					{
						symbol: 'TSLA',
						name: 'Tesla Inc.',
						price: 250,
						changesPercentage: 0.5,
						yearHigh: 300,
						yearLow: 200
					}
				]);
			}
			return Promise.resolve([]);
		})
	};
});

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

		expect(msft).toBeDefined();
		expect(msft!.breakoutType).toBe('52w_low');

		// Verify D1 operations were called
		expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM market_breakouts'));
		expect(mockDb.batch).toHaveBeenCalled();
	});
});
