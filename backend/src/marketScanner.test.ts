import { vi, describe, it, expect, beforeEach } from 'vitest';
import { scanMarketBreakouts } from './marketScanner';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('scanMarketBreakouts', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('should scan watchlist scope (default) and filter using name in_range filter', async () => {
		// Mock watchlist DB query returning AAPL and TSLA
		const mockStmt = {
			bind: vi.fn().mockImplementation(() => mockStmt),
			all: vi.fn().mockResolvedValue({ results: [{ symbol: 'AAPL' }, { symbol: 'TSLA' }] }),
			first: vi.fn().mockResolvedValue(null),
			run: vi.fn().mockResolvedValue({ success: true })
		};

		const mockDb = {
			prepare: vi.fn().mockReturnValue(mockStmt),
			batch: vi.fn().mockResolvedValue([])
		};

		mockFetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({
				data: [
					{
						s: 'NASDAQ:AAPL',
						d: ['AAPL', 'Apple Inc.', 200, 1.5, 190, 120]
					},
					{
						s: 'NASDAQ:TSLA',
						d: ['TSLA', 'Tesla Inc.', 250, 0.5, 300, 200]
					}
				]
			})
		});

		const result = await scanMarketBreakouts(mockDb as any, 'dummy-api-key', 'watchlist');

		// AAPL (price 200 >= yearHigh 190) -> 52w_high
		// TSLA (price 250 is between 200 and 300) -> no breakout
		expect(result).toHaveLength(1);
		expect(result[0].symbol).toBe('AAPL');
		expect(result[0].breakoutType).toBe('52w_high');

		// Verify DB select watchlist query was executed
		expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT symbol FROM watchlist WHERE is_active = 1'));
		
		// Verify TradingView API was called with the symbols in filter
		expect(mockFetch).toHaveBeenCalled();
		const fetchArgs = mockFetch.mock.calls[0];
		expect(fetchArgs[0]).toContain('scanner.tradingview.com');
		const body = JSON.parse(fetchArgs[1].body);
		expect(body.filter[0]).toEqual({
			left: 'name',
			operation: 'in_range',
			right: ['AAPL', 'TSLA']
		});
	});

	it('should return empty list immediately when watchlist is empty', async () => {
		const mockStmt = {
			all: vi.fn().mockResolvedValue({ results: [] })
		};
		const mockDb = {
			prepare: vi.fn().mockReturnValue(mockStmt)
		};

		const result = await scanMarketBreakouts(mockDb as any, 'dummy-api-key', 'watchlist');
		expect(result).toEqual([]);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('should scan market scope using full market scan config', async () => {
		const mockStmt = {
			bind: vi.fn().mockImplementation(() => mockStmt),
			all: vi.fn().mockResolvedValue({ results: [{ symbol: 'AAPL' }] }), // watchlist for notifications
			first: vi.fn().mockResolvedValue(null),
			run: vi.fn().mockResolvedValue({ success: true })
		};

		const mockDb = {
			prepare: vi.fn().mockReturnValue(mockStmt),
			batch: vi.fn().mockResolvedValue([])
		};

		mockFetch.mockResolvedValue({
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
					}
				]
			})
		});

		const result = await scanMarketBreakouts(mockDb as any, 'dummy-api-key', 'market');

		expect(result).toHaveLength(2); // AAPL (52w_high) and MSFT (52w_low)
		
		// Verify TradingView API was called with full market scan config
		const fetchArgs = mockFetch.mock.calls[0];
		const body = JSON.parse(fetchArgs[1].body);
		expect(body.filter[0]).toEqual({
			left: 'type',
			operation: 'in_range',
			right: ['stock', 'dr']
		});
		expect(body.range).toEqual([0, 25000]);
	});
});
