import { Hono } from 'hono';
import type { AppEnv } from '../../env';

const reference = new Hono<AppEnv>();

// GET /api/portfolio/history/yearly
reference.get('/api/portfolio/history/yearly', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM portfolio_history ORDER BY year ASC'
  ).all();
  return c.json(results || []);
});

// POST /api/portfolio/history/yearly
reference.post('/api/portfolio/history/yearly', async (c) => {
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
reference.delete('/api/portfolio/history/yearly/:year', async (c) => {
  const year = c.req.param('year');
  await c.env.DB.prepare('DELETE FROM portfolio_history WHERE year = ?').bind(year).run();
  return c.json({ success: true });
});

// GET /api/portfolio/tax-savings
reference.get('/api/portfolio/tax-savings', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM tax_savings ORDER BY year ASC'
  ).all();
  return c.json(results || []);
});

// POST /api/portfolio/tax-savings
reference.post('/api/portfolio/tax-savings', async (c) => {
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
reference.delete('/api/portfolio/tax-savings/:year', async (c) => {
  const year = c.req.param('year');
  await c.env.DB.prepare('DELETE FROM tax_savings WHERE year = ?').bind(year).run();
  return c.json({ success: true });
});

// GET /api/portfolio/funds
reference.get('/api/portfolio/funds', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM portfolio_funds ORDER BY id ASC'
  ).all();
  return c.json(results || []);
});

// POST /api/portfolio/funds
reference.post('/api/portfolio/funds', async (c) => {
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
reference.delete('/api/portfolio/funds/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM portfolio_funds WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// GET /api/portfolio/categories
reference.get('/api/portfolio/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM asset_categories ORDER BY id ASC'
  ).all();
  return c.json(results || []);
});

// POST /api/portfolio/categories
reference.post('/api/portfolio/categories', async (c) => {
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
reference.delete('/api/portfolio/categories/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM asset_categories WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// GET /api/portfolio/fund-allocations
reference.get('/api/portfolio/fund-allocations', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT category_id, fund_id, amount FROM fund_allocations
  `).all();
  return c.json(results || []);
});

// POST /api/portfolio/fund-allocations
reference.post('/api/portfolio/fund-allocations', async (c) => {
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

export default reference;
