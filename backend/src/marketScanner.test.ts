import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
	scanMarketBreakouts,
	getWatchlistBreakoutsData,
	classifyBreakoutStatus,
	calculateDistance
} from './marketScanner';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('marketScanner - Pure Functions', () => {
	describe('calculateDistance', () => {
		it('should calculate distance to high (negative when below high)', () => {
			// Price 95, High 100 -> -5.0%
			expect(calculateDistance(95, 100)).toBe(-5);
		});

		it('should calculate distance to high (positive when above high)', () => {
			// Price 105, High 100 -> +5.0%
			expect(calculateDistance(105, 100)).toBe(5);
		});

		it('should calculate distance to low (positive when above low)', () => {
			// Price 110, Low 100 -> +10.0%
			expect(calculateDistance(110, 100)).toBe(10);
		});

		it('should return null for invalid/null/zero targets', () => {
			expect(calculateDistance(100, null)).toBeNull();
			expect(calculateDistance(100, undefined)).toBeNull();
			expect(calculateDistance(100, 0)).toBeNull();
			expect(calculateDistance(0, 100)).toBeNull();
			expect(calculateDistance(-5, 100)).toBeNull();
		});
	});

	describe('classifyBreakoutStatus', () => {
		it('should prioritize ATH over 52W High (Exclusive Precedence)', () => {
			// Price 210 >= ATH 200 and >= 52W High 190 -> 'ath'
			const status = classifyBreakoutStatus(210, 190, 100, 200, 80);
			expect(status).toBe('ath');
		});

		it('should classify 52W High when price >= 52W High but below ATH', () => {
			// Price 195 >= 52W High 190, but < ATH 200 -> '52w_high'
			const status = classifyBreakoutStatus(195, 190, 100, 200, 80);
			expect(status).toBe('52w_high');
		});

		it('should prioritize ATL over 52W Low (Exclusive Precedence)', () => {
			// Price 75 <= ATL 80 and <= 52W Low 90 -> 'atl'
			const status = classifyBreakoutStatus(75, 190, 90, 200, 80);
			expect(status).toBe('atl');
		});

		it('should classify 52W Low when price <= 52W Low but above ATL', () => {
			// Price 85 <= 52W Low 90, but > ATL 80 -> '52w_low'
			const status = classifyBreakoutStatus(85, 190, 90, 200, 80);
			expect(status).toBe('52w_low');
		});

		it('should classify near_ath when within 3% buffer below ATH', () => {
			// ATH 100, 52W High 100, Price 98 (-2% away) -> 'near_ath'
			const status = classifyBreakoutStatus(98, 100, 50, 100, 40, 3.0);
			expect(status).toBe('near_ath');
		});

		it('should classify near_52w_high when within 3% buffer below 52W High (and not near ATH)', () => {
			// ATH 200, 52W High 100, Price 98 (-2% from 52W High, -51% from ATH) -> 'near_52w_high'
			const status = classifyBreakoutStatus(98, 100, 50, 200, 40, 3.0);
			expect(status).toBe('near_52w_high');
		});

		it('should classify near_atl when within 3% buffer above ATL', () => {
			// ATL 50, 52W Low 50, Price 51 (+2% away) -> 'near_atl'
			const status = classifyBreakoutStatus(51, 100, 50, 120, 50, 3.0);
			expect(status).toBe('near_atl');
		});

		it('should classify near_52w_low when within 3% buffer above 52W Low (and not near ATL)', () => {
			// ATL 20, 52W Low 50, Price 51 (+2% from 52W Low, +155% from ATL) -> 'near_52w_low'
			const status = classifyBreakoutStatus(51, 100, 50, 120, 20, 3.0);
			expect(status).toBe('near_52w_low');
		});

		it('should classify normal when price is safely within ranges', () => {
			// ATH 200, 52W High 180, 52W Low 120, ATL 80, Price 150 -> 'normal'
			const status = classifyBreakoutStatus(150, 180, 120, 200, 80, 3.0);
			expect(status).toBe('normal');
		});

		it('should return normal for null/zero prices or missing bounds', () => {
			expect(classifyBreakoutStatus(0, 100, 50, 120, 40)).toBe('normal');
			expect(classifyBreakoutStatus(100, null, null, null, null)).toBe('normal');
		});
	});
});

describe('scanMarketBreakouts', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('should scan watchlist scope, fetch TV data with High.All/Low.All, and detect ATH and 52W High', async () => {
		const mockStmt = {
			bind: vi.fn().mockImplementation(() => mockStmt),
			all: vi.fn().mockImplementation((query?: string) => {
				return Promise.resolve({
					results: [
						{ symbol: 'NVDA' },
						{ symbol: 'AAPL' },
						{ symbol: 'TSLA' }
					]
				});
			}),
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
						s: 'NASDAQ:NVDA',
						// NVDA: Price 140, 52W High 135, ATH 138 -> price >= ath -> 'ath'
						d: ['NVDA', 'NVIDIA Corp', 140, 3.5, 135, 70, 138, 30]
					},
					{
						s: 'NASDAQ:AAPL',
						// AAPL: Price 210, 52W High 205, ATH 230 -> price >= 52wHigh but < ath -> '52w_high'
						d: ['AAPL', 'Apple Inc.', 210, 1.2, 205, 160, 230, 80]
					},
					{
						s: 'NASDAQ:TSLA',
						// TSLA: Price 220, 52W High 260, 52W Low 140, ATH 400, ATL 10 -> 'normal'
						d: ['TSLA', 'Tesla Inc.', 220, -0.5, 260, 140, 400, 10]
					}
				]
			})
		});

		const result = await scanMarketBreakouts(mockDb as any, 'dummy-api-key', 'watchlist');

		expect(result).toHaveLength(2);
		expect(result[0].symbol).toBe('NVDA');
		expect(result[0].breakoutType).toBe('ath');
		expect(result[1].symbol).toBe('AAPL');
		expect(result[1].breakoutType).toBe('52w_high');

		// Verify TradingView payload requested High.All and Low.All
		expect(mockFetch).toHaveBeenCalled();
		const fetchArgs = mockFetch.mock.calls[0];
		const body = JSON.parse(fetchArgs[1].body);
		expect(body.columns).toContain('High.All');
		expect(body.columns).toContain('Low.All');
		expect(body.filter[0].right).toEqual(['NVDA', 'AAPL', 'TSLA']);
	});

	it('should return empty list immediately when watchlist is empty', async () => {
		const mockStmt = {
			first: vi.fn().mockResolvedValue(null),
			all: vi.fn().mockResolvedValue({ results: [] })
		};
		const mockDb = {
			prepare: vi.fn().mockReturnValue(mockStmt)
		};

		const result = await scanMarketBreakouts(mockDb as any, 'dummy-api-key', 'watchlist');
		expect(result).toEqual([]);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('should abort scanning early when pause_market_breakout_scan is set to 1', async () => {
		const mockStmt = {
			bind: vi.fn().mockImplementation(() => mockStmt),
			first: vi.fn().mockResolvedValue({ value: '1' })
		};

		const mockDb = {
			prepare: vi.fn().mockReturnValue(mockStmt)
		};

		const result = await scanMarketBreakouts(mockDb as any, 'dummy-api-key', 'watchlist');
		expect(result).toEqual([]);
		expect(mockFetch).not.toHaveBeenCalled();
	});
});

describe('getWatchlistBreakoutsData', () => {
	it('should build Proximity Matrix and Summary for all active watchlist symbols', async () => {
		const mockDb = {
			prepare: vi.fn().mockImplementation((query: string) => {
				let stmt: any;
				stmt = {
					bind: vi.fn().mockImplementation(() => stmt),
					all: vi.fn().mockImplementation(() => {
						if (query.includes('FROM watchlist')) {
							return Promise.resolve({
								results: [
									{
										symbol: 'NVDA',
										name: 'NVIDIA Corp',
										sector_label: 'AI & Chips',
										price: 140,
										percent_change: 3.5,
										fifty_two_week_high: 135,
										fifty_two_week_low: 70,
										all_time_high: 138,
										all_time_low: 30,
										updated_at: '2026-10-01'
									},
									{
										symbol: 'MSFT',
										name: 'Microsoft Corp',
										sector_label: 'Cloud',
										price: 395,
										percent_change: 0.5,
										fifty_two_week_high: 400, // Distance: -1.25% -> near_52w_high
										fifty_two_week_low: 300,
										all_time_high: 450,
										all_time_low: 50,
										updated_at: '2026-10-01'
									},
									{
										symbol: 'INTC',
										name: 'Intel Corp',
										sector_label: 'Semis',
										price: 19,
										percent_change: -4.0,
										fifty_two_week_high: 45,
										fifty_two_week_low: 20, // Distance: -5% -> below low -> 52w_low
										all_time_high: 75,
										all_time_low: 10,
										updated_at: '2026-10-01'
									}
								]
							});
						}
						if (query.includes('FROM market_breakouts')) {
							return Promise.resolve({
								results: [
									{
										symbol: 'NVDA',
										name: 'NVIDIA Corp',
										price: 140,
										percentChange: 3.5,
										yearHigh: 135,
										yearLow: 70,
										breakoutType: 'ath',
										allTimeHigh: 138,
										allTimeLow: 30
									}
								]
							});
						}
						return Promise.resolve({ results: [] });
					})
				};
				return stmt;
			})
		};

		const data = await getWatchlistBreakoutsData(mockDb as any);

		expect(data.todayBreakouts).toHaveLength(1);
		expect(data.todayBreakouts[0].symbol).toBe('NVDA');
		expect(data.todayBreakouts[0].breakoutType).toBe('ath');

		expect(data.matrix).toHaveLength(3);
		// NVDA: confirmed 'ath'
		const nvda = data.matrix.find(m => m.symbol === 'NVDA');
		expect(nvda?.status).toBe('ath');
		expect(nvda?.sectorLabel).toBe('AI & Chips');

		// MSFT: price 395 vs 52W High 400 -> near_52w_high
		const msft = data.matrix.find(m => m.symbol === 'MSFT');
		expect(msft?.status).toBe('near_52w_high');
		expect(msft?.distance52wHigh).toBe(-1.25);

		// INTC: price 19 vs 52W Low 20 -> 52w_low
		const intc = data.matrix.find(m => m.symbol === 'INTC');
		expect(intc?.status).toBe('52w_low');

		// Summary checks
		expect(data.summary.totalWatchlist).toBe(3);
		expect(data.summary.athCount).toBe(1);
		expect(data.summary.nearHigh52wCount).toBe(1);
		expect(data.summary.low52wCount).toBe(1);
	});
});
