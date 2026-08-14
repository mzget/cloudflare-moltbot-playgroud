import { describe, it, expect } from 'vitest';
import { getNearest15Minute, getScheduledWorkflowParams } from './scheduler';

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

describe('scheduler - getScheduledWorkflowParams', () => {
	it('should schedule hourly tasks at minute 0 (using event.scheduledTime)', () => {
		const scheduledTime = new Date('2026-08-14T13:00:00Z').getTime();
		const decision = getScheduledWorkflowParams({ scheduledTime });

		expect(decision.targetMinute).toBe(0);
		expect(decision.workflowId).toMatch(/^cron-hourly-\d+$/);
		expect(decision.params.fetchMarketStats).toBe(true);
		expect(decision.params.priceOnly).toBe(false);
		expect(decision.params.checkAlertRules).toBe(true);
		expect(decision.params.syncEmails).toBe(true);
		expect(decision.params.generateEmailDigests).toBe(true);
		// 13:00 is not six-hourly (13 % 6 !== 0)
		expect(decision.params.runCrawler).toBe(false);
		expect(decision.params.fetchMarketEvents).toBe(false);
	});

	it('should enable six-hourly tasks when hour % 6 === 0 at minute 0', () => {
		const scheduledTime = new Date('2026-08-14T12:00:00Z').getTime(); // 12 % 6 === 0
		const decision = getScheduledWorkflowParams({ scheduledTime });

		expect(decision.targetMinute).toBe(0);
		expect(decision.params.runCrawler).toBe(true);
		expect(decision.params.generateDailySummaries).toBe(true);
		expect(decision.params.fetchMarketEvents).toBe(true);
		expect(decision.params.purgeOldData).toBe(true);
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

	it('should schedule 30-minute price sync at minute 30', () => {
		const time30 = new Date('2026-08-14T13:30:00Z').getTime();
		const decision30 = getScheduledWorkflowParams({ scheduledTime: time30 });
		expect(decision30.targetMinute).toBe(30);
		expect(decision30.workflowId).toMatch(/^cron-price-\d+$/);
		expect(decision30.params.fetchMarketStats).toBe(true);
		expect(decision30.params.priceOnly).toBe(true);
		expect(decision30.params.syncFacebookPosts).toBeUndefined();
	});

	it('should gracefully fallback to current time if event or event.scheduledTime is missing', () => {
		const mockNow = new Date('2026-08-14T13:31:02Z'); // delayed execution of :30
		const decision = getScheduledWorkflowParams(null, mockNow);
		expect(decision.targetMinute).toBe(30);
		expect(decision.params.fetchMarketStats).toBe(true);
		expect(decision.params.priceOnly).toBe(true);
	});
});
