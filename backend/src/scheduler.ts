import { OaktreeWorkflowParams } from './workflow';

export interface ScheduledTaskDecision {
	workflowId: string;
	params: OaktreeWorkflowParams;
	targetMinute: number;
	description: string;
}

/**
 * Maps a given date/time to the nearest 15-minute interval (0, 15, 30, or 45).
 * Kept for backwards compatibility.
 */
export function getNearest15Minute(targetDate: Date): number {
	const rawMinute = targetDate.getUTCMinutes();
	const rawSecond = targetDate.getUTCSeconds();
	const totalMinutes = rawMinute + rawSecond / 60;
	return (Math.round(totalMinutes / 15) * 15) % 60;
}

/**
 * Maps a given date/time (and optional cron trigger string) to the nearest scheduled target minute:
 * - Market data & regular sync crons ("0,15,30,45 * * * *"): target minutes 0, 15, 30, 45.
 * - Watchlist breakout scanner crons ("5,20,35,50 * * * *"): target minutes 5, 20, 35, 50.
 * If cron is omitted or unrecognized, it maps to the closest of all 8 target slots.
 */
export function getNearestScheduledMinute(targetDate: Date, cron?: string): number {
	const rawMinute = targetDate.getUTCMinutes();
	const rawSecond = targetDate.getUTCSeconds();
	const totalMinutes = rawMinute + rawSecond / 60;

	let targets = [0, 5, 15, 20, 30, 35, 45, 50];
	if (cron && cron.includes('5,20,35,50')) {
		targets = [5, 20, 35, 50];
	} else if (cron && (cron.includes('0,15,30,45') || cron.includes('*/15'))) {
		targets = [0, 15, 30, 45];
	}

	let bestTarget = targets[0];
	let minDistance = 60;

	for (const t of targets) {
		const diff = Math.abs(totalMinutes - t) % 60;
		const distance = diff > 30 ? 60 - diff : diff;
		if (distance < minDistance) {
			minDistance = distance;
			bestTarget = t;
		}
	}

	return bestTarget;
}

/**
 * Returns true if the target date falls within the daytime window (08:00 - 18:00 Asia/Bangkok time).
 * 08:00 (480 mins) to 18:00 (1080 mins) inclusive.
 */
export function isDaytimeWindow(targetDate: Date = new Date()): boolean {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: 'Asia/Bangkok',
		hour12: false,
		hour: 'numeric',
		minute: 'numeric',
	});
	const parts = formatter.formatToParts(targetDate);
	let hour = 0;
	let minute = 0;
	for (const p of parts) {
		if (p.type === 'hour') hour = parseInt(p.value, 10) % 24;
		if (p.type === 'minute') minute = parseInt(p.value, 10);
	}
	const bkkMinutes = hour * 60 + minute;
	return bkkMinutes >= 8 * 60 && bkkMinutes <= 18 * 60;
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

	const targetMinute = getNearestScheduledMinute(scheduledDate, event?.cron);
	const hour = scheduledDate.getUTCHours();
	const isSixHourly = hour % 6 === 0;
	const isDaytime = isDaytimeWindow(scheduledDate);
	const timestamp = Date.now();

	// Watchlist Breakout Scanner: runs staggered every 15 minutes at minutes :05, :20, :35, :50
	if (targetMinute === 5 || targetMinute === 20 || targetMinute === 35 || targetMinute === 50) {
		return {
			workflowId: `cron-breakout-${timestamp}`,
			targetMinute,
			description: `${targetMinute}-min Watchlist Breakouts Scanner`,
			params: {
				scanMarketBreakouts: true,
			}
		};
	}

	if (targetMinute === 0) {
		return {
			workflowId: `cron-hourly-${timestamp}`,
			targetMinute: 0,
			description: 'Hourly Sync Tasks',
			params: {
				fetchMarketStats: true, // Fetch prices (when open) or metrics (when closed)
				priceOnly: false,       // Allows rolling metrics sync during off-hours
				checkAlertRules: true,
				syncEmails: true,       // 24/7 hourly email ingestion
				generateEmailDigests: isDaytime, // Daytime only (08:00 - 18:00 Asia/Bangkok)
				emailDigestsManual: false,
				runCrawler: false,
				generateDailySummaries: false,
				scanMarketBreakouts: false, // Handled separately at :05, :20, :35, :50
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
		description: isDaytime ? '30-min price sync & daytime email digest' : '30-min price sync',
		params: {
			fetchMarketStats: true,
			priceOnly: true,
			generateEmailDigests: isDaytime,
			emailDigestsManual: false,
		}
	};
}
