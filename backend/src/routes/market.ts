import { Hono } from 'hono';
import { cache } from 'hono/cache';
import type { AppEnv } from '../env';

const market = new Hono<AppEnv>();

// API: Trigger Market Events Update Manually (Test)
market.get('/api/crawl-events', async (c) => {
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
market.get('/api/market-events', cache({ cacheName: 'oaktree-market-events', cacheControl: 'max-age=300' }), async (c) => {
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

market.get('/api/market-events/today', async (c) => {
  const targetDate = c.req.query('date') || new Date().toISOString().split('T')[0];
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT id, symbol, event_type, event_date, title, description, metadata
      FROM market_events
      WHERE event_date = ?
    `).bind(targetDate).all();
    return c.json(results || []);
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});


market.delete('/api/market-events', async (c) => {
  try {
    await c.env.DB.prepare("DELETE FROM market_events WHERE created_at < strftime('%s', 'now', '-30 days')").run();
    return c.text('Purged old market events');
  } catch (e) {
    return c.text(`Failed to purge market events: ${(e as any).message}`, 500);
  }
});

// API: Market Intelligence (Watchlist + Stats)
market.get('/api/market-intelligence', cache({ cacheName: 'oaktree-market-intelligence', cacheControl: 'max-age=300' }), async (c) => {
  const { results } = await c.env.DB.prepare(`
		SELECT 
			w.symbol, 
			w.name, 
			'NasdaqGS' as exchange,
			m.market_cap, m.revenues, m.revenue_3y_cagr, m.revenue_1y_growth, m.revenue_5y_cagr,
			m.gross_profit_margin, m.operating_margin, m.ev_ebit, m.ev_sales,
			m.p_ocf, m.p_fcf, m.capex_to_ocf, m.rd_to_revenue, m.debt_equity,
			m.p_e, m.fcf_margin, m.total_cash, m.net_debt, m.total_debt, m.dividend_yield,
			m.gross_margin_quarterly, m.revenue_growth_quarterly_yoy, m.ebit_margin_quarterly,
			m.price, m.updated_at as updated_at
		FROM watchlist w
		LEFT JOIN market_stats m ON w.symbol = m.symbol
		WHERE w.is_active = 1
	`).all();

  return c.json(results);
});

// API: Watchlist Breakouts & Seeding
market.get('/api/market-breakouts', async (c) => {
  const { getWatchlistBreakoutsData } = await import('../marketScanner');
  try {
    const data = await getWatchlistBreakoutsData(c.env.DB);
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

market.get('/api/watchlist-breakouts', async (c) => {
  const { getWatchlistBreakoutsData } = await import('../marketScanner');
  try {
    const data = await getWatchlistBreakoutsData(c.env.DB);
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

market.post('/api/scan-market', async (c) => {
  const fmpKey = c.env.FMP_API_KEY;
  if (!fmpKey) {
    return c.json({ error: 'FMP_API_KEY not configured' }, 400);
  }
  const { scanMarketBreakouts, getWatchlistBreakoutsData } = await import('../marketScanner');
  try {
    await scanMarketBreakouts(c.env.DB, fmpKey, 'watchlist');
    const freshData = await getWatchlistBreakoutsData(c.env.DB);
    return c.json({ success: true, ...freshData });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

market.post('/api/scan-watchlist', async (c) => {
  const fmpKey = c.env.FMP_API_KEY;
  if (!fmpKey) {
    return c.json({ error: 'FMP_API_KEY not configured' }, 400);
  }
  const { scanMarketBreakouts, getWatchlistBreakoutsData } = await import('../marketScanner');
  try {
    await scanMarketBreakouts(c.env.DB, fmpKey, 'watchlist');
    const freshData = await getWatchlistBreakoutsData(c.env.DB);
    return c.json({ success: true, ...freshData });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

market.post('/api/seed-ath', async (c) => {
  const fmpKey = c.env.FMP_API_KEY;
  if (!fmpKey) {
    return c.json({ error: 'FMP_API_KEY not configured' }, 400);
  }
  const { seedAllActiveWatchlist } = await import('../athSeeding');
  try {
    await seedAllActiveWatchlist(c.env.DB, fmpKey);
    return c.json({ success: true, message: 'Watchlist ATH/ATL seeding triggered successfully' });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default market;
