import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { recalcHoldings, rebuildLotsAndRealizedGains } from '../../portfolioRecalc';

const transactions = new Hono<AppEnv>();

// GET /api/portfolio/lots/:symbol
transactions.get('/api/portfolio/lots/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM share_lots WHERE symbol = ? ORDER BY date DESC'
  ).bind(symbol).all();
  return c.json(results || []);
});

// POST /api/portfolio/lots
transactions.post('/api/portfolio/lots', async (c) => {
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
transactions.delete('/api/portfolio/lots/:id', async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare('SELECT symbol FROM share_lots WHERE id = ?').bind(id).all();
  const symbol = (results?.[0] as any)?.symbol;
  await c.env.DB.prepare('DELETE FROM share_lots WHERE id = ?').bind(id).run();
  if (symbol) await recalcHoldings(c.env.DB, symbol);
  return c.json({ success: true });
});

// GET /api/portfolio/transactions/:symbol
transactions.get('/api/portfolio/transactions/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM transactions WHERE symbol = ? ORDER BY date DESC'
  ).bind(symbol).all();
  return c.json(results || []);
});

// POST /api/portfolio/transactions
transactions.post('/api/portfolio/transactions', async (c) => {
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

  await rebuildLotsAndRealizedGains(c.env.DB, symbol);

  return c.json({ success: true });
});

// PUT /api/portfolio/transactions/:id
transactions.put('/api/portfolio/transactions/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { date, type, shares, cost_per_share, commission, note } = body;

  if (!date || !shares || !cost_per_share) {
    return c.json({ error: 'date, shares, cost_per_share are required' }, 400);
  }

  // 1. Get the transaction to find its symbol
  const tx = await c.env.DB.prepare('SELECT symbol FROM transactions WHERE id = ?').bind(id).first();
  if (!tx) {
    return c.json({ error: 'Transaction not found' }, 404);
  }
  const symbol = tx.symbol as string;

  // 2. Compute total cost
  const totalCost = type === 'Sell'
    ? (shares * cost_per_share) - (commission || 0)
    : (shares * cost_per_share) + (commission || 0);

  // 3. Update transaction details
  await c.env.DB.prepare(`
    UPDATE transactions
    SET date = ?, type = ?, shares = ?, cost_per_share = ?, commission = ?, total_cost = ?, note = ?
    WHERE id = ?
  `).bind(date, type || 'Buy', shares, cost_per_share, commission || 0, totalCost, note || null, id).run();

  // 4. Rebuild share lots and update realized gains FIFO-style
  await rebuildLotsAndRealizedGains(c.env.DB, symbol);

  return c.json({ success: true });
});

// DELETE /api/portfolio/transactions/symbol/:symbol
transactions.delete('/api/portfolio/transactions/symbol/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  await c.env.DB.prepare('DELETE FROM transactions WHERE symbol = ?').bind(symbol).run();
  await rebuildLotsAndRealizedGains(c.env.DB, symbol);
  return c.json({ success: true });
});

// DELETE /api/portfolio/transactions/:id
transactions.delete('/api/portfolio/transactions/:id', async (c) => {
  const id = c.req.param('id');
  const tx = await c.env.DB.prepare('SELECT symbol FROM transactions WHERE id = ?').bind(id).first();
  if (tx) {
    const symbol = tx.symbol as string;
    await c.env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();
    await rebuildLotsAndRealizedGains(c.env.DB, symbol);
  } else {
    await c.env.DB.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();
  }
  return c.json({ success: true });
});

// GET /api/portfolio/dividends/:symbol
transactions.get('/api/portfolio/dividends/:symbol', async (c) => {
  const symbol = c.req.param('symbol').toUpperCase();
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM dividends WHERE symbol = ? ORDER BY date DESC'
  ).bind(symbol).all();
  return c.json(results || []);
});

// POST /api/portfolio/dividends
transactions.post('/api/portfolio/dividends', async (c) => {
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
transactions.delete('/api/portfolio/dividends/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM dividends WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// PUT /api/portfolio/dividends/:id
transactions.put('/api/portfolio/dividends/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const { date, amount, per_share, note } = body;

  if (!date || !amount) {
    return c.json({ error: 'date and amount are required' }, 400);
  }

  await c.env.DB.prepare(`
    UPDATE dividends
    SET date = ?, amount = ?, per_share = ?, note = ?
    WHERE id = ?
  `).bind(date, parseFloat(amount) || 0, per_share ? parseFloat(per_share) : null, note || null, id).run();

  return c.json({ success: true });
});

export default transactions;
