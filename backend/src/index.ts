import puppeteer, { BrowserWorker } from '@cloudflare/puppeteer';
import { runCrawler } from './crawler';
import { generateDailySummary } from './summarizer';
import { sendDailyEmailReport } from './email';

export interface Env {
	DB: D1Database;
	AI: any;
	BROWSER: BrowserWorker;
	EMAIL: {
		send: (raw: string) => Promise<void>;
		destination_address: string;
	};
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Allow CORS
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// API: Trigger Email Manually (Test)
		if (url.pathname === '/api/email-test') {
			ctx.waitUntil(sendDailyEmailReport(env));
			return new Response('Email trigger started', { headers: corsHeaders });
		}

		// API: Get Latest Reports
		if (url.pathname === '/api/reports') {
			const { results } = await env.DB.prepare(
				'SELECT * FROM daily_reports ORDER BY created_at DESC LIMIT 20'
			).all();
			return Response.json(results, { headers: corsHeaders });
		}

		// API: Get Latest News
		if (url.pathname === '/api/news') {
			const { results } = await env.DB.prepare(
				'SELECT * FROM news ORDER BY created_at DESC LIMIT 50'
			).all();
			return Response.json(results, { headers: corsHeaders });
		}

		// API: Watchlist Operations
		if (url.pathname === '/api/watchlist') {
			if (request.method === 'GET') {
				const { results } = await env.DB.prepare('SELECT * FROM watchlist').all();
				return Response.json(results, { headers: corsHeaders });
			}
			if (request.method === 'POST') {
				const { symbol, name } = await request.json() as any;
				await env.DB.prepare('INSERT OR IGNORE INTO watchlist (symbol, name) VALUES (?, ?)')
					.bind(symbol, name).run();
				return new Response('Symbol added', { headers: corsHeaders });
			}
			if (request.method === 'DELETE') {
				const symbol = url.searchParams.get('symbol');
				await env.DB.prepare('DELETE FROM watchlist WHERE symbol = ?').bind(symbol).run();
				return new Response('Symbol removed', { headers: corsHeaders });
			}
		}

		// API: Source Operations
		if (url.pathname === '/api/sources') {
			if (request.method === 'GET') {
				const { results } = await env.DB.prepare('SELECT * FROM news_sources').all();
				return Response.json(results, { headers: corsHeaders });
			}
			if (request.method === 'POST' || request.method === 'PUT') {
				const source = await request.json() as any;
				if (request.method === 'POST') {
					await env.DB.prepare('INSERT INTO news_sources (name, url_pattern, selector, type, enabled) VALUES (?, ?, ?, ?, ?)')
						.bind(source.name, source.url_pattern, source.selector, source.type, source.enabled ? 1 : 0).run();
				} else {
					await env.DB.prepare('UPDATE news_sources SET name=?, url_pattern=?, selector=?, type=?, enabled=? WHERE id=?')
						.bind(source.name, source.url_pattern, source.selector, source.type, source.enabled ? 1 : 0, source.id).run();
				}
				return new Response('Source updated', { headers: corsHeaders });
			}
			if (request.method === 'DELETE') {
				const id = url.searchParams.get('id');
				await env.DB.prepare('DELETE FROM news_sources WHERE id = ?').bind(id).run();
				return new Response('Source removed', { headers: corsHeaders });
			}
		}

		// API: Trigger Crawler Manually
		if (url.pathname === '/api/crawl') {
			ctx.waitUntil(runCrawler(env));
			return new Response('Crawler started', { headers: corsHeaders });
		}

		// API: Trigger Full Daily Sequence Manually
		if (url.pathname === '/api/run-all') {
			ctx.waitUntil((async () => {
				await runCrawler(env);
				const { results } = await env.DB.prepare('SELECT symbol FROM watchlist').all();
				for (const row of results) {
					await generateDailySummary(env, row.symbol as string);
				}
				// Skip email for now as requested
				console.log("Manual full run completed.");
			})());
			return new Response('Full sequence started', { headers: corsHeaders });
		}

		return new Response("Oaktree Agent Backend Running");
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		console.log("Running scheduled crawl and report...");
		
		ctx.waitUntil((async () => {
			// 1. Run Crawler
			await runCrawler(env);

			// 2. Generate Summaries for all symbols in watchlist
			const { results } = await env.DB.prepare('SELECT symbol FROM watchlist').all();
			for (const row of results) {
				await generateDailySummary(env, row.symbol as string);
			}

			// 3. Send Email Report
			await sendDailyEmailReport(env);
			
			console.log("Daily sequence completed.");
		})());
	},
};
