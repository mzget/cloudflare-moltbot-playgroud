import { describe, it, expect } from 'vitest';
import {
	isUSMarketOpen,
	parseDbTimestamp,
	prioritizeForPriceUpdate,
	prioritizeForMetricsUpdate,
	extractQuarterlyMetrics,
} from './marketData';

describe('isUSMarketOpen', () => {
	it('should accurately calculate market open status during EDT (Daylight Saving Time)', () => {
		// July 21, 2026 (Tuesday) - EDT is UTC-4
		const preMarket = new Date('2026-07-21T13:29:00Z'); // 9:29 AM ET
		const marketOpen = new Date('2026-07-21T13:30:00Z'); // 9:30 AM ET
		const marketClose = new Date('2026-07-21T20:00:00Z'); // 4:00 PM ET
		const postMarketGrace = new Date('2026-07-21T20:30:00Z'); // 4:30 PM ET
		const postMarketClosed = new Date('2026-07-21T20:31:00Z'); // 4:31 PM ET

		expect(isUSMarketOpen(preMarket)).toBe(false);
		expect(isUSMarketOpen(marketOpen)).toBe(true);
		expect(isUSMarketOpen(marketClose)).toBe(true);
		expect(isUSMarketOpen(postMarketGrace)).toBe(true);
		expect(isUSMarketOpen(postMarketClosed)).toBe(false);
	});

	it('should accurately calculate market open status during EST (Standard Time) including exact 16:00 ET close', () => {
		// January 15, 2026 (Thursday) - EST is UTC-5
		const preMarket = new Date('2026-01-15T14:29:00Z'); // 9:29 AM ET
		const marketOpen = new Date('2026-01-15T14:30:00Z'); // 9:30 AM ET
		const marketClose = new Date('2026-01-15T21:00:00Z'); // 4:00 PM ET (21:00 UTC)
		const postMarketGrace = new Date('2026-01-15T21:30:00Z'); // 4:30 PM ET (21:30 UTC)
		const postMarketClosed = new Date('2026-01-15T21:31:00Z'); // 4:31 PM ET

		expect(isUSMarketOpen(preMarket)).toBe(false);
		expect(isUSMarketOpen(marketOpen)).toBe(true);
		expect(isUSMarketOpen(marketClose)).toBe(true);
		expect(isUSMarketOpen(postMarketGrace)).toBe(true);
		expect(isUSMarketOpen(postMarketClosed)).toBe(false);
	});

	it('should return false on weekends regardless of time', () => {
		// July 25, 2026 (Saturday) - 2:00 PM ET (18:00 UTC)
		const saturdayMidday = new Date('2026-07-25T18:00:00Z');
		expect(isUSMarketOpen(saturdayMidday)).toBe(false);
	});
});

describe('parseDbTimestamp', () => {
	it('should handle falsy values gracefully', () => {
		expect(parseDbTimestamp(null)).toBe(0);
		expect(parseDbTimestamp(undefined)).toBe(0);
		expect(parseDbTimestamp('')).toBe(0);
	});

	it('should parse Unix epoch seconds and milliseconds', () => {
		const epochSec = 1770000000;
		expect(parseDbTimestamp(epochSec)).toBe(epochSec * 1000);

		const epochMs = 1770000000000;
		expect(parseDbTimestamp(epochMs)).toBe(epochMs);
	});

	it('should parse SQLite UTC datetime string YYYY-MM-DD HH:MM:SS', () => {
		const sqliteDate = '2026-08-14 10:00:00';
		const expected = Date.parse('2026-08-14T10:00:00Z');
		expect(parseDbTimestamp(sqliteDate)).toBe(expected);
	});

	it('should parse ISO 8601 string', () => {
		const isoDate = '2026-08-14T10:00:00.000Z';
		const expected = Date.parse(isoDate);
		expect(parseDbTimestamp(isoDate)).toBe(expected);
	});
});

describe('prioritizeForPriceUpdate', () => {
	it('should prioritize stocks with null price_updated_at first, then oldest price_updated_at', () => {
		const rows = [
			{ symbol: 'AAPL', price_updated_at: '2026-08-14 15:00:00' }, // newest
			{ symbol: 'TSLA', price_updated_at: null },                  // never updated (should be 1st or 2nd)
			{ symbol: 'MSFT', price_updated_at: '2026-08-14 10:00:00' }, // oldest date (after nulls)
			{ symbol: 'NVDA', price_updated_at: undefined },             // never updated
			{ symbol: 'GOOGL', price_updated_at: '2026-08-14 12:00:00' },// middle date
		];

		const sorted = prioritizeForPriceUpdate(rows);
		const symbols = sorted.map(r => r.symbol);

		// First two must be TSLA and NVDA (null/undefined)
		expect(symbols.slice(0, 2)).toEqual(expect.arrayContaining(['TSLA', 'NVDA']));
		// Next must be MSFT (10:00), then GOOGL (12:00), then AAPL (15:00)
		expect(symbols.slice(2)).toEqual(['MSFT', 'GOOGL', 'AAPL']);
	});

	it('should return a new array without mutating the original', () => {
		const rows = [
			{ symbol: 'AAPL', price_updated_at: '2026-08-14 15:00:00' },
			{ symbol: 'MSFT', price_updated_at: '2026-08-14 10:00:00' },
		];
		const originalOrder = [...rows];
		const sorted = prioritizeForPriceUpdate(rows);

		expect(sorted).not.toBe(rows);
		expect(rows).toEqual(originalOrder);
	});
});

describe('prioritizeForMetricsUpdate', () => {
	it('should prioritize stocks with missing stats first, then oldest updated_at', () => {
		const rows = [
			{ symbol: 'AAPL', updated_at: '2026-08-14 15:00:00', market_cap: 3000000000000 },
			{ symbol: 'NEW_STOCK', updated_at: null, market_cap: null },
			{ symbol: 'MSFT', updated_at: '2026-08-14 08:00:00', market_cap: 2500000000000 },
			{ symbol: 'NO_MC', updated_at: '2026-08-14 07:00:00', market_cap: null },
		];

		const sorted = prioritizeForMetricsUpdate(rows);
		const symbols = sorted.map(r => r.symbol);

		// NEW_STOCK and NO_MC have missing stats, should be prioritized first
		expect(symbols.slice(0, 2)).toEqual(expect.arrayContaining(['NEW_STOCK', 'NO_MC']));
		// Then MSFT (08:00:00), then AAPL (15:00:00)
		expect(symbols.slice(2)).toEqual(['MSFT', 'AAPL']);
	});
});

describe('extractQuarterlyMetrics', () => {
	it('should return nulls when input is null, undefined, or empty object', () => {
		expect(extractQuarterlyMetrics(null)).toEqual({
			gross_margin_quarterly: null,
			revenue_growth_quarterly_yoy: null,
			ebit_margin_quarterly: null,
		});

		expect(extractQuarterlyMetrics(undefined)).toEqual({
			gross_margin_quarterly: null,
			revenue_growth_quarterly_yoy: null,
			ebit_margin_quarterly: null,
		});

		expect(extractQuarterlyMetrics({})).toEqual({
			gross_margin_quarterly: null,
			revenue_growth_quarterly_yoy: null,
			ebit_margin_quarterly: null,
		});
	});

	it('should extract quarterly metrics from series.quarterly and metric', () => {
		const finnhubData = {
			metric: {
				revenueGrowthQuarterlyYoy: 34.32,
			},
			series: {
				quarterly: {
					grossMargin: [
						{ period: '2026-03-31', v: 0.4877 },
						{ period: '2025-12-31', v: 0.4611 },
					],
					operatingMargin: [
						{ period: '2026-03-31', v: 0.1205 },
						{ period: '2025-12-31', v: 0.1718 },
					],
				},
			},
		};

		const result = extractQuarterlyMetrics(finnhubData);
		expect(result.gross_margin_quarterly).toBeCloseTo(0.4877);
		expect(result.revenue_growth_quarterly_yoy).toBeCloseTo(0.3432);
		expect(result.ebit_margin_quarterly).toBeCloseTo(0.1205);
	});

	it('should normalize percentage numbers (>1 or <-1) to decimals', () => {
		const finnhubData = {
			metric: {
				revenueGrowthQuarterlyYoy: -15.5,
			},
			series: {
				quarterly: {
					grossMargin: [
						{ period: '2026-03-31', v: 48.77 },
					],
					operatingMargin: [
						{ period: '2026-03-31', v: -12.05 },
					],
				},
			},
		};

		const result = extractQuarterlyMetrics(finnhubData);
		expect(result.gross_margin_quarterly).toBeCloseTo(0.4877);
		expect(result.revenue_growth_quarterly_yoy).toBeCloseTo(-0.155);
		expect(result.ebit_margin_quarterly).toBeCloseTo(-0.1205);
	});

	it('should fallback to metric object if series.quarterly is empty or missing', () => {
		const finnhubData = {
			metric: {
				grossMarginQuarterly: 42.5,
				operatingMarginQuarterly: 18.2,
				revenueGrowthQuarterlyYoy: 25.0,
			},
			series: {
				quarterly: {
					grossMargin: [],
					operatingMargin: [],
				},
			},
		};

		const result = extractQuarterlyMetrics(finnhubData);
		expect(result.gross_margin_quarterly).toBeCloseTo(0.425);
		expect(result.revenue_growth_quarterly_yoy).toBeCloseTo(0.25);
		expect(result.ebit_margin_quarterly).toBeCloseTo(0.182);
	});
});


