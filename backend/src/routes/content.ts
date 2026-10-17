import { Hono } from 'hono';
import { cache } from 'hono/cache';
import type { AppEnv } from '../env';

const content = new Hono<AppEnv>();

// API: Get Latest Reports (One per symbol) / Purge Old Reports
content.get('/api/reports', async (c) => {
  const { results } = await c.env.DB.prepare(`
		SELECT m.*, 'daily_report' as source_type
		FROM (SELECT DISTINCT symbol FROM daily_reports) s
		JOIN daily_reports m ON m.id IN (
			SELECT id FROM daily_reports
			WHERE symbol = s.symbol
			ORDER BY created_at DESC
			LIMIT 1
		)
		ORDER BY m.is_readed ASC, m.created_at DESC
	`).all();
  return c.json(results);
});

// API: Mark Daily Report as Read
content.post('/api/reports/mark-read', async (c) => {
  try {
    const { id } = await c.req.json() as any;
    if (!id) {
      return c.json({ error: 'Missing report ID' }, 400);
    }
    await c.env.DB.prepare(
      'UPDATE daily_reports SET is_readed = 1 WHERE id = ?'
    ).bind(id).run();
    return c.json({ success: true, message: 'Report marked as read' });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

content.delete('/api/reports', async (c) => {
  try {
    await c.env.DB.prepare("DELETE FROM daily_reports WHERE created_at < datetime('now', '-3 days')").run();
    return c.text('Purged old daily reports');
  } catch (e) {
    return c.text(`Failed to purge daily reports: ${(e as any).message}`, 500);
  }
});

// API: Get Latest News / Purge Old News
content.get('/api/news', cache({ cacheName: 'oaktree-news', cacheControl: 'max-age=300' }), async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, symbol, title, summary, sentiment, url, CAST(strftime('%s', created_at) as INTEGER) as created_at FROM news ORDER BY created_at DESC LIMIT 50"
  ).all();
  return c.json(results);
});

content.delete('/api/news', async (c) => {
  try {
    await c.env.DB.prepare("DELETE FROM news WHERE created_at < datetime('now', '-3 days')").run();
    return c.text('Purged old news items');
  } catch (e) {
    return c.text(`Failed to purge news: ${(e as any).message}`, 500);
  }
});
export default content;
