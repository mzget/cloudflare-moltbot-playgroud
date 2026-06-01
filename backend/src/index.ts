import puppeteer, { BrowserWorker } from '@cloudflare/puppeteer';
import { runCrawler } from './crawler';
import { generateDailySummary } from './summarizer';
import { sendDailyEmailReport } from './email';
import { fetchAndStoreMarketStats } from './marketData';
import { fetchAndStoreMarketEvents } from './marketEvents';
import { checkAlertRules } from './alerts';
import { getAuthUrl, exchangeCodeForTokens } from './gmail';
import { syncAndIngestEmails, generateEmailDigests } from './emailSummarizer';
import { checkAuth, fetchGoogleUserProfile, isEmailAuthorized, signJwt, getUserLoginAuthUrl } from './auth';

export interface Env {
	DB: D1Database;
	AI: any;
	BROWSER: BrowserWorker;
	EMAIL: {
		send: (raw: string) => Promise<void>;
		destination_address: string;
	};
	FINNHUB_API_KEY?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	JWT_SECRET?: string;
	ALLOWED_EMAILS?: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Allow CORS
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
			'Access-Control-Max-Age': '86400',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// API: Google OAuth for User Login URL
		if (url.pathname === '/api/auth/user/login-url') {
			const clientId = env.GOOGLE_CLIENT_ID;
			const redirectUri = url.searchParams.get('redirect_uri');
			if (!clientId || !redirectUri) {
				return new Response('Missing client_id configuration or redirect_uri parameter', { status: 400, headers: corsHeaders });
			}
			const authUrl = getUserLoginAuthUrl(clientId, redirectUri);
			return Response.json({ url: authUrl }, { headers: corsHeaders });
		}

		// API: Google OAuth Callback for User Login
		if (url.pathname === '/api/auth/user/callback') {
			try {
				const { code, redirect_uri } = await request.json() as any;
				const clientId = env.GOOGLE_CLIENT_ID;
				const clientSecret = env.GOOGLE_CLIENT_SECRET;
				const jwtSecret = env.JWT_SECRET || 'dev-secret-key-123456';
				if (!clientId || !clientSecret || !code || !redirect_uri) {
					return new Response('Missing configuration, code, or redirect_uri', { status: 400, headers: corsHeaders });
				}
				const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirect_uri);
				const profile = await fetchGoogleUserProfile(tokens.access_token);
				
				if (!profile.email) {
					return new Response('Failed to retrieve email from Google profile', { status: 400, headers: corsHeaders });
				}
				
				// Email check
				const allowedEmails = env.ALLOWED_EMAILS;
				if (!isEmailAuthorized(profile.email, allowedEmails)) {
					return new Response('Forbidden: Your email is not authorized to access this site', { status: 403, headers: corsHeaders });
				}
				
				// Generate session JWT (valid for 7 days)
				const sessionPayload = {
					email: profile.email,
					name: profile.name,
					picture: profile.picture,
					exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
				};
				
				const token = await signJwt(sessionPayload, jwtSecret);
				return Response.json({
					success: true,
					token,
					user: {
						email: profile.email,
						name: profile.name,
						picture: profile.picture
					}
				}, { headers: corsHeaders });
			} catch (e) {
				return new Response(`User authentication failed: ${(e as any).message}`, { status: 500, headers: corsHeaders });
			}
		}

		// API: Get Current Authenticated User Info
		if (url.pathname === '/api/auth/user/me') {
			const jwtSecret = env.JWT_SECRET || 'dev-secret-key-123456';
			const user = await checkAuth(request, jwtSecret);
			if (!user) {
				return new Response('Unauthorized', { status: 401, headers: corsHeaders });
			}
			return Response.json({ user }, { headers: corsHeaders });
		}

		// Enforce authentication on all other protected endpoints (/api/*)
		const isUnprotectedRoute = url.pathname === '/' || 
		                           url.pathname.startsWith('/api/auth/user/');
		
		if (!isUnprotectedRoute && url.pathname.startsWith('/api/')) {
			const jwtSecret = env.JWT_SECRET || 'dev-secret-key-123456';
			const user = await checkAuth(request, jwtSecret);
			if (!user) {
				return new Response('Unauthorized', { status: 401, headers: corsHeaders });
			}
		}

		// API: Trigger Email Manually (Test)
		if (url.pathname === '/api/email-test') {
			ctx.waitUntil(sendDailyEmailReport(env));
			return new Response('Email trigger started', { headers: corsHeaders });
		}

		// API: Get Latest Reports (One per symbol)
		if (url.pathname === '/api/reports') {
			if (request.method === 'DELETE') {
				try {
					await env.DB.prepare("DELETE FROM daily_reports WHERE created_at < datetime('now', '-3 days')").run();
					return new Response('Purged old daily reports', { headers: corsHeaders });
				} catch (e) {
					return new Response(`Failed to purge daily reports: ${(e as any).message}`, { status: 500, headers: corsHeaders });
				}
			}
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
			if (request.method === 'DELETE') {
				try {
					await env.DB.prepare("DELETE FROM news WHERE created_at < datetime('now', '-3 days')").run();
					return new Response('Purged old news items', { headers: corsHeaders });
				} catch (e) {
					return new Response(`Failed to purge news: ${(e as any).message}`, { status: 500, headers: corsHeaders });
				}
			}
			const { results } = await env.DB.prepare(
				"SELECT id, symbol, title, summary, sentiment, url, CAST(strftime('%s', created_at) as INTEGER) as created_at FROM news ORDER BY created_at DESC LIMIT 50"
			).all();
			return Response.json(results, { headers: corsHeaders });
		}

		// API: Watchlist Operations
		if (url.pathname === '/api/watchlist') {
			if (request.method === 'GET') {
				const { results } = await env.DB.prepare(`
					SELECT w.*, 
					       (CASE WHEN p.symbol IS NOT NULL THEN 1 ELSE 0 END) as in_portfolio,
					       (SELECT COUNT(*) FROM alert_rules ar WHERE ar.symbol = w.symbol AND ar.is_active = 1) as active_alerts_count
					FROM watchlist w
					LEFT JOIN portfolio_holdings p ON w.symbol = p.symbol
				`).all();
				return Response.json(results, { headers: corsHeaders });
			}
			if (request.method === 'POST') {
				const { symbol, name } = await request.json() as any;
				await env.DB.prepare('INSERT OR IGNORE INTO watchlist (symbol, name) VALUES (?, ?)')
					.bind(symbol, name).run();
				return new Response('Symbol added', { headers: corsHeaders });
			}
			if (request.method === 'PUT') {
				const { symbol, is_active, in_portfolio } = await request.json() as any;
				if (is_active !== undefined) {
					await env.DB.prepare('UPDATE watchlist SET is_active = ? WHERE symbol = ?')
						.bind(is_active ? 1 : 0, symbol).run();
				}
				if (in_portfolio !== undefined) {
					if (in_portfolio) {
						await env.DB.prepare("INSERT OR IGNORE INTO portfolio_holdings (symbol, weight, thesis, category) VALUES (?, 0.0, 'Added from Watchlist', 'Stock')")
							.bind(symbol).run();
					} else {
						await env.DB.prepare('DELETE FROM portfolio_holdings WHERE symbol = ?')
							.bind(symbol).run();
					}
				}
				return new Response('Symbol updated', { headers: corsHeaders });
			}
			if (request.method === 'DELETE') {
				const symbol = url.searchParams.get('symbol');
				if (!symbol) {
					return new Response('Missing symbol parameter', { status: 400, headers: corsHeaders });
				}
				const symbolUpper = symbol.toUpperCase();
				try {
					await env.DB.batch([
						env.DB.prepare('DELETE FROM daily_reports WHERE symbol = ?').bind(symbolUpper),
						env.DB.prepare('DELETE FROM news WHERE symbol = ?').bind(symbolUpper),
						env.DB.prepare('DELETE FROM market_events WHERE symbol = ?').bind(symbolUpper),
						env.DB.prepare('DELETE FROM market_stats WHERE symbol = ?').bind(symbolUpper),
						env.DB.prepare('DELETE FROM alert_rules WHERE symbol = ?').bind(symbolUpper),
						env.DB.prepare('DELETE FROM in_app_notifications WHERE symbol = ?').bind(symbolUpper),
						env.DB.prepare('DELETE FROM watchlist WHERE symbol = ?').bind(symbolUpper)
					]);
					return new Response('Symbol removed', { headers: corsHeaders });
				} catch (e) {
					return new Response(`Failed to remove symbol from watchlist: ${(e as any).message}`, { status: 500, headers: corsHeaders });
				}
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

		// API: Trigger Market Stats Update Manually (Test)
		if (url.pathname === '/api/test-market-stats') {
			try {
				const results = await fetchAndStoreMarketStats(env);
				return Response.json(results, { headers: corsHeaders });
			} catch (e) {
				return Response.json({ error: (e as any).message }, { status: 500, headers: corsHeaders });
			}
		}

		// API: Trigger Market Events Update Manually (Test)
		if (url.pathname === '/api/crawl-events') {
			ctx.waitUntil(fetchAndStoreMarketEvents(env));
			return new Response('Market events fetch started', { headers: corsHeaders });
		}

		// API: Get Market Events
		if (url.pathname === '/api/market-events') {
			// Ensure table is created
			try {
				await env.DB.prepare(`
					CREATE TABLE IF NOT EXISTS market_events (
						id TEXT PRIMARY KEY,
						symbol TEXT NOT NULL,
						event_type TEXT NOT NULL,
						event_date TEXT NOT NULL,
						title TEXT NOT NULL,
						description TEXT,
						url TEXT,
						metadata TEXT,
						created_at INTEGER DEFAULT (strftime('%s', 'now'))
					)
				`).run();
			} catch (e) {
				console.error("Failed to ensure market_events table exists", e);
			}

			if (request.method === 'DELETE') {
				try {
					await env.DB.prepare("DELETE FROM market_events WHERE created_at < strftime('%s', 'now', '-30 days')").run();
					return new Response('Purged old market events', { headers: corsHeaders });
				} catch (e) {
					return new Response(`Failed to purge market events: ${(e as any).message}`, { status: 500, headers: corsHeaders });
				}
			}

			const symbol = url.searchParams.get('symbol');
			const eventType = url.searchParams.get('event_type');
			const params: any[] = [];

			let query: string;

			if (symbol) {
				// Specific symbol: return up to 100 events
				const conditions: string[] = ['symbol = ?'];
				params.push(symbol.toUpperCase());
				if (eventType) {
					conditions.push('event_type = ?');
					params.push(eventType);
				}
				query = `SELECT * FROM market_events WHERE ${conditions.join(' AND ')} ORDER BY event_date DESC LIMIT 100`;
			} else {
				// Default (all symbols): return latest 5 events per symbol via window function
				if (eventType) {
					params.push(eventType);
					query = `
						SELECT id, symbol, event_type, event_date, title, description, url, metadata, created_at
						FROM (
							SELECT *, ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY event_date DESC) as rn
							FROM market_events
							WHERE event_type = ?
						) WHERE rn <= 5
						ORDER BY event_date DESC
					`;
				} else {
					query = `
						SELECT id, symbol, event_type, event_date, title, description, url, metadata, created_at
						FROM (
							SELECT *, ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY event_date DESC) as rn
							FROM market_events
						) WHERE rn <= 5
						ORDER BY event_date DESC
					`;
				}
			}

			try {
				const { results } = await env.DB.prepare(query).bind(...params).all();
				return Response.json(results, { headers: corsHeaders });
			} catch (e) {
				return Response.json({ error: (e as any).message }, { status: 500, headers: corsHeaders });
			}
		}

		// API: Market Intelligence (Watchlist + Stats)
		if (url.pathname === '/api/market-intelligence') {
			const { results } = await env.DB.prepare(`
				SELECT 
					w.symbol, 
					w.name, 
					'NasdaqGS' as exchange,
					m.market_cap, m.revenues, m.revenue_3y_cagr, m.revenue_1y_growth, m.revenue_5y_cagr,
					m.gross_profit_margin, m.operating_margin, m.ev_ebit, m.ev_sales,
					m.p_ocf, m.p_fcf, m.capex_to_ocf, m.rd_to_revenue, m.debt_equity,
					m.p_e, m.fcf_margin, m.total_cash, m.net_debt, m.total_debt, m.dividend_yield,
					m.price
				FROM watchlist w
				LEFT JOIN market_stats m ON w.symbol = m.symbol
				WHERE w.is_active = 1
			`).all();

			return Response.json(results, { headers: corsHeaders });
		}

		// API: Alert Rules Operations
		if (url.pathname === '/api/alerts') {
			if (request.method === 'GET') {
				const symbol = url.searchParams.get('symbol');
				let results;
				if (symbol) {
					results = await env.DB.prepare('SELECT * FROM alert_rules WHERE symbol = ? ORDER BY created_at DESC')
						.bind(symbol.toUpperCase()).all();
				} else {
					results = await env.DB.prepare('SELECT * FROM alert_rules ORDER BY symbol ASC, created_at DESC').all();
				}
				return Response.json(results.results || [], { headers: corsHeaders });
			}
			if (request.method === 'POST') {
				const { symbol, metric, condition_type, target_value } = await request.json() as any;
				if (!symbol || !metric || !condition_type || target_value === undefined) {
					return new Response('Missing required fields', { status: 400, headers: corsHeaders });
				}
				await env.DB.prepare(
					'INSERT INTO alert_rules (symbol, metric, condition_type, target_value, is_active) VALUES (?, ?, ?, ?, 1)'
				).bind(symbol.toUpperCase(), metric, condition_type, target_value).run();
				return new Response('Alert rule created', { headers: corsHeaders });
			}
			if (request.method === 'PUT') {
				const { id, is_active, target_value } = await request.json() as any;
				if (id === undefined) {
					return new Response('Missing rule ID', { status: 400, headers: corsHeaders });
				}
				if (is_active !== undefined) {
					await env.DB.prepare('UPDATE alert_rules SET is_active = ?, last_checked_state = NULL WHERE id = ?')
						.bind(is_active ? 1 : 0, id).run();
				}
				if (target_value !== undefined) {
					await env.DB.prepare('UPDATE alert_rules SET target_value = ?, last_checked_state = NULL WHERE id = ?')
						.bind(target_value, id).run();
				}
				return new Response('Alert rule updated', { headers: corsHeaders });
			}
			if (request.method === 'DELETE') {
				const id = url.searchParams.get('id');
				if (!id) {
					return new Response('Missing rule ID', { status: 400, headers: corsHeaders });
				}
				await env.DB.prepare('DELETE FROM alert_rules WHERE id = ?').bind(id).run();
				return new Response('Alert rule deleted', { headers: corsHeaders });
			}
		}

		// API: In-App Notifications
		if (url.pathname === '/api/notifications') {
			if (request.method === 'GET') {
				const { results } = await env.DB.prepare(
					'SELECT * FROM in_app_notifications ORDER BY created_at DESC LIMIT 50'
				).all();
				return Response.json(results || [], { headers: corsHeaders });
			}
			if (request.method === 'PUT') {
				// Mark as read
				const body = await request.json().catch(() => ({})) as any;
				const id = body?.id;
				if (id) {
					await env.DB.prepare('UPDATE in_app_notifications SET is_read = 1 WHERE id = ?').bind(id).run();
				} else {
					await env.DB.prepare('UPDATE in_app_notifications SET is_read = 1 WHERE is_read = 0').run();
				}
				return new Response('Notifications updated', { headers: corsHeaders });
			}
		}

		// API: Trigger Alert Checks Manually (Test)
		if (url.pathname === '/api/alerts/check-test') {
			try {
				const results = await checkAlertRules(env);
				return Response.json(results, { headers: corsHeaders });
			} catch (e) {
				return Response.json({ error: (e as any).message }, { status: 500, headers: corsHeaders });
			}
		}

		// API: Get Google OAuth URL
		if (url.pathname === '/api/auth/google/url') {
			const clientId = env.GOOGLE_CLIENT_ID;
			const redirectUri = url.searchParams.get('redirect_uri');
			if (!clientId || !redirectUri) {
				return new Response('Missing client_id configuration or redirect_uri parameter', { status: 400, headers: corsHeaders });
			}
			const authUrl = getAuthUrl(clientId, redirectUri);
			return Response.json({ url: authUrl }, { headers: corsHeaders });
		}

		// API: Google OAuth Callback (Code Exchange)
		if (url.pathname === '/api/auth/google/callback') {
			try {
				const { code, redirect_uri } = await request.json() as any;
				const clientId = env.GOOGLE_CLIENT_ID;
				const clientSecret = env.GOOGLE_CLIENT_SECRET;
				if (!clientId || !clientSecret || !code || !redirect_uri) {
					return new Response('Missing configuration, code, or redirect_uri', { status: 400, headers: corsHeaders });
				}
				const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirect_uri);
				const expiryDate = Date.now() + tokens.expires_in * 1000;
				await env.DB.prepare(
					'INSERT INTO gmail_oauth (id, access_token, refresh_token, expiry_date) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET access_token = excluded.access_token, refresh_token = excluded.refresh_token, expiry_date = excluded.expiry_date, updated_at = (strftime(\'%s\', \'now\'))'
				).bind('default', tokens.access_token, tokens.refresh_token, expiryDate).run();
				return Response.json({ success: true }, { headers: corsHeaders });
			} catch (e) {
				return new Response(`OAuth callback exchange failed: ${(e as any).message}`, { status: 500, headers: corsHeaders });
			}
		}

		// API: Get Google Auth Status
		if (url.pathname === '/api/auth/google/status') {
			const row = await env.DB.prepare('SELECT 1 FROM gmail_oauth WHERE id = ?').bind('default').first();
			return Response.json({ connected: !!row }, { headers: corsHeaders });
		}

		// API: Google Disconnect
		if (url.pathname === '/api/auth/google/disconnect') {
			await env.DB.prepare('DELETE FROM gmail_oauth WHERE id = ?').bind('default').run();
			return new Response('Disconnected', { headers: corsHeaders });
		}

		// API: Subscriptions CRUD
		if (url.pathname === '/api/subscriptions') {
			if (request.method === 'GET') {
				const { results } = await env.DB.prepare('SELECT * FROM email_subscriptions ORDER BY created_at DESC').all();
				return Response.json(results || [], { headers: corsHeaders });
			}
			if (request.method === 'POST') {
				try {
					const { name, sender, subject_filter, label_filter, raw_query, frequency } = await request.json() as any;
					await env.DB.prepare(
						'INSERT INTO email_subscriptions (name, sender, subject_filter, label_filter, raw_query, frequency) VALUES (?, ?, ?, ?, ?, ?)'
					).bind(name, sender || null, subject_filter || null, label_filter || null, raw_query || null, frequency || 'hourly').run();
					return new Response('Subscription created', { headers: corsHeaders });
				} catch (e) {
					return new Response(`Failed to create subscription: ${(e as any).message}`, { status: 500, headers: corsHeaders });
				}
			}
			if (request.method === 'PUT') {
				try {
					const { id, name, sender, subject_filter, label_filter, raw_query, frequency, is_active } = await request.json() as any;
					await env.DB.prepare(
						'UPDATE email_subscriptions SET name=?, sender=?, subject_filter=?, label_filter=?, raw_query=?, frequency=?, is_active=? WHERE id=?'
					).bind(name, sender || null, subject_filter || null, label_filter || null, raw_query || null, frequency, is_active !== undefined ? (is_active ? 1 : 0) : 1, id).run();
					return new Response('Subscription updated', { headers: corsHeaders });
				} catch (e) {
					return new Response(`Failed to update subscription: ${(e as any).message}`, { status: 500, headers: corsHeaders });
				}
			}
			if (request.method === 'DELETE') {
				try {
					const id = url.searchParams.get('id');
					if (!id) {
						return new Response('Missing subscription ID', { status: 400, headers: corsHeaders });
					}
					await env.DB.prepare('DELETE FROM email_subscriptions WHERE id = ?').bind(id).run();
					return new Response('Subscription deleted', { headers: corsHeaders });
				} catch (e) {
					return new Response(`Failed to delete subscription: ${(e as any).message}`, { status: 500, headers: corsHeaders });
				}
			}
		}

		// API: Manual Sync & Summarize
		if (url.pathname === '/api/email-sync') {
			ctx.waitUntil((async () => {
				try {
					console.log('Starting manual email sync...');
					const newCount = await syncAndIngestEmails(env);
					console.log(`Ingested ${newCount} new emails. Running digest generator...`);
					await generateEmailDigests(env, true);
					console.log('Email sync & digest completed.');
				} catch (e) {
					console.error('Manual email sync failed:', e);
				}
			})());
			return new Response('Email sync started', { headers: corsHeaders });
		}

		// API: Test Email Sync & Digest (Synchronous)
		if (url.pathname === '/api/test-email-digest') {
			try {
				console.log('Starting manual test email digest...');
				await generateEmailDigests(env, true);
				return Response.json({
					success: true,
					message: 'Email digest generation completed successfully'
				}, { headers: corsHeaders });
			} catch (e) {
				return Response.json({
					success: false,
					error: (e as any).message
				}, { status: 500, headers: corsHeaders });
			}
		}

		// API: Mark Email Digest as Read
		if (url.pathname === '/api/email-digests/mark-read' && request.method === 'POST') {
			try {
				const { id } = await request.json() as any;
				if (!id) {
					return Response.json({ error: 'Missing digest ID' }, { status: 400, headers: corsHeaders });
				}
				await env.DB.prepare(
					'UPDATE email_digests SET is_readed = 1 WHERE id = ?'
				).bind(id).run();
				return Response.json({ success: true, message: 'Digest marked as read' }, { headers: corsHeaders });
			} catch (e) {
				return Response.json({ error: (e as any).message }, { status: 500, headers: corsHeaders });
			}
		}

		// API: Get Email Digests
		if (url.pathname === '/api/email-digests') {
			try {
				const { results } = await env.DB.prepare(
					'SELECT id, category, summary, key_takeaways, source_emails, digest_date, is_readed, CAST(strftime(\'%s\', created_at) as INTEGER) as created_at FROM email_digests WHERE is_readed = 0 ORDER BY created_at DESC LIMIT 50'
				).all();
				return Response.json(results || [], { headers: corsHeaders });
			} catch (e) {
				return Response.json({ error: (e as any).message }, { status: 500, headers: corsHeaders });
			}
		}

		return new Response("Oaktree Agent Backend Running");
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		console.log("Running scheduled worker tasks...");

		ctx.waitUntil((async () => {
			// 1. Hourly tasks: Update prices and stats + check alerts + email sync & digest
			await fetchAndStoreMarketStats(env);
			await checkAlertRules(env);
			await syncAndIngestEmails(env).catch(e => console.error("Scheduled email sync failed:", e));
			await generateEmailDigests(env, false).catch(e => console.error("Scheduled email digest generation failed:", e));

			// 2. 6-Hourly tasks: run crawler, summary, events, daily email report, purge old data
			const hour = new Date().getUTCHours();
			if (hour % 6 === 0) {
				console.log("Running 6-hourly crawler and summaries sequence...");
				
				// Run Crawler
				await runCrawler(env);

				// Generate Summaries for all symbols in parallel
				const { results } = await env.DB.prepare('SELECT symbol FROM watchlist WHERE is_active = 1').all();
				await Promise.all(results.map(row =>
					generateDailySummary(env, row.symbol as string)
						.catch(e => console.error(`Scheduled summary failed for ${row.symbol}:`, e))
				));

				// Fetch and store market events
				await fetchAndStoreMarketEvents(env).catch(e => console.error("Scheduled events fetch failed:", e));

				// Send Email Report
				await sendDailyEmailReport(env);

				// Purges
				console.log("Purging old data...");
				await env.DB.prepare("DELETE FROM daily_reports WHERE created_at < datetime('now', '-3 days')").run()
					.catch(e => console.error("Failed to purge old daily reports:", e));
				await env.DB.prepare("DELETE FROM market_events WHERE created_at < strftime('%s', 'now', '-30 days')").run()
					.catch(e => console.error("Failed to purge old market events:", e));
				await env.DB.prepare("DELETE FROM news WHERE created_at < datetime('now', '-3 days')").run()
					.catch(e => console.error("Failed to purge old news:", e));
			}

			console.log("Scheduled sequence completed.");
		})());
	},
};
