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
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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

		// API: Get Latest Reports (One per symbol)
		if (url.pathname === '/api/reports') {
			const { results } = await env.DB.prepare(`
				SELECT * FROM (
					SELECT *, ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY created_at DESC) as rn
					FROM daily_reports
				) WHERE rn = 1
				ORDER BY created_at DESC
			`).all();
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
			if (request.method === 'PUT') {
				const { symbol, is_active } = await request.json() as any;
				await env.DB.prepare('UPDATE watchlist SET is_active = ? WHERE symbol = ?')
					.bind(is_active ? 1 : 0, symbol).run();
				return new Response('Symbol updated', { headers: corsHeaders });
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

		// API: Trigger Crawler (Chains to Summarizer)
		if (url.pathname === '/api/crawl') {
			ctx.waitUntil((async () => {
				await runCrawler(env);
			})());
			return new Response('Crawler sequence started', { headers: corsHeaders });
		}

		// API: Summarize All Symbols
		if (url.pathname === '/api/summarize-all') {
			ctx.waitUntil((async () => {
				const { results } = await env.DB.prepare('SELECT symbol FROM watchlist WHERE is_active = 1').all();
				console.log(`Summarizing ${results.length} symbols...`);
				await Promise.all(results.map(row =>
					generateDailySummary(env, row.symbol as string)
						.catch(e => console.error(`Summary failed for ${row.symbol}:`, e))
				));
				console.log("All summaries completed.");
			})());
			return new Response('Summarization started', { headers: corsHeaders });
		}

		// API: Trigger Full Daily Sequence Manually (Legacy/Combined)
		if (url.pathname === '/api/run-all') {
			// Now just a shortcut to crawl which chains
			return Response.redirect(`${url.origin}/api/crawl`, 307);
		}

		// API: Market Intelligence (Watchlist + Stats)
		if (url.pathname === '/api/market-intelligence') {
			const { results } = await env.DB.prepare('SELECT * FROM watchlist WHERE is_active = 1').all();
			
			// Map watchlist items to the CompanyStats structure expected by the frontend
			const stats = results.map(row => ({
				symbol: row.symbol,
				name: row.name || row.symbol,
				exchange: 'NasdaqGS', // Default, can be updated later
				market_cap: null,
				revenues: null,
				revenue_3y_cagr: null,
				revenue_1y_growth: null,
				gross_profit_margin: null,
				operating_margin: null,
				ev_ebit: null,
				ev_sales: null,
				p_ocf: null,
				p_fcf: null,
				capex_to_ocf: null,
				rd_to_revenue: null,
				debt_equity: null
			}));

			return Response.json(stats, { headers: corsHeaders });
		}

		return new Response("Oaktree Agent Backend Running");
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		console.log("Running scheduled crawl and report...");

		ctx.waitUntil((async () => {
			// 1. Run Crawler
			await runCrawler(env);

			// 2. Generate Summaries for all symbols in parallel
			const { results } = await env.DB.prepare('SELECT symbol FROM watchlist WHERE is_active = 1').all();
			await Promise.all(results.map(row =>
				generateDailySummary(env, row.symbol as string)
					.catch(e => console.error(`Scheduled summary failed for ${row.symbol}:`, e))
			));

			// 3. Send Email Report
			await sendDailyEmailReport(env);

			console.log("Daily sequence completed.");
		})());
	},
};
