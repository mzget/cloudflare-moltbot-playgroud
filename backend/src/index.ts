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
import { recordDailyPortfolioHistory, getPortfolioHistory } from './portfolioHistory';
import { sortTransactions } from './portfolioUtils';
import { calculatePerformanceComparison } from './historicalPrices';


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
	IS_LOCAL?: string;
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
							   path === '/api/auth/user/login-url' || 
							   path === '/api/auth/user/callback' || 
							   path === '/api/test-facebook-post';
	
	if (!isUnprotectedRoute) {
		const jwtSecret = c.env.JWT_SECRET || 'dev-secret-key-123456';
		let user = await checkAuth(c.req.raw, jwtSecret);
		
		// Bypass authentication in local development mode
		if (!user && c.env.IS_LOCAL === 'true') {
			user = {
				email: 'local@example.com',
				name: 'Local User',
				picture: ''
			};
		}
		
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


// Helper: Recalculate holdings aggregate from share_lots
async function recalcHoldings(db: any, symbol: string) {
  const { results } = await db.prepare(
    'SELECT SUM(shares) as total_shares, SUM(total_cost) as total_cost FROM share_lots WHERE symbol = ?'
  ).bind(symbol).all();
  const row = results?.[0] as any;
  const totalShares = row?.total_shares || 0;
  const totalCost = row?.total_cost || 0;
  const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
  const status = totalShares > 0 ? 'Open' : 'Closed';
  
  await db.prepare(`
    INSERT INTO holdings (symbol, shares, avg_cost, total_cost, status)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET
      shares = excluded.shares,
      avg_cost = excluded.avg_cost,
      total_cost = excluded.total_cost,
      status = excluded.status,
      updated_at = strftime('%s', 'now')
  `).bind(symbol, totalShares, avgCost, totalCost, status).run();

  // Also ensure symbol is in watchlist
  await db.prepare(`
    INSERT OR IGNORE INTO watchlist (symbol, name, is_active)
    VALUES (?, ?, 1)
  `).bind(symbol, symbol).run();
}

// ===== PORTFOLIO API =====

// GET /api/portfolio/holdings - All holdings with computed gains
app.get('/api/portfolio/holdings', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT 
      h.symbol, h.shares, h.avg_cost, h.total_cost, h.status,
      w.name,
      m.price as last_price, m.previous_close, m.market_cap, m.p_e,
      COALESCE(d.total_dividends, 0) as tot_div_income,
      COALESCE(t.realized_gain_sum, 0) as realized_gain_amt,
      COALESCE(t.realized_cost_basis, 0) as realized_cost_basis
    FROM holdings h
    LEFT JOIN watchlist w ON h.symbol = w.symbol
    LEFT JOIN market_stats m ON h.symbol = m.symbol
    LEFT JOIN (
      SELECT symbol, SUM(amount) as total_dividends FROM dividends GROUP BY symbol
    ) d ON h.symbol = d.symbol
    LEFT JOIN (
      SELECT symbol, 
        SUM(CASE WHEN type = 'Sell' THEN realized_gain_amt ELSE 0 END) as realized_gain_sum,
        SUM(CASE WHEN type = 'Sell' THEN total_cost ELSE 0 END) as realized_cost_basis
      FROM transactions GROUP BY symbol
    ) t ON h.symbol = t.symbol
    ORDER BY h.symbol ASC
  `).all();

  // Compute derived fields
  const holdings = (results || []).map((row: any) => {
    const shares = row.shares || 0;
    const lastPrice = row.last_price;
    const avgCost = row.avg_cost;
    const totalCost = row.total_cost || (shares * (avgCost || 0));
    const marketValue = lastPrice ? shares * lastPrice : null;
    const prevClose = row.previous_close;
    
    // Day gain
    const dayGainPct = (lastPrice && prevClose && prevClose > 0) 
      ? ((lastPrice - prevClose) / prevClose) * 100 : null;
    const dayGainAmt = (lastPrice && prevClose) 
      ? shares * (lastPrice - prevClose) : null;
    
    // Total unrealized gain
    const totGainAmt = (marketValue !== null && totalCost) 
      ? marketValue - totalCost : null;
    const totGainPct = (totGainAmt !== null && totalCost && totalCost > 0) 
      ? (totGainAmt / totalCost) * 100 : null;
    
    // Realized gain percentage
    const realizedGainAmt = row.realized_gain_amt || 0;
    const realizedCostBasis = row.realized_cost_basis || 0;
    const realizedGainPct = realizedCostBasis > 0 
      ? (realizedGainAmt / realizedCostBasis) * 100 : null;

    return {
      symbol: row.symbol,
      name: row.name || row.symbol,
      status: row.status || 'Open',
      shares,
      last_price: lastPrice,
      avg_cost: avgCost,
      total_cost: totalCost,
      market_value: marketValue,
      tot_div_income: row.tot_div_income,
      day_gain_pct: dayGainPct,
      day_gain_amt: dayGainAmt,
      tot_gain_pct: totGainPct,
      tot_gain_amt: totGainAmt,
      realized_gain_pct: realizedGainPct,
      realized_gain_amt: realizedGainAmt,
    };
  });

  return c.json(holdings);
});

// GET /api/portfolio/summary - Portfolio totals
app.get('/api/portfolio/summary', async (c) => {
  const rate = parseFloat(c.req.query('rate') || '36.5');
  
  // 1. Fetch stocks
  const { results: stockResults } = await c.env.DB.prepare(`
    SELECT 
      h.symbol, h.shares, h.avg_cost, h.total_cost,
      m.price as last_price, m.previous_close,
      COALESCE(d.total_dividends, 0) as tot_div_income
    FROM holdings h
    LEFT JOIN market_stats m ON h.symbol = m.symbol
    LEFT JOIN (
      SELECT symbol, SUM(amount) as total_dividends FROM dividends GROUP BY symbol
    ) d ON h.symbol = d.symbol
    WHERE h.status != 'Closed'
  `).all();

  let stockMarketValueUsd = 0;
  let stockCostUsd = 0;
  let stockDayChangeUsd = 0;
  let stockDividendsUsd = 0;

  for (const row of (stockResults || []) as any[]) {
    const shares = row.shares || 0;
    const price = row.last_price || 0;
    const prevClose = row.previous_close || price;
    const cost = row.total_cost || 0;
    
    stockMarketValueUsd += shares * price;
    stockCostUsd += cost;
    stockDayChangeUsd += shares * (price - prevClose);
    stockDividendsUsd += row.tot_div_income || 0;
  }

  // 2. Fetch fund allocations total
  const { results: fundResults } = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_funds FROM fund_allocations
  `).all();
  const totalFundsThb = (fundResults?.[0] as any)?.total_funds || 0;

  // 3. Fetch manual broker overrides total cost & balance (excluding the main auto-calculated ones to avoid double counting)
  const { results: manualResults } = await c.env.DB.prepare(`
    SELECT 
      COALESCE(SUM(cost_override), 0) as total_cost_override,
      COALESCE(SUM(balance_override), 0) as total_balance_override
    FROM manual_broker_balances
    WHERE broker_name NOT IN ('Common Stock', 'Finnomena', 'Krungsri')
  `).all();
  const manualCostThb = (manualResults?.[0] as any)?.total_cost_override || 0;
  const manualBalanceThb = (manualResults?.[0] as any)?.total_balance_override || 0;

  // Fetch all overrides to adjust main broker calculations if overridden
  const { results: allOverrides } = await c.env.DB.prepare(`
    SELECT * FROM manual_broker_balances
  `).all();
  const overridesMap = new Map((allOverrides || []).map((row: any) => [row.broker_name, row]));

  // Calculate final THB values
  let totalMarketValueThb = (stockMarketValueUsd * rate) + totalFundsThb + manualBalanceThb;
  let totalCostThb = (stockCostUsd * rate) + totalFundsThb + manualCostThb;
  let totalDayChangeThb = stockDayChangeUsd * rate;
  let totalDividendsThb = stockDividendsUsd * rate;

  // Adjust for any overrides of the main brokers
  const commonStockOverride = overridesMap.get('Common Stock') as any;
  if (commonStockOverride) {
    if (commonStockOverride.cost_override !== null && commonStockOverride.cost_override !== undefined) {
      totalCostThb = totalCostThb - (stockCostUsd * rate) + commonStockOverride.cost_override;
    }
    if (commonStockOverride.balance_override !== null && commonStockOverride.balance_override !== undefined) {
      totalMarketValueThb = totalMarketValueThb - (stockMarketValueUsd * rate) + commonStockOverride.balance_override;
    }
  }

  const krungsriOverride = overridesMap.get('Krungsri') as any;
  if (krungsriOverride) {
    const { results: kFunds } = await c.env.DB.prepare(`
      SELECT COALESCE(SUM(a.amount), 0) as amt 
      FROM fund_allocations a 
      JOIN portfolio_funds f ON a.fund_id = f.id 
      WHERE f.broker_name = 'Krungsri'
    `).all();
    const kAmt = (kFunds?.[0] as any)?.amt || 0;
    if (krungsriOverride.cost_override !== null && krungsriOverride.cost_override !== undefined) {
      totalCostThb = totalCostThb - kAmt + krungsriOverride.cost_override;
    }
    if (krungsriOverride.balance_override !== null && krungsriOverride.balance_override !== undefined) {
      totalMarketValueThb = totalMarketValueThb - kAmt + krungsriOverride.balance_override;
    }
  }

  const finnomenaOverride = overridesMap.get('Finnomena') as any;
  if (finnomenaOverride) {
    const { results: fFunds } = await c.env.DB.prepare(`
      SELECT COALESCE(SUM(a.amount), 0) as amt 
      FROM fund_allocations a 
      JOIN portfolio_funds f ON a.fund_id = f.id 
      WHERE f.broker_name = 'Finnomena'
    `).all();
    const fAmt = (fFunds?.[0] as any)?.amt || 0;
    if (finnomenaOverride.cost_override !== null && finnomenaOverride.cost_override !== undefined) {
      totalCostThb = totalCostThb - fAmt + finnomenaOverride.cost_override;
    }
    if (finnomenaOverride.balance_override !== null && finnomenaOverride.balance_override !== undefined) {
      totalMarketValueThb = totalMarketValueThb - fAmt + finnomenaOverride.balance_override;
    }
  }

  // Get realized gains
  const { results: txResults } = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(realized_gain_amt), 0) as total_realized
    FROM transactions WHERE type = 'Sell'
  `).all();
  const totalRealizedUsd = (txResults?.[0] as any)?.total_realized || 0;
  const totalRealizedThb = totalRealizedUsd * rate;

  const unrealizedGainThb = totalMarketValueThb - totalCostThb;
  const unrealizedGainPct = totalCostThb > 0 ? (unrealizedGainThb / totalCostThb) * 100 : 0;
  const dayChangePct = (totalMarketValueThb - totalDayChangeThb) > 0 
    ? (totalDayChangeThb / (totalMarketValueThb - totalDayChangeThb)) * 100 : 0;

  // Calculate stock-only values (in USD)
  let stockMarketValueUsdFinal = stockMarketValueUsd;
  let stockCostUsdFinal = stockCostUsd;
  const stockDayChangeUsdFinal = stockDayChangeUsd;
  const stockDividendsUsdFinal = stockDividendsUsd;

  if (commonStockOverride) {
    if (commonStockOverride.cost_override !== null && commonStockOverride.cost_override !== undefined) {
      stockCostUsdFinal = commonStockOverride.cost_override / rate;
    }
    if (commonStockOverride.balance_override !== null && commonStockOverride.balance_override !== undefined) {
      stockMarketValueUsdFinal = commonStockOverride.balance_override / rate;
    }
  }

  const stockUnrealizedGainUsd = stockMarketValueUsdFinal - stockCostUsdFinal;
  const stockUnrealizedGainPct = stockCostUsdFinal > 0 ? (stockUnrealizedGainUsd / stockCostUsdFinal) * 100 : 0;
  const stockDayChangePct = (stockMarketValueUsdFinal - stockDayChangeUsdFinal) > 0 
    ? (stockDayChangeUsdFinal / (stockMarketValueUsdFinal - stockDayChangeUsdFinal)) * 100 : 0;

  // Record history snapshot in background
  c.executionCtx.waitUntil(recordDailyPortfolioHistory(c.env.DB));

  return c.json({
    total_market_value: totalMarketValueThb,
    total_cost: totalCostThb,
    cash: 0,
    day_change_amt: totalDayChangeThb,
    day_change_pct: dayChangePct,
    unrealized_gain_amt: unrealizedGainThb,
    unrealized_gain_pct: unrealizedGainPct,
    realized_gain_amt: totalRealizedThb,
    total_dividends: totalDividendsThb,
    is_thb: true,
    stocks: {
      total_market_value: stockMarketValueUsdFinal,
      total_cost: stockCostUsdFinal,
      day_change_amt: stockDayChangeUsdFinal,
      day_change_pct: stockDayChangePct,
      unrealized_gain_amt: stockUnrealizedGainUsd,
      unrealized_gain_pct: stockUnrealizedGainPct,
      realized_gain_amt: totalRealizedUsd,
      total_dividends: stockDividendsUsdFinal
    }
  });
});

// GET /api/portfolio/history - Historical portfolio values
app.get('/api/portfolio/history', async (c) => {
  try {
    const history = await getPortfolioHistory(c.env.DB);
    return c.json(history);
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// GET /api/portfolio/performance-comparison - Compare portfolio performance with S&P 500
app.get('/api/portfolio/performance-comparison', async (c) => {
  try {
    const timeframe = c.req.query('timeframe') || '1y';
    const result = await calculatePerformanceComparison(c.env.DB, timeframe);
    return c.json(result);
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// POST /api/portfolio/import - Bulk import transactions from CSV (parsed frontend JSON)
app.post('/api/portfolio/import', async (c) => {
  try {
    const transactions = await c.req.json() as any[];
    if (!Array.isArray(transactions)) {
      return c.json({ error: 'Invalid payload, expected array of transactions' }, 400);
    }

    // Sort transactions chronologically to ensure FIFO lot matching behaves correctly
    const sortedTransactions = sortTransactions(transactions);

    const affectedSymbols = new Set<string>();

    for (const tx of sortedTransactions) {
      if (!tx.symbol || !tx.date || isNaN(parseFloat(tx.shares)) || isNaN(parseFloat(tx.price))) {
        continue;
      }

      const symbol = tx.symbol.trim().toUpperCase();
      const date = tx.date;
      const type = tx.type || 'Buy';
      const shares = parseFloat(tx.shares);
      const price = parseFloat(tx.price);
      const commission = parseFloat(tx.commission) || 0;
      const note = tx.note || null;

      affectedSymbols.add(symbol);

      const totalCost = type === 'Sell'
        ? (shares * price) - commission
        : (shares * price) + commission;

      // 1. Record the transaction
      await c.env.DB.prepare(`
        INSERT INTO transactions (symbol, date, type, shares, cost_per_share, commission, total_cost, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(symbol, date, type, shares, price, commission, totalCost, note).run();

      if (type === 'Buy') {
        // 2. Add buy lot
        await c.env.DB.prepare(`
          INSERT INTO share_lots (symbol, date, shares, cost_per_share, total_cost, note)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(symbol, date, shares, price, totalCost, note).run();
      } else if (type === 'Sell') {
        // 3. FIFO deduct lots
        const { results: lots } = await c.env.DB.prepare(`
          SELECT * FROM share_lots WHERE symbol = ? AND shares > 0 ORDER BY date ASC
        `).bind(symbol).all();

        let remainingToSell = shares;
        for (const lot of (lots || []) as any[]) {
          if (remainingToSell <= 0) break;

          const lotShares = lot.shares;
          const lotCostBasisPerShare = lot.total_cost && lot.shares > 0
            ? lot.total_cost / lot.shares
            : lot.cost_per_share;

          if (lotShares <= remainingToSell) {
            const proportionalSellComm = (lotShares / shares) * commission;
            const realizedAmt = (lotShares * price - proportionalSellComm) - (lotShares * lotCostBasisPerShare);
            const realizedPct = lotCostBasisPerShare > 0 ? (realizedAmt / (lotShares * lotCostBasisPerShare)) * 100 : 0;

            await c.env.DB.prepare(`
              UPDATE transactions 
              SET realized_gain_amt = COALESCE(realized_gain_amt, 0) + ?,
                  realized_gain_pct = ?
              WHERE symbol = ? AND date = ? AND type = 'Sell' AND shares = ?
            `).bind(realizedAmt, realizedPct, symbol, date, shares).run();

            await c.env.DB.prepare('DELETE FROM share_lots WHERE id = ?').bind(lot.id).run();
            remainingToSell -= lotShares;
          } else {
            const proportionalSellComm = (remainingToSell / shares) * commission;
            const realizedAmt = (remainingToSell * price - proportionalSellComm) - (remainingToSell * lotCostBasisPerShare);
            const realizedPct = lotCostBasisPerShare > 0 ? (realizedAmt / (remainingToSell * lotCostBasisPerShare)) * 100 : 0;

            await c.env.DB.prepare(`
              UPDATE transactions 
              SET realized_gain_amt = COALESCE(realized_gain_amt, 0) + ?,
                  realized_gain_pct = ?
              WHERE symbol = ? AND date = ? AND type = 'Sell' AND shares = ?
            `).bind(realizedAmt, realizedPct, symbol, date, shares).run();

            const newShares = lotShares - remainingToSell;
            const newCost = newShares * lotCostBasisPerShare;
            await c.env.DB.prepare(`
              UPDATE share_lots 
              SET shares = ?, total_cost = ? 
              WHERE id = ?
            `).bind(newShares, newCost, lot.id).run();
            remainingToSell = 0;
          }
        }
      }
    }

    // Recalculate positions
    for (const symbol of affectedSymbols) {
      await recalcHoldings(c.env.DB, symbol);
    }

    return c.json({ success: true, count: transactions.length });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});



// POST /api/portfolio/holdings - Add new holding
app.post('/api/portfolio/holdings', async (c) => {
  const body = await c.req.json();
  const { symbol, shares, avg_cost, commission, status } = body;
  if (!symbol) return c.json({ error: 'Symbol is required' }, 400);

  const sym = symbol.toUpperCase();
  const numShares = parseFloat(shares) || 0;
  const avgCost = avg_cost !== undefined && avg_cost !== null ? parseFloat(avg_cost) : null;
  const comm = parseFloat(commission) || 0;

  // Check if symbol is in holdings already
  const existingHolding = await c.env.DB.prepare('SELECT 1 FROM holdings WHERE symbol = ?').bind(sym).first();
  const isAlreadyInHoldings = !!existingHolding;

  if (isAlreadyInHoldings) {
    // === Add Transaction Logic ===
    if (numShares > 0 && avgCost !== null) {
      const dateStr = new Date().toISOString().split('T')[0];
      const lotTotalCost = (numShares * avgCost) + comm;

      // Add buy lot
      await c.env.DB.prepare(`
        INSERT INTO share_lots (symbol, date, shares, cost_per_share, total_cost, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(sym, dateStr, numShares, avgCost, lotTotalCost, 'Additional Position').run();

      // Add buy transaction
      await c.env.DB.prepare(`
        INSERT INTO transactions (symbol, date, type, shares, cost_per_share, commission, total_cost, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(sym, dateStr, 'Buy', numShares, avgCost, comm, lotTotalCost, 'Additional Position').run();

      // Recalculate holdings
      await recalcHoldings(c.env.DB, sym);
    }
  } else {
    // === Add New Holding Logic ===
    // Check if symbol exists in watchlist
    const watchlistEntry = await c.env.DB.prepare('SELECT * FROM watchlist WHERE symbol = ?').bind(sym).first();
    if (watchlistEntry) {
      // If in watchlist, ensure is_active is 1
      await c.env.DB.prepare('UPDATE watchlist SET is_active = 1 WHERE symbol = ?').bind(sym).run();
    } else {
      // If not in watchlist, insert it
      await c.env.DB.prepare(`
        INSERT INTO watchlist (symbol, name, is_active)
        VALUES (?, ?, 1)
      `).bind(sym, sym).run();
    }

    if (numShares > 0 && avgCost !== null) {
      const dateStr = new Date().toISOString().split('T')[0];
      const lotTotalCost = (numShares * avgCost) + comm;

      // Add buy lot
      await c.env.DB.prepare(`
        INSERT INTO share_lots (symbol, date, shares, cost_per_share, total_cost, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(sym, dateStr, numShares, avgCost, lotTotalCost, 'Initial Position').run();

      // Add buy transaction
      await c.env.DB.prepare(`
        INSERT INTO transactions (symbol, date, type, shares, cost_per_share, commission, total_cost, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(sym, dateStr, 'Buy', numShares, avgCost, comm, lotTotalCost, 'Initial Position').run();

      // Recalculate holdings
      await recalcHoldings(c.env.DB, sym);
    } else {
      // Just insert empty holding if shares is 0
      await c.env.DB.prepare(`
        INSERT INTO holdings (symbol, shares, avg_cost, total_cost, status)
        VALUES (?, 0, NULL, 0, ?)
        ON CONFLICT(symbol) DO UPDATE SET
          shares = excluded.shares,
          avg_cost = excluded.avg_cost,
          total_cost = excluded.total_cost,
          status = excluded.status,
          updated_at = strftime('%s', 'now')
      `).bind(sym, status || 'Open').run();
    }
  }

  return c.json({ success: true });
});

// PUT /api/portfolio/holdings/:symbol - Update holding
app.put('/api/portfolio/holdings/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const body = await c.req.json();
  const { shares, avg_cost, status } = body;
  const totalCost = (shares || 0) * (avg_cost || 0);
  
  await c.env.DB.prepare(`
    UPDATE holdings SET shares = ?, avg_cost = ?, total_cost = ?, status = ?, updated_at = strftime('%s', 'now')
    WHERE symbol = ?
  `).bind(shares || 0, avg_cost || null, totalCost, status || 'Open', symbol).run();

  return c.json({ success: true });
});

// DELETE /api/portfolio/holdings/:symbol
app.delete('/api/portfolio/holdings/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  await c.env.DB.prepare('DELETE FROM holdings WHERE symbol = ?').bind(symbol).run();
  await c.env.DB.prepare('DELETE FROM share_lots WHERE symbol = ?').bind(symbol).run();
  await c.env.DB.prepare('DELETE FROM transactions WHERE symbol = ?').bind(symbol).run();
  await c.env.DB.prepare('DELETE FROM dividends WHERE symbol = ?').bind(symbol).run();
  return c.json({ success: true });
});

// GET /api/portfolio/lots/:symbol
app.get('/api/portfolio/lots/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM share_lots WHERE symbol = ? ORDER BY date DESC'
  ).bind(symbol).all();
  return c.json(results || []);
});

// POST /api/portfolio/lots
app.post('/api/portfolio/lots', async (c) => {
  const body = await c.req.json();
  const { symbol, date, shares, cost_per_share, low_limit, high_limit, note } = body;
  if (!symbol || !date || !shares || !cost_per_share) {
    return c.json({ error: 'symbol, date, shares, cost_per_share are required' }, 400);
  }
  const totalCost = shares * cost_per_share;
  
  await c.env.DB.prepare(`
    INSERT INTO share_lots (symbol, date, shares, cost_per_share, total_cost, low_limit, high_limit, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(symbol.toUpperCase(), date, shares, cost_per_share, totalCost, low_limit || null, high_limit || null, note || null).run();

  // Recalculate holdings aggregate
  await recalcHoldings(c.env.DB, symbol.toUpperCase());

  return c.json({ success: true });
});

// DELETE /api/portfolio/lots/:id
app.delete('/api/portfolio/lots/:id', async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare('SELECT symbol FROM share_lots WHERE id = ?').bind(id).all();
  const symbol = (results?.[0] as any)?.symbol;
  await c.env.DB.prepare('DELETE FROM share_lots WHERE id = ?').bind(id).run();
  if (symbol) await recalcHoldings(c.env.DB, symbol);
  return c.json({ success: true });
});

// GET /api/portfolio/transactions/:symbol
app.get('/api/portfolio/transactions/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM transactions WHERE symbol = ? ORDER BY date DESC'
  ).bind(symbol).all();
  return c.json(results || []);
});

// POST /api/portfolio/transactions
app.post('/api/portfolio/transactions', async (c) => {
  const body = await c.req.json();
  const { symbol, date, type, shares, cost_per_share, commission, realized_gain_pct, realized_gain_amt, note } = body;
  if (!symbol || !date || !shares || !cost_per_share) {
    return c.json({ error: 'symbol, date, shares, cost_per_share are required' }, 400);
  }
  const totalCost = type === 'Sell'
    ? (shares * cost_per_share) - (commission || 0)
    : (shares * cost_per_share) + (commission || 0);
  
  await c.env.DB.prepare(`
    INSERT INTO transactions (symbol, date, type, shares, cost_per_share, commission, total_cost, realized_gain_pct, realized_gain_amt, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(symbol.toUpperCase(), date, type || 'Buy', shares, cost_per_share, commission || 0, totalCost, realized_gain_pct || null, realized_gain_amt || null, note || null).run();

  return c.json({ success: true });
});

// DELETE /api/portfolio/transactions/:id
app.delete('/api/portfolio/transactions/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// GET /api/portfolio/dividends/:symbol
app.get('/api/portfolio/dividends/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM dividends WHERE symbol = ? ORDER BY date DESC'
  ).bind(symbol).all();
  return c.json(results || []);
});

// POST /api/portfolio/dividends
app.post('/api/portfolio/dividends', async (c) => {
  const body = await c.req.json();
  const { symbol, date, amount, per_share, note } = body;
  if (!symbol || !date || !amount) {
    return c.json({ error: 'symbol, date, amount are required' }, 400);
  }
  
  await c.env.DB.prepare(`
    INSERT INTO dividends (symbol, date, amount, per_share, note)
    VALUES (?, ?, ?, ?, ?)
  `).bind(symbol.toUpperCase(), date, amount, per_share || null, note || null).run();

  return c.json({ success: true });
});

// DELETE /api/portfolio/dividends/:id
app.delete('/api/portfolio/dividends/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM dividends WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// GET /api/portfolio/history/yearly
app.get('/api/portfolio/history/yearly', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM portfolio_history ORDER BY year ASC'
  ).all();
  return c.json(results || []);
});

// POST /api/portfolio/history/yearly
app.post('/api/portfolio/history/yearly', async (c) => {
  const body = await c.req.json();
  const { year, capital, balance, total_gain_pct, remark } = body;
  if (!year) return c.json({ error: 'Year is required' }, 400);
  
  await c.env.DB.prepare(`
    INSERT INTO portfolio_history (year, capital, balance, total_gain_pct, remark)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(year) DO UPDATE SET
      capital = excluded.capital,
      balance = excluded.balance,
      total_gain_pct = excluded.total_gain_pct,
      remark = excluded.remark
  `).bind(year, capital || 0, balance || 0, total_gain_pct || 0, remark || '').run();
  
  return c.json({ success: true });
});

// DELETE /api/portfolio/history/yearly/:year
app.delete('/api/portfolio/history/yearly/:year', async (c) => {
  const year = c.req.param('year');
  await c.env.DB.prepare('DELETE FROM portfolio_history WHERE year = ?').bind(year).run();
  return c.json({ success: true });
});

// GET /api/portfolio/tax-savings
app.get('/api/portfolio/tax-savings', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM tax_savings ORDER BY year ASC'
  ).all();
  return c.json(results || []);
});

// POST /api/portfolio/tax-savings
app.post('/api/portfolio/tax-savings', async (c) => {
  const body = await c.req.json();
  const { year, ltf, rmf, ssf } = body;
  if (!year) return c.json({ error: 'Year is required' }, 400);
  
  await c.env.DB.prepare(`
    INSERT INTO tax_savings (year, ltf, rmf, ssf)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(year) DO UPDATE SET
      ltf = excluded.ltf,
      rmf = excluded.rmf,
      ssf = excluded.ssf
  `).bind(year, ltf || 0, rmf || 0, ssf || 0).run();
  
  return c.json({ success: true });
});

// DELETE /api/portfolio/tax-savings/:year
app.delete('/api/portfolio/tax-savings/:year', async (c) => {
  const year = c.req.param('year');
  await c.env.DB.prepare('DELETE FROM tax_savings WHERE year = ?').bind(year).run();
  return c.json({ success: true });
});

// GET /api/portfolio/funds
app.get('/api/portfolio/funds', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM portfolio_funds ORDER BY id ASC'
  ).all();
  return c.json(results || []);
});

// POST /api/portfolio/funds
app.post('/api/portfolio/funds', async (c) => {
  const body = await c.req.json();
  const { id, name, broker_name } = body;
  if (!name || !broker_name) return c.json({ error: 'name and broker_name are required' }, 400);
  
  if (id) {
    await c.env.DB.prepare(`
      UPDATE portfolio_funds SET name = ?, broker_name = ? WHERE id = ?
    `).bind(name, broker_name, id).run();
  } else {
    await c.env.DB.prepare(`
      INSERT INTO portfolio_funds (name, broker_name) VALUES (?, ?)
    `).bind(name, broker_name).run();
  }
  return c.json({ success: true });
});

// DELETE /api/portfolio/funds/:id
app.delete('/api/portfolio/funds/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM portfolio_funds WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// GET /api/portfolio/categories
app.get('/api/portfolio/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM asset_categories ORDER BY id ASC'
  ).all();
  return c.json(results || []);
});

// POST /api/portfolio/categories
app.post('/api/portfolio/categories', async (c) => {
  const body = await c.req.json();
  const { id, name, target_weight } = body;
  if (!name) return c.json({ error: 'name is required' }, 400);
  
  if (id) {
    await c.env.DB.prepare(`
      UPDATE asset_categories SET name = ?, target_weight = ? WHERE id = ?
    `).bind(name, target_weight || 0, id).run();
  } else {
    await c.env.DB.prepare(`
      INSERT INTO asset_categories (name, target_weight) VALUES (?, ?)
    `).bind(name, target_weight || 0).run();
  }
  return c.json({ success: true });
});

// DELETE /api/portfolio/categories/:id
app.delete('/api/portfolio/categories/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM asset_categories WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// GET /api/portfolio/fund-allocations
app.get('/api/portfolio/fund-allocations', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT category_id, fund_id, amount FROM fund_allocations
  `).all();
  return c.json(results || []);
});

// POST /api/portfolio/fund-allocations
app.post('/api/portfolio/fund-allocations', async (c) => {
  const allocations = await c.req.json();
  if (!Array.isArray(allocations)) return c.json({ error: 'Expected array of allocations' }, 400);
  
  // Clear existing allocations first or do insert or replace
  const statements = allocations.map(a => 
    c.env.DB.prepare('INSERT OR REPLACE INTO fund_allocations (category_id, fund_id, amount) VALUES (?, ?, ?)')
      .bind(a.category_id, a.fund_id, a.amount)
  );
  await c.env.DB.batch(statements);
  return c.json({ success: true });
});

// GET /api/portfolio/brokers
app.get('/api/portfolio/brokers', async (c) => {
  const rate = parseFloat(c.req.query('rate') || '36.5');
  
  // 1. Fetch auto-calculated stock balances per broker from holdings table
  const { results: stockResults } = await c.env.DB.prepare(`
    SELECT 
      h.broker_name,
      SUM(h.total_cost) as cost_usd,
      SUM(h.shares * COALESCE(m.price, 0)) as balance_usd
    FROM holdings h
    LEFT JOIN market_stats m ON h.symbol = m.symbol
    WHERE h.status != 'Closed'
    GROUP BY h.broker_name
  `).all();
  
  // 2. Fetch fund balances per broker
  const { results: fundResults } = await c.env.DB.prepare(`
    SELECT 
      f.broker_name,
      SUM(a.amount) as balance_thb
    FROM fund_allocations a
    JOIN portfolio_funds f ON a.fund_id = f.id
    GROUP BY f.broker_name
  `).all();
  
  // 3. Fetch manual overrides
  const { results: overrideResults } = await c.env.DB.prepare(`
    SELECT * FROM manual_broker_balances
  `).all();
  
  const overrides = new Map((overrideResults || []).map((row: any) => [row.broker_name, row]));
  
  // 4. Combine all brokers
  const brokersMap = new Map<string, { broker_name: string; cost: number; balance: number }>();
  
  // Process stocks (convert USD to THB)
  for (const row of (stockResults || []) as any[]) {
    const broker = row.broker_name || 'Common Stock';
    const cost = (row.cost_usd || 0) * rate;
    const balance = (row.balance_usd || 0) * rate;
    brokersMap.set(broker, { broker_name: broker, cost, balance });
  }
  
  // Process funds (balances are in THB; cost defaults to balance unless overridden)
  for (const row of (fundResults || []) as any[]) {
    const broker = row.broker_name;
    const balance = row.balance_thb || 0;
    const existing = brokersMap.get(broker);
    if (existing) {
      existing.balance += balance;
      existing.cost += balance;
    } else {
      brokersMap.set(broker, { broker_name: broker, cost: balance, balance });
    }
  }
  
  // Apply overrides and ensure manual-only brokers are included
  const allBrokerNames = new Set([
    ...brokersMap.keys(),
    ...overrides.keys()
  ]);
  
  const output = Array.from(allBrokerNames).map(name => {
    const calculated = brokersMap.get(name) || { broker_name: name, cost: 0, balance: 0 };
    const override = overrides.get(name) as any;
    
    let finalCost = calculated.cost;
    let finalBalance = calculated.balance;
    
    if (override) {
      if (override.cost_override !== null && override.cost_override !== undefined) {
        finalCost = override.cost_override;
      }
      if (override.balance_override !== null && override.balance_override !== undefined) {
        finalBalance = override.balance_override;
      }
    }
    
    const gain_amt = finalBalance - finalCost;
    const gain_pct = finalCost > 0 ? (gain_amt / finalCost) * 100 : 0;
    
    return {
      broker_name: name,
      cost: finalCost,
      balance: finalBalance,
      gain_amt,
      gain_pct,
      cost_override: override?.cost_override ?? null,
      balance_override: override?.balance_override ?? null
    };
  });
  
  return c.json(output);
});

// POST /api/portfolio/brokers/override
app.post('/api/portfolio/brokers/override', async (c) => {
  const body = await c.req.json();
  const { broker_name, cost_override, balance_override } = body;
  if (!broker_name) return c.json({ error: 'broker_name is required' }, 400);
  
  await c.env.DB.prepare(`
    INSERT INTO manual_broker_balances (broker_name, cost_override, balance_override)
    VALUES (?, ?, ?)
    ON CONFLICT(broker_name) DO UPDATE SET
      cost_override = excluded.cost_override,
      balance_override = excluded.balance_override
  `).bind(
    broker_name, 
    (cost_override === undefined || cost_override === null || cost_override === '') ? null : parseFloat(cost_override), 
    (balance_override === undefined || balance_override === null || balance_override === '') ? null : parseFloat(balance_override)
  ).run();
  
  return c.json({ success: true });
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
