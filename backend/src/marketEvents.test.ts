import { vi, describe, it, expect, beforeEach } from 'vitest';
import { generateTodayMarketEventNotifications } from './marketEvents';

describe('generateTodayMarketEventNotifications', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('should create in-app notifications for today market events of active watchlist stocks', async () => {
		const todayStr = new Date().toISOString().split('T')[0];

		const mockDb = {
			prepare: vi.fn().mockImplementation((sql: string) => {
				const stmt = {
					bind: vi.fn().mockImplementation(() => stmt),
					run: vi.fn().mockResolvedValue({ success: true }),
					all: vi.fn().mockImplementation(async () => {
						if (sql.includes('FROM market_events e')) {
							return {
								results: [
									{
										id: `earnings-AAPL-${todayStr}`,
										symbol: 'AAPL',
										event_type: 'earnings',
										event_date: todayStr,
										title: 'AAPL Q3 2026 Earnings Release',
										description: 'EPS Est: $1.35, Rev Est: $85B',
										metadata: '{}'
									}
								]
							};
						}
						if (sql.includes('FROM in_app_notifications')) {
							return { results: [] };
						}
						return { results: [] };
					})
				};
				return stmt;
			}),
			batch: vi.fn().mockResolvedValue([])
		};

		const env = { DB: mockDb as any };
		const result = await generateTodayMarketEventNotifications(env as any);

		expect(result.count).toBe(1);
		expect(mockDb.batch).toHaveBeenCalledTimes(1);
	});

	it('should deduplicate and skip generating notifications if notification already exists', async () => {
		const todayStr = new Date().toISOString().split('T')[0];

		const mockDb = {
			prepare: vi.fn().mockImplementation((sql: string) => {
				const stmt = {
					bind: vi.fn().mockImplementation(() => stmt),
					run: vi.fn().mockResolvedValue({ success: true }),
					all: vi.fn().mockImplementation(async () => {
						if (sql.includes('FROM market_events e')) {
							return {
								results: [
									{
										id: `earnings-AAPL-${todayStr}`,
										symbol: 'AAPL',
										event_type: 'earnings',
										event_date: todayStr,
										title: 'AAPL Q3 2026 Earnings Release',
										description: 'EPS Est: $1.35',
										metadata: '{}'
									}
								]
							};
						}
						if (sql.includes('FROM in_app_notifications')) {
							return {
								results: [
									{ symbol: 'AAPL', condition_type: 'earnings' }
								]
							};
						}
						return { results: [] };
					})
				};
				return stmt;
			}),
			batch: vi.fn().mockResolvedValue([])
		};

		const env = { DB: mockDb as any };
		const result = await generateTodayMarketEventNotifications(env as any);

		expect(result.count).toBe(0);
		expect(mockDb.batch).not.toHaveBeenCalled();
	});
});
