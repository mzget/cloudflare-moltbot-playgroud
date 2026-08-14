import { OaktreeWorkflowParams } from './workflow';

export interface ScheduledTaskDecision {
	workflowId: string;
	params: OaktreeWorkflowParams;
	targetMinute: number;
	description: string;
}

/**
 * Maps a given date/time to the nearest 15-minute interval (0, 15, 30, or 45).
 * This eliminates issues caused by execution jitter or minute drifts (e.g. executing at :01, :16, :31, :46).
 */
export function getNearest15Minute(targetDate: Date): number {
	const rawMinute = targetDate.getUTCMinutes();
	const rawSecond = targetDate.getUTCSeconds();
	const totalMinutes = rawMinute + rawSecond / 60;
	return (Math.round(totalMinutes / 15) * 15) % 60;
}

/**
 * Decides the workflow parameters to execute based on the scheduled event time.
 */
export function getScheduledWorkflowParams(
	event?: { scheduledTime?: number; cron?: string } | null,
	fallbackNow: Date = new Date()
): ScheduledTaskDecision {
	const scheduledDate = (event && typeof event.scheduledTime === 'number' && event.scheduledTime > 0)
		? new Date(event.scheduledTime)
		: fallbackNow;

	const targetMinute = getNearest15Minute(scheduledDate);
	const hour = scheduledDate.getUTCHours();
	const isSixHourly = hour % 6 === 0;
	const timestamp = Date.now();

	if (targetMinute === 0) {
		return {
			workflowId: `cron-hourly-${timestamp}`,
			targetMinute: 0,
			description: 'Hourly Sync Tasks',
			params: {
				fetchMarketStats: true, // Fetch prices (when open) or metrics (when closed)
				priceOnly: false,       // Allows rolling metrics sync during off-hours
				checkAlertRules: true,
				syncEmails: true,
				generateEmailDigests: true,
				emailDigestsManual: false,
				runCrawler: isSixHourly,
				generateDailySummaries: isSixHourly,
				scanMarketBreakouts: true,
				fetchMarketEvents: isSixHourly,
				sendDailyEmailReport: false,
				purgeOldData: isSixHourly,
				syncFacebookPosts: false,
			}
		};
	}

	if (targetMinute === 15 || targetMinute === 45) {
		return {
			workflowId: `cron-15m-${timestamp}`,
			targetMinute,
			description: `15/45-min sync (Facebook & price)`,
			params: {
				syncFacebookPosts: true,
				fetchMarketStats: true,
				priceOnly: true,
			}
		};
	}

	// targetMinute === 30
	return {
		workflowId: `cron-price-${timestamp}`,
		targetMinute: 30,
		description: '30-min price sync',
		params: {
			fetchMarketStats: true,
			priceOnly: true,
		}
	};
}
