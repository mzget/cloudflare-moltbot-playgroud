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
}

export class OaktreeSyncWorkflow extends WorkflowEntrypoint<Env, OaktreeWorkflowParams> {
	async run(event: WorkflowEvent<OaktreeWorkflowParams>, step: WorkflowStep) {
		const params = event.payload;

		if (params.fetchMarketStats) {
			await step.do('fetch-market-stats', async () => {
				const statsResult = await fetchAndStoreMarketStats(this.env, params.priceOnly);
				if (!params.priceOnly) {
					await recordDailyPortfolioHistory(this.env.DB);
				}
				return statsResult;
			});
		}

		if (params.checkAlertRules) {
			await step.do('check-alert-rules', async () => {
				return await checkAlertRules(this.env);
			});
		}

		if (params.syncEmails) {
			await step.do('sync-emails', async () => {
				return await syncAndIngestEmails(this.env);
			});
		}

		if (params.generateEmailDigests) {
			await step.do('generate-email-digests', async () => {
				const isManual = !!params.emailDigestsManual;
				return await generateEmailDigests(this.env, isManual);
			});
		}

		if (params.runCrawler) {
			await step.do('run-crawler', async () => {
				return await runCrawler(this.env);
			});
		}

		if (params.generateDailySummaries) {
			await step.do('generate-daily-summaries', async () => {
				const { results } = await this.env.DB.prepare('SELECT symbol FROM watchlist WHERE is_active = 1').all();
				const force = !!params.generateDailySummariesForce;
				const summaryPromises = results.map(row =>
					generateDailySummary(this.env, row.symbol as string, force)
						.catch(e => console.error(`Workflow summary failed for ${row.symbol}:`, e))
				);
				await Promise.all(summaryPromises);
				return { count: results.length };
			});
		}

		if (params.fetchMarketEvents) {
			await step.do('fetch-market-events', async () => {
				return await fetchAndStoreMarketEvents(this.env);
			});
		}

		if (params.sendDailyEmailReport) {
			await step.do('send-daily-email-report', async () => {
				console.log("sendDailyEmailReport is disabled for this phase.");
				return { status: "disabled", message: "sendDailyEmailReport is disabled for this phase." };
			});
		}

		if (params.purgeOldData) {
			await step.do('purge-old-data', async () => {
				const r1 = await this.env.DB.prepare("DELETE FROM daily_reports WHERE created_at < datetime('now', '-3 days')").run()
					.catch(e => { console.error("Failed to purge daily reports:", e); throw e; });
				const r2 = await this.env.DB.prepare("DELETE FROM market_events WHERE created_at < strftime('%s', 'now', '-30 days')").run()
					.catch(e => { console.error("Failed to purge market events:", e); throw e; });
				const r3 = await this.env.DB.prepare("DELETE FROM news WHERE created_at < datetime('now', '-3 days')").run()
					.catch(e => { console.error("Failed to purge news:", e); throw e; });
				return { reportsPurged: !!r1, eventsPurged: !!r2, newsPurged: !!r3 };
			});
		}

		if (params.syncNotebookArticles) {
			await step.do('sync-notebook-articles', async () => {
				return await syncNotebookArticles(this.env);
			});
		}

		if (params.syncFacebookPosts) {
			await step.do('sync-facebook-posts', async () => {
				return await syncAndProcessFacebookPosts(this.env);
			});
		}
	}
}
