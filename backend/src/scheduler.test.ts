import { describe, it, expect } from 'vitest';
import { getNearest15Minute, getNearestScheduledMinute, isDaytimeWindow, getScheduledWorkflowParams } from './scheduler';

describe('scheduler - getNearest15Minute', () => {
	it('should return exact 15-minute marks on the dot', () => {
		expect(getNearest15Minute(new Date('2026-08-14T12:00:00Z'))).toBe(0);
		expect(getNearest15Minute(new Date('2026-08-14T12:15:00Z'))).toBe(15);
		expect(getNearest15Minute(new Date('2026-08-14T12:30:00Z'))).toBe(30);
		expect(getNearest15Minute(new Date('2026-08-14T12:45:00Z'))).toBe(45);
	});

	it('should round jittered executions to the correct scheduled 15-minute interval', () => {
		// Minute 0 interval with drift / delay
		expect(getNearest15Minute(new Date('2026-08-14T12:01:07Z'))).toBe(0);
		expect(getNearest15Minute(new Date('2026-08-14T12:02:30Z'))).toBe(0);
		expect(getNearest15Minute(new Date('2026-08-14T11:59:50Z'))).toBe(0);

		// Minute 15 interval with drift / delay
		expect(getNearest15Minute(new Date('2026-08-14T12:16:02Z'))).toBe(15);
		expect(getNearest15Minute(new Date('2026-08-14T12:14:50Z'))).toBe(15);

		// Minute 30 interval with drift / delay
		expect(getNearest15Minute(new Date('2026-08-14T12:31:01Z'))).toBe(30);
		expect(getNearest15Minute(new Date('2026-08-14T12:29:45Z'))).toBe(30);

		// Minute 45 interval with drift / delay
		expect(getNearest15Minute(new Date('2026-08-14T12:46:02Z'))).toBe(45);
		expect(getNearest15Minute(new Date('2026-08-14T12:44:55Z'))).toBe(45);
	});
});

describe('scheduler - getNearestScheduledMinute', () => {
	it('should resolve exact staggered breakout intervals (:05, :20, :35, :50)', () => {
		expect(getNearestScheduledMinute(new Date('2026-08-14T12:05:00Z'))).toBe(5);
		expect(getNearestScheduledMinute(new Date('2026-08-14T12:20:00Z'))).toBe(20);
		expect(getNearestScheduledMinute(new Date('2026-08-14T12:35:00Z'))).toBe(35);
		expect(getNearestScheduledMinute(new Date('2026-08-14T12:50:00Z'))).toBe(50);
	});

	it('should handle slight jitter/drift around breakout minutes', () => {
		expect(getNearestScheduledMinute(new Date('2026-08-14T12:04:45Z'))).toBe(5);
		expect(getNearestScheduledMinute(new Date('2026-08-14T12:05:30Z'))).toBe(5);
		expect(getNearestScheduledMinute(new Date('2026-08-14T12:19:55Z'))).toBe(20);
		expect(getNearestScheduledMinute(new Date('2026-08-14T12:20:40Z'))).toBe(20);
		expect(getNearestScheduledMinute(new Date('2026-08-14T12:34:50Z'))).toBe(35);
		expect(getNearestScheduledMinute(new Date('2026-08-14T12:35:25Z'))).toBe(35);
		expect(getNearestScheduledMinute(new Date('2026-08-14T12:49:50Z'))).toBe(50);
		expect(getNearestScheduledMinute(new Date('2026-08-14T12:50:35Z'))).toBe(50);
	});

	it('should accurately resolve based on cron filter when provided', () => {
		const dateAround05 = new Date('2026-08-14T12:03:00Z');
		// When cron is explicitly the breakout schedule, should map to 5 even if slightly earlier
		expect(getNearestScheduledMinute(dateAround05, '5,20,35,50 * * * *')).toBe(5);

		// When cron is standard schedule, should map to 0
		expect(getNearestScheduledMinute(dateAround05, '0,15,30,45 * * * *')).toBe(0);
	});
});

describe('scheduler - isDaytimeWindow (08:00 - 18:00 Asia/Bangkok)', () => {
	it('should return true for times inside the daytime window', () => {
		// 01:00 UTC = 08:00 Bangkok (Start of window)
		expect(isDaytimeWindow(new Date('2026-08-14T01:00:00Z'))).toBe(true);
		// 05:30 UTC = 12:30 Bangkok (Midday)
		expect(isDaytimeWindow(new Date('2026-08-14T05:30:00Z'))).toBe(true);
		// 11:00 UTC = 18:00 Bangkok (End of window)
		expect(isDaytimeWindow(new Date('2026-08-14T11:00:00Z'))).toBe(true);
	});

	it('should return false for times outside the daytime window', () => {
		// 00:59 UTC = 07:59 Bangkok (1 min before window)
		expect(isDaytimeWindow(new Date('2026-08-14T00:59:00Z'))).toBe(false);
		// 11:01 UTC = 18:01 Bangkok (1 min after window)
		expect(isDaytimeWindow(new Date('2026-08-14T11:01:00Z'))).toBe(false);
		// 13:00 UTC = 20:00 Bangkok (Nighttime / US market)
		expect(isDaytimeWindow(new Date('2026-08-14T13:00:00Z'))).toBe(false);
		// 18:00 UTC = 01:00 Bangkok (Midnight)
		expect(isDaytimeWindow(new Date('2026-08-14T18:00:00Z'))).toBe(false);
	});
});

describe('scheduler - getScheduledWorkflowParams', () => {
	it('should schedule hourly tasks at minute 0 during daytime with email sync and digest enabled', () => {
		// 05:00 UTC = 12:00 Bangkok (Daytime)
		const scheduledTime = new Date('2026-08-14T05:00:00Z').getTime();
		const decision = getScheduledWorkflowParams({ scheduledTime });

		expect(decision.targetMinute).toBe(0);
		expect(decision.workflowId).toMatch(/^cron-hourly-\d+$/);
		expect(decision.params.fetchMarketStats).toBe(true);
		expect(decision.params.priceOnly).toBe(false);
		expect(decision.params.checkAlertRules).toBe(true);
		expect(decision.params.syncEmails).toBe(true);
		expect(decision.params.generateEmailDigests).toBe(true);
		expect(decision.params.runCrawler).toBe(false);
		expect(decision.params.generateDailySummaries).toBe(false);
		expect(decision.params.scanMarketBreakouts).toBe(false);
	});

	it('should schedule hourly tasks at minute 0 during nighttime with email sync enabled but digest disabled', () => {
		// 13:00 UTC = 20:00 Bangkok (Nighttime)
		const scheduledTime = new Date('2026-08-14T13:00:00Z').getTime();
		const decision = getScheduledWorkflowParams({ scheduledTime });

		expect(decision.targetMinute).toBe(0);
		expect(decision.workflowId).toMatch(/^cron-hourly-\d+$/);
		expect(decision.params.syncEmails).toBe(true);
		expect(decision.params.generateEmailDigests).toBe(false);
		expect(decision.params.runCrawler).toBe(false);
		expect(decision.params.generateDailySummaries).toBe(false);
		expect(decision.params.scanMarketBreakouts).toBe(false);
	});

	it('should schedule breakout scans at minutes :05, :20, :35, :50 with scanMarketBreakouts enabled only', () => {
		for (const minute of [5, 20, 35, 50]) {
			const scheduledTime = new Date(`2026-08-14T13:${minute.toString().padStart(2, '0')}:00Z`).getTime();
			const decision = getScheduledWorkflowParams({ scheduledTime, cron: '5,20,35,50 * * * *' });

			expect(decision.targetMinute).toBe(minute);
			expect(decision.workflowId).toMatch(/^cron-breakout-\d+$/);
			expect(decision.description).toBe(`${minute}-min Watchlist Breakouts Scanner`);
			expect(decision.params.scanMarketBreakouts).toBe(true);
			// Does NOT trigger regular price or metrics updates
			expect(decision.params.fetchMarketStats).toBeUndefined();
			expect(decision.params.syncEmails).toBeUndefined();
			expect(decision.params.syncFacebookPosts).toBeUndefined();
		}
	});

	it('should schedule 30-minute sync during daytime with price sync AND email digest enabled', () => {
		// 05:30 UTC = 12:30 Bangkok (Daytime)
		const time30Day = new Date('2026-08-14T05:30:00Z').getTime();
		const decision = getScheduledWorkflowParams({ scheduledTime: time30Day });

		expect(decision.targetMinute).toBe(30);
		expect(decision.workflowId).toMatch(/^cron-price-\d+$/);
		expect(decision.description).toBe('30-min price sync & daytime email digest');
		expect(decision.params.fetchMarketStats).toBe(true);
		expect(decision.params.priceOnly).toBe(true);
		expect(decision.params.generateEmailDigests).toBe(true);
		expect(decision.params.emailDigestsManual).toBe(false);
	});

	it('should schedule 30-minute sync during nighttime with price sync only (digest disabled)', () => {
		// 13:30 UTC = 20:30 Bangkok (Nighttime)
		const time30Night = new Date('2026-08-14T13:30:00Z').getTime();
		const decision = getScheduledWorkflowParams({ scheduledTime: time30Night });

		expect(decision.targetMinute).toBe(30);
		expect(decision.workflowId).toMatch(/^cron-price-\d+$/);
		expect(decision.description).toBe('30-min price sync');
		expect(decision.params.fetchMarketStats).toBe(true);
		expect(decision.params.priceOnly).toBe(true);
		expect(decision.params.generateEmailDigests).toBe(false);
	});

	it('should schedule 15-minute and 45-minute sync with price & Facebook enabled', () => {
		const time15 = new Date('2026-08-14T13:15:00Z').getTime();
		const decision15 = getScheduledWorkflowParams({ scheduledTime: time15 });
		expect(decision15.targetMinute).toBe(15);
		expect(decision15.workflowId).toMatch(/^cron-15m-\d+$/);
		expect(decision15.params.syncFacebookPosts).toBe(true);
		expect(decision15.params.fetchMarketStats).toBe(true);
		expect(decision15.params.priceOnly).toBe(true);

		const time45 = new Date('2026-08-14T13:45:00Z').getTime();
		const decision45 = getScheduledWorkflowParams({ scheduledTime: time45 });
		expect(decision45.targetMinute).toBe(45);
		expect(decision45.workflowId).toMatch(/^cron-15m-\d+$/);
		expect(decision45.params.syncFacebookPosts).toBe(true);
		expect(decision45.params.fetchMarketStats).toBe(true);
		expect(decision45.params.priceOnly).toBe(true);
	});

	it('should gracefully fallback to current time if event or event.scheduledTime is missing', () => {
		// 05:31 UTC = 12:31 Bangkok (Daytime :30 mark)
		const mockNow = new Date('2026-08-14T05:31:02Z');
		const decision = getScheduledWorkflowParams(null, mockNow);
		expect(decision.targetMinute).toBe(30);
		expect(decision.params.fetchMarketStats).toBe(true);
		expect(decision.params.priceOnly).toBe(true);
		expect(decision.params.generateEmailDigests).toBe(true);
	});
});
