import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { Env } from './index';
import { runCrawler } from './crawler';
import { generateDailySummary } from './summarizer';
import { sendDailyEmailReport } from './email';
import { fetchAndStoreMarketStats } from './marketData';
import { fetchAndStoreMarketEvents } from './marketEvents';
import { checkAlertRules } from './alerts';
import { syncAndIngestEmails, generateEmailDigests } from './emailSummarizer';
import { syncAndProcessFacebookPosts } from './facebook';
import { recordDailyPortfolioHistory } from './portfolioHistory';
import { syncNotebookArticles } from './notebookSync';


export interface OaktreeWorkflowParams {
	fetchMarketStats?: boolean;
	checkAlertRules?: boolean;
	syncEmails?: boolean;
	generateEmailDigests?: boolean;
	emailDigestsManual?: boolean;
	runCrawler?: boolean;
	generateDailySummaries?: boolean;
	generateDailySummariesForce?: boolean;
	fetchMarketEvents?: boolean;
	sendDailyEmailReport?: boolean;
	purgeOldData?: boolean;
	syncFacebookPosts?: boolean;
	syncNotebookArticles?: boolean;
	priceOnly?: boolean;
	metricsOnly?: boolean;
	scanMarketBreakouts?: boolean;
}

// Fail fast: 2 retries with 5s linear backoff instead of the default 5 retries / 10s exponential.
// This prevents ~40s of wasted wall-time on transient API failures.
const STEP_CONFIG = {
	retries: { limit: 2, delay: '5 seconds' as const, backoff: 'linear' as const },
	timeout: '5 minutes' as const,
};

export class OaktreeSyncWorkflow extends WorkflowEntrypoint<Env, OaktreeWorkflowParams> {
	async run(event: WorkflowEvent<OaktreeWorkflowParams>, step: WorkflowStep) {
		const params = event.payload;
		const errors: string[] = [];

		if (params.fetchMarketStats) {
			try {
				await step.do('fetch-market-stats', STEP_CONFIG, async () => {
					console.log('[Workflow] Starting step: fetch-market-stats');
					const statsResult = await fetchAndStoreMarketStats(this.env, {
						priceOnly: params.priceOnly,
						metricsOnly: params.metricsOnly
					});
					if (!params.priceOnly && !params.metricsOnly) {
						await recordDailyPortfolioHistory(this.env.DB);
					}
					return statsResult || [];
				});
			} catch (e) {
				const msg = `fetch-market-stats failed: ${(e as Error).message || e}`;
				console.error(`[Workflow] ${msg}`);
				errors.push(msg);
			}
		}

		if (params.checkAlertRules) {
			try {
				await step.do('check-alert-rules', STEP_CONFIG, async () => {
					console.log('[Workflow] Starting step: check-alert-rules');
					const res = await checkAlertRules(this.env);
					return { triggeredCount: res.triggeredCount, errors: res.errors || [] };
				});
			} catch (e) {
				const msg = `check-alert-rules failed: ${(e as Error).message || e}`;
				console.error(`[Workflow] ${msg}`);
				errors.push(msg);
			}
		}

		if (params.syncEmails) {
			try {
				await step.do('sync-emails', STEP_CONFIG, async () => {
					console.log('[Workflow] Starting step: sync-emails');
					const count = await syncAndIngestEmails(this.env);
					return { count: count || 0 };
				});
			} catch (e) {
				const msg = `sync-emails failed: ${(e as Error).message || e}`;
				console.error(`[Workflow] ${msg}`);
				errors.push(msg);
			}
		}

		if (params.generateEmailDigests) {
			try {
				await step.do('generate-email-digests', STEP_CONFIG, async () => {
					console.log('[Workflow] Starting step: generate-email-digests');
					const isManual = !!params.emailDigestsManual;
					await generateEmailDigests(this.env, isManual);
					return { status: "completed" };
				});
			} catch (e) {
				const msg = `generate-email-digests failed: ${(e as Error).message || e}`;
				console.error(`[Workflow] ${msg}`);
				errors.push(msg);
			}
		}

		if (params.runCrawler) {
			try {
				await step.do('run-crawler', STEP_CONFIG, async () => {
					console.log('[Workflow] Starting step: run-crawler');
					await runCrawler(this.env);
					return { status: "completed" };
				});
			} catch (e) {
				const msg = `run-crawler failed: ${(e as Error).message || e}`;
				console.error(`[Workflow] ${msg}`);
				errors.push(msg);
			}
		}

		if (params.generateDailySummaries) {
			try {
				await step.do('generate-daily-summaries', STEP_CONFIG, async () => {
					console.log('[Workflow] Starting step: generate-daily-summaries');
					const { results } = await this.env.DB.prepare('SELECT symbol FROM watchlist WHERE is_active = 1').all();
					const force = !!params.generateDailySummariesForce;
					const summaryPromises = (results || []).map(row =>
						generateDailySummary(this.env, row.symbol as string, force)
							.catch(e => console.error(`Workflow summary failed for ${row.symbol}:`, e))
					);
					await Promise.all(summaryPromises);
					return { count: (results || []).length };
				});
			} catch (e) {
				const msg = `generate-daily-summaries failed: ${(e as Error).message || e}`;
				console.error(`[Workflow] ${msg}`);
				errors.push(msg);
			}
		}

		if (params.fetchMarketEvents) {
			try {
				await step.do('fetch-market-events', STEP_CONFIG, async () => {
					console.log('[Workflow] Starting step: fetch-market-events');
					await fetchAndStoreMarketEvents(this.env);
					return { status: "completed" };
				});
			} catch (e) {
				const msg = `fetch-market-events failed: ${(e as Error).message || e}`;
				console.error(`[Workflow] ${msg}`);
				errors.push(msg);
			}
		}

		if (params.sendDailyEmailReport) {
			try {
				await step.do('send-daily-email-report', STEP_CONFIG, async () => {
					console.log('[Workflow] Starting step: send-daily-email-report');
					console.log("sendDailyEmailReport is disabled for this phase.");
					return { status: "disabled", message: "sendDailyEmailReport is disabled for this phase." };
				});
			} catch (e) {
				const msg = `send-daily-email-report failed: ${(e as Error).message || e}`;
				console.error(`[Workflow] ${msg}`);
				errors.push(msg);
			}
		}

		if (params.purgeOldData) {
			try {
				await step.do('purge-old-data', STEP_CONFIG, async () => {
					console.log('[Workflow] Starting step: purge-old-data');
					const r1 = await this.env.DB.prepare("DELETE FROM daily_reports WHERE created_at < datetime('now', '-3 days')").run()
						.catch(e => { console.error("Failed to purge daily reports:", e); });
					const r2 = await this.env.DB.prepare("DELETE FROM market_events WHERE created_at < strftime('%s', 'now', '-30 days')").run()
						.catch(e => { console.error("Failed to purge market events:", e); });
					const r3 = await this.env.DB.prepare("DELETE FROM news WHERE created_at < datetime('now', '-3 days')").run()
						.catch(e => { console.error("Failed to purge news:", e); });
					return { reportsPurged: !!r1, eventsPurged: !!r2, newsPurged: !!r3 };
				});
			} catch (e) {
				const msg = `purge-old-data failed: ${(e as Error).message || e}`;
				console.error(`[Workflow] ${msg}`);
				errors.push(msg);
			}
		}

		if (params.syncNotebookArticles) {
			try {
				await step.do('sync-notebook-articles', STEP_CONFIG, async () => {
					console.log('[Workflow] Starting step: sync-notebook-articles');
					const count = await syncNotebookArticles(this.env);
					return { count: count || 0 };
				});
			} catch (e) {
				const msg = `sync-notebook-articles failed: ${(e as Error).message || e}`;
				console.error(`[Workflow] ${msg}`);
				errors.push(msg);
			}
		}

		if (params.scanMarketBreakouts) {
			try {
				await step.do('scan-market-breakouts', STEP_CONFIG, async () => {
					console.log('[Workflow] Starting step: scan-market-breakouts');
					const fmpKey = this.env.FMP_API_KEY;
					if (!fmpKey) {
						console.error("FMP_API_KEY is not configured.");
						return { count: 0, error: "FMP_API_KEY is not configured" };
					}
					const { scanMarketBreakouts } = await import('./marketScanner');
					const breakouts = await scanMarketBreakouts(this.env.DB, fmpKey, 'watchlist');
					return { count: (breakouts || []).length };
				});
			} catch (e) {
				const msg = `scan-market-breakouts failed: ${(e as Error).message || e}`;
				console.error(`[Workflow] ${msg}`);
				errors.push(msg);
			}
		}

		if (params.syncFacebookPosts) {
			try {
				await step.do('sync-facebook-posts', STEP_CONFIG, async () => {
					console.log('[Workflow] Starting step: sync-facebook-posts');
					const count = await syncAndProcessFacebookPosts(this.env);
					return { count: count || 0 };
				});
			} catch (e) {
				const msg = `sync-facebook-posts failed: ${(e as Error).message || e}`;
				console.error(`[Workflow] ${msg}`);
				errors.push(msg);
			}
		}

		if (errors.length > 0) {
			console.error(`[Workflow] Completed with ${errors.length} step failure(s): ${errors.join(' | ')}`);
		} else {
			console.log('[Workflow] All steps completed successfully.');
		}
	}
}
