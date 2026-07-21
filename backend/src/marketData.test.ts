import { describe, it, expect } from 'vitest';
import { isUSMarketOpen } from './marketData';

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
