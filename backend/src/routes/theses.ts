import { Hono } from 'hono';
import type { AppEnv } from '../env';

const theses = new Hono<AppEnv>();

// GET /api/analysis/theses?symbol=X
theses.get('/api/analysis/theses', async (c) => {
  const symbol = c.req.query('symbol');
  if (!symbol) return c.json({ error: 'Symbol is required' }, 400);
  const symbolUpper = symbol.toUpperCase();

  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM stock_theses WHERE symbol = ? ORDER BY created_at DESC'
    ).bind(symbolUpper).all();
    return c.json(results || []);
  } catch (e) {
    console.error(`Failed to fetch theses for ${symbolUpper}:`, e);
    return c.json({ error: (e as any).message }, 500);
  }
});

// POST /api/analysis/theses
theses.post('/api/analysis/theses', async (c) => {
  try {
    const body = await c.req.json();
    const { symbol, title, buy_price, sell_price, conviction, status, catalysts, risks, note } = body;
    if (!symbol || !title) {
      return c.json({ error: 'Symbol and title are required' }, 400);
    }
    const symbolUpper = symbol.toUpperCase();

    const result = await c.env.DB.prepare(
      `INSERT INTO stock_theses (
        symbol, title, buy_price, sell_price, conviction, status, catalysts, risks, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      symbolUpper,
      title,
      buy_price !== undefined && buy_price !== null && buy_price !== '' ? Number(buy_price) : null,
      sell_price !== undefined && sell_price !== null && sell_price !== '' ? Number(sell_price) : null,
      conviction || 'Medium',
      status || 'Active',
      catalysts || null,
      risks || null,
      note || null
    ).run();

    return c.json({ success: true, id: result.meta?.last_row_id });
  } catch (e) {
    console.error('Failed to create stock thesis:', e);
    return c.json({ error: (e as any).message }, 500);
  }
});

// PUT /api/analysis/theses/:id
theses.put('/api/analysis/theses/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const body = await c.req.json();
    const { title, buy_price, sell_price, conviction, status, catalysts, risks, note } = body;
    if (!title) {
      return c.json({ error: 'Title is required' }, 400);
    }

    await c.env.DB.prepare(
      `UPDATE stock_theses SET 
        title = ?, 
        buy_price = ?, 
        sell_price = ?, 
        conviction = ?, 
        status = ?, 
        catalysts = ?, 
        risks = ?, 
        note = ?, 
        updated_at = datetime('now')
      WHERE id = ?`
    ).bind(
      title,
      buy_price !== undefined && buy_price !== null && buy_price !== '' ? Number(buy_price) : null,
      sell_price !== undefined && sell_price !== null && sell_price !== '' ? Number(sell_price) : null,
      conviction || 'Medium',
      status || 'Active',
      catalysts || null,
      risks || null,
      note || null,
      Number(id)
    ).run();

    return c.json({ success: true });
  } catch (e) {
    console.error(`Failed to update stock thesis with id ${id}:`, e);
    return c.json({ error: (e as any).message }, 500);
  }
});

// DELETE /api/analysis/theses/:id
theses.delete('/api/analysis/theses/:id', async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM stock_theses WHERE id = ?').bind(Number(id)).run();
    return c.json({ success: true });
  } catch (e) {
    console.error(`Failed to delete stock thesis with id ${id}:`, e);
    return c.json({ error: (e as any).message }, 500);
  }
});

// GET /api/analysis/theses/:id/journal
theses.get('/api/analysis/theses/:id/journal', async (c) => {
  const id = c.req.param('id');
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM thesis_journal_entries WHERE thesis_id = ? ORDER BY created_at DESC'
    ).bind(Number(id)).all();
    return c.json(results || []);
  } catch (e) {
    console.error(`Failed to fetch journal for thesis id ${id}:`, e);
    return c.json({ error: (e as any).message }, 500);
  }
});

// POST /api/analysis/theses/:id/journal
theses.post('/api/analysis/theses/:id/journal', async (c) => {
  const id = c.req.param('id');
  try {
    const body = await c.req.json();
    const { content } = body;
    if (!content) {
      return c.json({ error: 'Content is required' }, 400);
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO thesis_journal_entries (thesis_id, content) VALUES (?, ?)'
    ).bind(Number(id), content).run();

    return c.json({ success: true, id: result.meta?.last_row_id });
  } catch (e) {
    console.error(`Failed to add journal entry to thesis id ${id}:`, e);
    return c.json({ error: (e as any).message }, 500);
  }
});

// Fallback for non-matching API routes

export default theses;
