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
import { syncAndProcessFacebookPosts } from './facebook';

import { Hono } from 'hono';
import { cors } from 'hono/cors';

export { OaktreeSyncWorkflow } from './workflow';

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
	FACEBOOK_PAGE_ID?: string;
	FACEBOOK_PAGE_ACCESS_TOKEN?: string;
	OAKTREE_SYNC_WORKFLOW: Workflow;
}

const app = new Hono<{
	Bindings: Env;
	Variables: {
		user: any;
	};
}>();

// Enable CORS
app.use('*', cors({
	origin: '*',
	allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowHeaders: ['Content-Type', 'Authorization'],
	maxAge: 86400,
}));

// Authentication Middleware
app.use('/api/*', async (c, next) => {
	const path = c.req.path;
	const isUnprotectedRoute = path === '/' || 
							   path.startsWith('/api/auth/user/') || 
							   path === '/api/test-facebook-post';
	
	if (!isUnprotectedRoute) {
		const jwtSecret = c.env.JWT_SECRET || 'dev-secret-key-123456';
		const user = await checkAuth(c.req.raw, jwtSecret);
		if (!user) {
			return c.text('Unauthorized', 401);
		}
		c.set('user', user);
	}
	await next();
});

// API: Google OAuth for User Login URL
app.get('/api/auth/user/login-url', async (c) => {
	const clientId = c.env.GOOGLE_CLIENT_ID;
	const redirectUri = c.req.query('redirect_uri');
	if (!clientId || !redirectUri) {
		return c.text('Missing client_id configuration or redirect_uri parameter', 400);
	}
	const authUrl = getUserLoginAuthUrl(clientId, redirectUri);
	return c.json({ url: authUrl });
});

// API: Google OAuth Callback for User Login
app.post('/api/auth/user/callback', async (c) => {
	try {
		const { code, redirect_uri } = await c.req.json() as any;
		const clientId = c.env.GOOGLE_CLIENT_ID;
		const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
		const jwtSecret = c.env.JWT_SECRET || 'dev-secret-key-123456';
		if (!clientId || !clientSecret || !code || !redirect_uri) {
			return c.text('Missing configuration, code, or redirect_uri', 400);
		}
		const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirect_uri);
		const profile = await fetchGoogleUserProfile(tokens.access_token);
		
		if (!profile.email) {
			return c.text('Failed to retrieve email from Google profile', 400);
		}
		
		// Email check
		const allowedEmails = c.env.ALLOWED_EMAILS;
		if (!isEmailAuthorized(profile.email, allowedEmails)) {
			return c.text('Forbidden: Your email is not authorized to access this site', 403);
		}
		
		// Generate session JWT (valid for 7 days)
		const sessionPayload = {
			email: profile.email,
			name: profile.name,
			picture: profile.picture,
			exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
		};
		
		const token = await signJwt(sessionPayload, jwtSecret);
		return c.json({
			success: true,
			token,
			user: {
				email: profile.email,
				name: profile.name,
				picture: profile.picture
			}
		});
	} catch (e) {
		return c.text(`User authentication failed: ${(e as any).message}`, 500);
	}
});

// API: Get Current Authenticated User Info
app.get('/api/auth/user/me', async (c) => {
	const user = c.get('user');
	if (!user) {
		return c.text('Unauthorized', 401);
	}
	return c.json({ user });
});

// API: Trigger Email Manually (Test)
app.get('/api/email-test', async (c) => {
	try {
		const instance = await c.env.OAKTREE_SYNC_WORKFLOW.create({
			id: `manual-email-test-${Date.now()}`,
			params: { sendDailyEmailReport: true }
		});
		return c.text(`Email trigger started via Workflow: ${instance.id}`);
	} catch (e) {
		return c.text(`Failed to start email trigger workflow: ${(e as any).message}`, 500);
	}
});

// API: Get Latest Reports (One per symbol) / Purge Old Reports
app.get('/api/reports', async (c) => {
	const { results } = await c.env.DB.prepare(`
		SELECT m.*
		FROM (SELECT DISTINCT symbol FROM daily_reports) s
		JOIN daily_reports m ON m.id IN (
			SELECT id FROM daily_reports
			WHERE symbol = s.symbol
			ORDER BY created_at DESC
			LIMIT 1
		)
		ORDER BY m.created_at DESC
	`).all();
	return c.json(results);
});

app.delete('/api/reports', async (c) => {
	try {
		await c.env.DB.prepare("DELETE FROM daily_reports WHERE created_at < datetime('now', '-3 days')").run();
		return c.text('Purged old daily reports');
	} catch (e) {
		return c.text(`Failed to purge daily reports: ${(e as any).message}`, 500);
	}
});

// API: Get Latest News / Purge Old News
app.get('/api/news', async (c) => {
	const { results } = await c.env.DB.prepare(
		"SELECT id, symbol, title, summary, sentiment, url, CAST(strftime('%s', created_at) as INTEGER) as created_at FROM news ORDER BY created_at DESC LIMIT 50"
	).all();
	return c.json(results);
});

app.delete('/api/news', async (c) => {
	try {
		await c.env.DB.prepare("DELETE FROM news WHERE created_at < datetime('now', '-3 days')").run();
		return c.text('Purged old news items');
	} catch (e) {
		return c.text(`Failed to purge news: ${(e as any).message}`, 500);
	}
});

// API: Watchlist Operations
app.get('/api/watchlist', async (c) => {
	const { results } = await c.env.DB.prepare(`
		SELECT w.*, 
		       (CASE WHEN p.symbol IS NOT NULL THEN 1 ELSE 0 END) as in_portfolio,
		       (SELECT COUNT(*) FROM alert_rules ar WHERE ar.symbol = w.symbol AND ar.is_active = 1) as active_alerts_count
		FROM watchlist w
		LEFT JOIN portfolio_holdings p ON w.symbol = p.symbol
	`).all();
	return c.json(results);
});

app.post('/api/watchlist', async (c) => {
	const { symbol, name } = await c.req.json() as any;
	await c.env.DB.prepare('INSERT OR IGNORE INTO watchlist (symbol, name) VALUES (?, ?)')
		.bind(symbol, name).run();
	return c.text('Symbol added');
});

app.put('/api/watchlist', async (c) => {
	const { symbol, is_active, in_portfolio } = await c.req.json() as any;
	if (is_active !== undefined) {
		await c.env.DB.prepare('UPDATE watchlist SET is_active = ? WHERE symbol = ?')
			.bind(is_active ? 1 : 0, symbol).run();
	}
	if (in_portfolio !== undefined) {
		if (in_portfolio) {
			await c.env.DB.prepare("INSERT OR IGNORE INTO portfolio_holdings (symbol, weight, thesis, category) VALUES (?, 0.0, 'Added from Watchlist', 'Stock')")
				.bind(symbol).run();
		} else {
			await c.env.DB.prepare('DELETE FROM portfolio_holdings WHERE symbol = ?')
				.bind(symbol).run();
		}
	}
	return c.text('Symbol updated');
});

app.delete('/api/watchlist', async (c) => {
	const symbol = c.req.query('symbol');
	if (!symbol) {
		return c.text('Missing symbol parameter', 400);
	}
	const symbolUpper = symbol.toUpperCase();
	try {
		await c.env.DB.batch([
			c.env.DB.prepare('DELETE FROM daily_reports WHERE symbol = ?').bind(symbolUpper),
			c.env.DB.prepare('DELETE FROM news WHERE symbol = ?').bind(symbolUpper),
			c.env.DB.prepare('DELETE FROM market_events WHERE symbol = ?').bind(symbolUpper),
			c.env.DB.prepare('DELETE FROM market_stats WHERE symbol = ?').bind(symbolUpper),
			c.env.DB.prepare('DELETE FROM alert_rules WHERE symbol = ?').bind(symbolUpper),
			c.env.DB.prepare('DELETE FROM in_app_notifications WHERE symbol = ?').bind(symbolUpper),
			c.env.DB.prepare('DELETE FROM watchlist WHERE symbol = ?').bind(symbolUpper)
		]);
		return c.text('Symbol removed');
	} catch (e) {
		return c.text(`Failed to remove symbol from watchlist: ${(e as any).message}`, 500);
	}
});

// API: Source Operations
app.get('/api/sources', async (c) => {
	const { results } = await c.env.DB.prepare('SELECT * FROM news_sources').all();
	return c.json(results);
});

app.post('/api/sources', async (c) => {
	const source = await c.req.json() as any;
	await c.env.DB.prepare('INSERT INTO news_sources (name, url_pattern, selector, type, enabled) VALUES (?, ?, ?, ?, ?)')
		.bind(source.name, source.url_pattern, source.selector, source.type, source.enabled ? 1 : 0).run();
	return c.text('Source updated');
});

app.put('/api/sources', async (c) => {
	const source = await c.req.json() as any;
	await c.env.DB.prepare('UPDATE news_sources SET name=?, url_pattern=?, selector=?, type=?, enabled=? WHERE id=?')
		.bind(source.name, source.url_pattern, source.selector, source.type, source.enabled ? 1 : 0, source.id).run();
	return c.text('Source updated');
});

app.delete('/api/sources', async (c) => {
	const id = c.req.query('id');
	await c.env.DB.prepare('DELETE FROM news_sources WHERE id = ?').bind(id).run();
	return c.text('Source removed');
});

// API: Trigger Crawler (Chains to Summarizer)
app.get('/api/crawl', async (c) => {
	try {
		const instance = await c.env.OAKTREE_SYNC_WORKFLOW.create({
			id: `manual-crawl-${Date.now()}`,
			params: { runCrawler: true }
		});
		return c.text(`Crawler sequence started via Workflow: ${instance.id}`);
	} catch (e) {
		return c.text(`Failed to start crawler workflow: ${(e as any).message}`, 500);
	}
});

// API: Summarize All Symbols
app.get('/api/summarize-all', async (c) => {
	try {
		const instance = await c.env.OAKTREE_SYNC_WORKFLOW.create({
			id: `manual-summarize-all-${Date.now()}`,
			params: { generateDailySummaries: true }
		});
		return c.text(`Summarization started via Workflow: ${instance.id}`);
	} catch (e) {
		return c.text(`Failed to start summarization workflow: ${(e as any).message}`, 500);
	}
});

// API: Trigger Full Daily Sequence Manually (Legacy/Combined)
app.get('/api/run-all', (c) => {
	return c.redirect(`/api/crawl`, 307);
});

// API: Trigger Market Stats Update Manually (Test)
app.get('/api/test-market-stats', async (c) => {
	try {
		const results = await fetchAndStoreMarketStats(c.env);
		return c.json(results);
	} catch (e) {
		return c.json({ error: (e as any).message }, 500);
	}
});

// API: Trigger Market Events Update Manually (Test)
app.get('/api/crawl-events', async (c) => {
	try {
		const instance = await c.env.OAKTREE_SYNC_WORKFLOW.create({
			id: `manual-crawl-events-${Date.now()}`,
			params: { fetchMarketEvents: true }
		});
		return c.text(`Market events fetch started via Workflow: ${instance.id}`);
	} catch (e) {
		return c.text(`Failed to start market events fetch workflow: ${(e as any).message}`, 500);
	}
});

// API: Get Market Events / Purge Old Market Events
app.get('/api/market-events', async (c) => {
	// Ensure table is created
	try {
		await c.env.DB.prepare(`
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

	const symbol = c.req.query('symbol');
	const eventType = c.req.query('event_type');
	const params: any[] = [];
	let query: string;

	if (symbol) {
		const conditions: string[] = ['symbol = ?'];
		params.push(symbol.toUpperCase());
		if (eventType) {
			conditions.push('event_type = ?');
			params.push(eventType);
		}
		query = `SELECT * FROM market_events WHERE ${conditions.join(' AND ')} ORDER BY event_date DESC LIMIT 100`;
	} else {
		if (eventType) {
			params.push(eventType, eventType);
			query = `
				SELECT m.id, m.symbol, m.event_type, m.event_date, m.title, m.description, m.url, m.metadata, m.created_at
				FROM (SELECT DISTINCT symbol FROM market_events WHERE event_type = ?) s
				JOIN market_events m ON m.id IN (
					SELECT id FROM market_events
					WHERE symbol = s.symbol AND event_type = ?
					ORDER BY event_date DESC
					LIMIT 5
				)
				ORDER BY m.event_date DESC
			`;
		} else {
			query = `
				SELECT m.id, m.symbol, m.event_type, m.event_date, m.title, m.description, m.url, m.metadata, m.created_at
				FROM (SELECT DISTINCT symbol FROM market_events) s
				JOIN market_events m ON m.id IN (
					SELECT id FROM market_events
					WHERE symbol = s.symbol
					ORDER BY event_date DESC
					LIMIT 5
				)
				ORDER BY m.event_date DESC
			`;
		}
	}

	try {
		const { results } = await c.env.DB.prepare(query).bind(...params).all();
		return c.json(results);
	} catch (e) {
		return c.json({ error: (e as any).message }, 500);
	}
});

app.delete('/api/market-events', async (c) => {
	try {
		await c.env.DB.prepare("DELETE FROM market_events WHERE created_at < strftime('%s', 'now', '-30 days')").run();
		return c.text('Purged old market events');
	} catch (e) {
		return c.text(`Failed to purge market events: ${(e as any).message}`, 500);
	}
});

// API: Market Intelligence (Watchlist + Stats)
app.get('/api/market-intelligence', async (c) => {
	const { results } = await c.env.DB.prepare(`
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

	return c.json(results);
});

// API: Alert Rules Operations
app.get('/api/alerts', async (c) => {
	const symbol = c.req.query('symbol');
	let results;
	if (symbol) {
		results = await c.env.DB.prepare('SELECT * FROM alert_rules WHERE symbol = ? ORDER BY created_at DESC')
			.bind(symbol.toUpperCase()).all();
	} else {
		results = await c.env.DB.prepare('SELECT * FROM alert_rules ORDER BY symbol ASC, created_at DESC').all();
	}
	return c.json(results.results || []);
});

app.post('/api/alerts', async (c) => {
	const { symbol, metric, condition_type, target_value } = await c.req.json() as any;
	if (!symbol || !metric || !condition_type || target_value === undefined) {
		return c.text('Missing required fields', 400);
	}
	await c.env.DB.prepare(
		'INSERT INTO alert_rules (symbol, metric, condition_type, target_value, is_active) VALUES (?, ?, ?, ?, 1)'
	).bind(symbol.toUpperCase(), metric, condition_type, target_value).run();
	return c.text('Alert rule created');
});

app.put('/api/alerts', async (c) => {
	const { id, is_active, target_value } = await c.req.json() as any;
	if (id === undefined) {
		return c.text('Missing rule ID', 400);
	}
	if (is_active !== undefined) {
		await c.env.DB.prepare('UPDATE alert_rules SET is_active = ?, last_checked_state = NULL WHERE id = ?')
			.bind(is_active ? 1 : 0, id).run();
	}
	if (target_value !== undefined) {
		await c.env.DB.prepare('UPDATE alert_rules SET target_value = ?, last_checked_state = NULL WHERE id = ?')
			.bind(target_value, id).run();
	}
	return c.text('Alert rule updated');
});

app.delete('/api/alerts', async (c) => {
	const id = c.req.query('id');
	if (!id) {
		return c.text('Missing rule ID', 400);
	}
	await c.env.DB.prepare('DELETE FROM alert_rules WHERE id = ?').bind(id).run();
	return c.text('Alert rule deleted');
});

// API: In-App Notifications
app.get('/api/notifications', async (c) => {
	const { results } = await c.env.DB.prepare(
		'SELECT * FROM in_app_notifications ORDER BY created_at DESC LIMIT 50'
	).all();
	return c.json(results || []);
});

app.put('/api/notifications', async (c) => {
	const body = await c.req.json().catch(() => ({})) as any;
	const id = body?.id;
	if (id) {
		await c.env.DB.prepare('UPDATE in_app_notifications SET is_read = 1 WHERE id = ?').bind(id).run();
	} else {
		await c.env.DB.prepare('UPDATE in_app_notifications SET is_read = 1 WHERE is_read = 0').run();
	}
	return c.text('Notifications updated');
});

// API: Trigger Alert Checks Manually (Test)
app.get('/api/alerts/check-test', async (c) => {
	try {
		const results = await checkAlertRules(c.env);
		return c.json(results);
	} catch (e) {
		return c.json({ error: (e as any).message }, 500);
	}
});

// API: Get Google OAuth URL
app.get('/api/auth/google/url', async (c) => {
	const clientId = c.env.GOOGLE_CLIENT_ID;
	const redirectUri = c.req.query('redirect_uri');
	if (!clientId || !redirectUri) {
		return c.text('Missing client_id configuration or redirect_uri parameter', 400);
	}
	const authUrl = getAuthUrl(clientId, redirectUri);
	return c.json({ url: authUrl });
});

// API: Google OAuth Callback (Code Exchange)
app.post('/api/auth/google/callback', async (c) => {
	try {
		const { code, redirect_uri } = await c.req.json() as any;
		const clientId = c.env.GOOGLE_CLIENT_ID;
		const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
		if (!clientId || !clientSecret || !code || !redirect_uri) {
			return c.text('Missing configuration, code, or redirect_uri', 400);
		}
		const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirect_uri);
		const expiryDate = Date.now() + tokens.expires_in * 1000;
		await c.env.DB.prepare(
			'INSERT INTO gmail_oauth (id, access_token, refresh_token, expiry_date) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET access_token = excluded.access_token, refresh_token = excluded.refresh_token, expiry_date = excluded.expiry_date, updated_at = (strftime(\'%s\', \'now\'))'
		).bind('default', tokens.access_token, tokens.refresh_token, expiryDate).run();
		return c.json({ success: true });
	} catch (e) {
		return c.text(`OAuth callback exchange failed: ${(e as any).message}`, 500);
	}
});

// API: Get Google Auth Status
app.get('/api/auth/google/status', async (c) => {
	const row = await c.env.DB.prepare('SELECT 1 FROM gmail_oauth WHERE id = ?').bind('default').first();
	return c.json({ connected: !!row });
});

// API: Google Disconnect
app.post('/api/auth/google/disconnect', async (c) => {
	await c.env.DB.prepare('DELETE FROM gmail_oauth WHERE id = ?').bind('default').run();
	return c.text('Disconnected');
});

// API: Subscriptions CRUD
app.get('/api/subscriptions', async (c) => {
	const { results } = await c.env.DB.prepare('SELECT * FROM email_subscriptions ORDER BY created_at DESC').all();
	return c.json(results || []);
});

app.post('/api/subscriptions', async (c) => {
	try {
		const { name, sender, subject_filter, label_filter, raw_query, frequency } = await c.req.json() as any;
		await c.env.DB.prepare(
			'INSERT INTO email_subscriptions (name, sender, subject_filter, label_filter, raw_query, frequency) VALUES (?, ?, ?, ?, ?, ?)'
		).bind(name, sender || null, subject_filter || null, label_filter || null, raw_query || null, frequency || 'hourly').run();
		return c.text('Subscription created');
	} catch (e) {
		return c.text(`Failed to create subscription: ${(e as any).message}`, 500);
	}
});

app.put('/api/subscriptions', async (c) => {
	try {
		const { id, name, sender, subject_filter, label_filter, raw_query, frequency, is_active } = await c.req.json() as any;
		await c.env.DB.prepare(
			'UPDATE email_subscriptions SET name=?, sender=?, subject_filter=?, label_filter=?, raw_query=?, frequency=?, is_active=? WHERE id=?'
		).bind(name, sender || null, subject_filter || null, label_filter || null, raw_query || null, frequency, is_active !== undefined ? (is_active ? 1 : 0) : 1, id).run();
		return c.text('Subscription updated');
	} catch (e) {
		return c.text(`Failed to update subscription: ${(e as any).message}`, 500);
	}
});

app.delete('/api/subscriptions', async (c) => {
	try {
		const id = c.req.query('id');
		if (!id) {
			return c.text('Missing subscription ID', 400);
		}
		await c.env.DB.prepare('DELETE FROM email_subscriptions WHERE id = ?').bind(id).run();
		return c.text('Subscription deleted');
	} catch (e) {
		return c.text(`Failed to delete subscription: ${(e as any).message}`, 500);
	}
});

// API: Manual Sync & Summarize
app.get('/api/email-sync', async (c) => {
	try {
		const instance = await c.env.OAKTREE_SYNC_WORKFLOW.create({
			id: `manual-email-sync-${Date.now()}`,
			params: {
				syncEmails: true,
				generateEmailDigests: true,
				emailDigestsManual: true,
				syncFacebookPosts: true,
			}
		});
		return c.text(`Email sync started via Workflow: ${instance.id}`);
	} catch (e) {
		return c.text(`Failed to start email sync workflow: ${(e as any).message}`, 500);
	}
});

// API: Test Email Sync & Digest (Synchronous)
app.get('/api/test-email-digest', async (c) => {
	try {
		console.log('Starting manual test email digest...');
		await generateEmailDigests(c.env, true);
		console.log('Syncing and processing Facebook posts...');
		const postedCount = await syncAndProcessFacebookPosts(c.env);
		return c.json({
			success: true,
			message: `Email digest generation completed successfully. Processed ${postedCount} Facebook posts.`
		});
	} catch (e) {
		return c.json({
			success: false,
			error: (e as any).message
		}, 500);
	}
});

// API: Test Facebook Posting (Manual Trigger)
app.post('/api/test-facebook-post', async (c) => {
	try {
		console.log('Manually triggering Facebook post sync & process...');
		// Auto-reset failed posts in the last 24 hours for easy testing
		await c.env.DB.prepare(
			"UPDATE facebook_posts SET status = 'pending', error_message = NULL WHERE status = 'failed' AND created_at > datetime('now', '-1 day')"
		).run();
		const count = await syncAndProcessFacebookPosts(c.env);
		return c.json({
			success: true,
			message: `Sync and process completed. Processed ${count} posts.`
		});
	} catch (e) {
		return c.json({
			success: false,
			error: (e as any).message
		}, 500);
	}
});

// API: Mark Email Digest as Read
app.post('/api/email-digests/mark-read', async (c) => {
	try {
		const { id } = await c.req.json() as any;
		if (!id) {
			return c.json({ error: 'Missing digest ID' }, 400);
		}
		await c.env.DB.prepare(
			'UPDATE email_digests SET is_readed = 1 WHERE id = ?'
		).bind(id).run();
		return c.json({ success: true, message: 'Digest marked as read' });
	} catch (e) {
		return c.json({ error: (e as any).message }, 500);
	}
});

// API: Get Email Digests
app.get('/api/email-digests', async (c) => {
	try {
		const { results } = await c.env.DB.prepare(
			'SELECT id, category, summary, key_takeaways, source_emails, digest_date, is_readed, CAST(strftime(\'%s\', created_at) as INTEGER) as created_at FROM email_digests WHERE is_readed = 0 ORDER BY created_at DESC LIMIT 50'
		).all();
		return c.json(results || []);
	} catch (e) {
		return c.json({ error: (e as any).message }, 500);
	}
});

// Fallback for non-matching API routes
app.notFound((c) => {
	return c.text("Oaktree Agent Backend Running");
});

export default {
	fetch: app.fetch,

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
		console.log("Running scheduled worker tasks via Workflow...");
		const hour = new Date().getUTCHours();
		const isSixHourly = hour % 6 === 0;

		ctx.waitUntil((async () => {
			try {
				await env.OAKTREE_SYNC_WORKFLOW.create({
					id: `cron-${Date.now()}`,
					params: {
						fetchMarketStats: true,
						checkAlertRules: true,
						syncEmails: true,
						generateEmailDigests: true,
						emailDigestsManual: false,
						runCrawler: isSixHourly,
						generateDailySummaries: isSixHourly,
						fetchMarketEvents: isSixHourly,
						sendDailyEmailReport: isSixHourly,
						purgeOldData: isSixHourly,
						syncFacebookPosts: true,
					}
				});
				console.log("Workflow instance triggered successfully.");
			} catch (e) {
				console.error("Failed to trigger Workflow instance:", e);
			}
		})());
	},
};
