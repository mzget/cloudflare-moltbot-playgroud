import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { initializeAllTimeRecords } from '../athSeeding';

const watchlist = new Hono<AppEnv>();

// API: Watchlist Operations
watchlist.get('/api/watchlist', async (c) => {
  const { results } = await c.env.DB.prepare(`
		SELECT w.*, 
		       (CASE WHEN (p.symbol IS NOT NULL OR (h.symbol IS NOT NULL AND h.shares > 0)) THEN 1 ELSE 0 END) as in_portfolio,
		       (SELECT COUNT(*) FROM alert_rules ar WHERE ar.symbol = w.symbol AND ar.is_active = 1) as active_alerts_count
		FROM watchlist w
		LEFT JOIN portfolio_holdings p ON w.symbol = p.symbol
		LEFT JOIN holdings h ON w.symbol = h.symbol
	`).all();
  return c.json(results);
});

watchlist.post('/api/watchlist', async (c) => {
  const { symbol, name, type } = await c.req.json() as any;
  const symbolType = type || 'stock';
  const upperSymbol = (symbol || '').toUpperCase();

  // 1. Check if the symbol already exists
  const existing = await c.env.DB.prepare('SELECT symbol FROM watchlist WHERE UPPER(symbol) = ?')
    .bind(upperSymbol).first();

  if (!existing) {
    // 2. Check if total count is >= 100
    const { count } = await c.env.DB.prepare('SELECT COUNT(*) as count FROM watchlist').first() as { count: number };
    if (count >= 100) {
      return c.json({ error: 'Watchlist limit reached. Maximum 100 symbols allowed.' }, 400);
    }
  }

  await c.env.DB.prepare('INSERT OR IGNORE INTO watchlist (symbol, name, type) VALUES (?, ?, ?)')
    .bind(symbol, name, symbolType).run();

  // Seed ATH/ATL records for this stock asynchronously
  const fmpKey = c.env.FMP_API_KEY;
  if (fmpKey && symbol) {
    c.executionCtx.waitUntil(
      initializeAllTimeRecords(c.env.DB, symbol, fmpKey)
        .catch(err => console.error(`Failed to initialize ATH/ATL for ${symbol}:`, err))
    );
  }

  return c.text('Symbol added');
});

watchlist.put('/api/watchlist', async (c) => {
  const { symbol, is_active, in_portfolio, name, type, sector_label, sector_label_color } = await c.req.json() as any;
  if (is_active !== undefined) {
    await c.env.DB.prepare('UPDATE watchlist SET is_active = ? WHERE symbol = ?')
      .bind(is_active ? 1 : 0, symbol).run();
  }
  if (name !== undefined) {
    await c.env.DB.prepare('UPDATE watchlist SET name = ? WHERE symbol = ?')
      .bind(name, symbol).run();
  }
  if (type !== undefined) {
    await c.env.DB.prepare('UPDATE watchlist SET type = ? WHERE symbol = ?')
      .bind(type, symbol).run();
  }
  if (sector_label !== undefined) {
    await c.env.DB.prepare('UPDATE watchlist SET sector_label = ? WHERE symbol = ?')
      .bind(sector_label || null, symbol).run();
  }
  if (sector_label_color !== undefined) {
    await c.env.DB.prepare('UPDATE watchlist SET sector_label_color = ? WHERE symbol = ?')
      .bind(sector_label_color || null, symbol).run();
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

watchlist.delete('/api/watchlist', async (c) => {
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

export default watchlist;
