import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import MarketBreakouts from './MarketBreakouts';

vi.mock('@tanstack/react-router', () => ({
	useNavigate: () => vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('MarketBreakouts Component', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockFetch.mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({
				summary: {
					totalWatchlist: 2,
					athCount: 1,
					high52wCount: 0,
					low52wCount: 0,
					atlCount: 0,
					nearAthCount: 0,
					nearHigh52wCount: 1,
					nearLow52wCount: 0,
					nearAtlCount: 0,
					totalBreakouts: 1,
					highsRatio: 100,
					lowsRatio: 0
				},
				todayBreakouts: [
					{
						symbol: 'NVDA',
						name: 'NVIDIA Corporation',
						price: 140,
						percentChange: 3.5,
						yearHigh: 135,
						yearLow: 70,
						allTimeHigh: 138,
						allTimeLow: 30,
						breakoutType: 'ath'
					}
				],
				matrix: [
					{
						symbol: 'NVDA',
						name: 'NVIDIA Corporation',
						sectorLabel: 'AI Chips',
						price: 140,
						percentChange: 3.5,
						yearHigh: 135,
						yearLow: 70,
						allTimeHigh: 138,
						allTimeLow: 30,
						distance52wHigh: 3.7,
						distanceAth: 1.45,
						distance52wLow: 100,
						distanceAtl: 366.67,
						status: 'ath'
					},
					{
						symbol: 'MSFT',
						name: 'Microsoft Corp',
						sectorLabel: 'Cloud',
						isActive: false,
						price: 395,
						percentChange: 0.5,
						yearHigh: 400,
						yearLow: 300,
						allTimeHigh: 450,
						allTimeLow: 50,
						distance52wHigh: -1.25,
						distanceAth: -12.22,
						distance52wLow: 31.67,
						distanceAtl: 690,
						status: 'near_52w_high'
					}
				]
			})
		});
	});

	it('should render Watchlist Breakouts title and Scan button', () => {
		const html = renderToString(<MarketBreakouts />);

		expect(html).toContain('Watchlist Breakouts');
		expect(html).toContain('Scan Watchlist');
		expect(html).toContain('All-Time High');
		expect(html).toContain('52-Week High');
		expect(html).toContain('52-Week Low');
		expect(html).toContain('All-Time Low');
		expect(html).toContain('Watchlist Proximity Matrix');
	});
});

