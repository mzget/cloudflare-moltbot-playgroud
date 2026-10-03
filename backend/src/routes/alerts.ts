import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { checkAlertRules } from '../alerts';

const alerts = new Hono<AppEnv>();

// API: Alert Rules Operations
alerts.get('/api/alerts', async (c) => {
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

alerts.post('/api/alerts', async (c) => {
  const { symbol, metric, condition_type, target_value, note } = await c.req.json() as any;
  if (!symbol || !metric || !condition_type || target_value === undefined) {
    return c.text('Missing required fields', 400);
  }
  await c.env.DB.prepare(
    'INSERT INTO alert_rules (symbol, metric, condition_type, target_value, is_active, note) VALUES (?, ?, ?, ?, 1, ?)'
  ).bind(symbol.toUpperCase(), metric, condition_type, target_value, note ? String(note).trim() : null).run();
  return c.text('Alert rule created');
});

alerts.put('/api/alerts', async (c) => {
  const { id, is_active, target_value, note } = await c.req.json() as any;
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
  if (note !== undefined) {
    await c.env.DB.prepare('UPDATE alert_rules SET note = ?, updated_at = (strftime(\'%s\', \'now\')) WHERE id = ?')
      .bind(note ? String(note).trim() : null, id).run();
  }
  return c.text('Alert rule updated');
});

alerts.delete('/api/alerts', async (c) => {
  const id = c.req.query('id');
  if (!id) {
    return c.text('Missing rule ID', 400);
  }
  await c.env.DB.prepare('DELETE FROM alert_rules WHERE id = ?').bind(id).run();
  return c.text('Alert rule deleted');
});

// API: In-App Notifications
alerts.get('/api/triggered-alerts', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM in_app_notifications ORDER BY created_at DESC LIMIT 50'
  ).all();
  return c.json(results || []);
});

alerts.put('/api/triggered-alerts', async (c) => {
  const body = await c.req.json().catch(() => ({})) as any;
  const id = body?.id;
  if (id) {
    await c.env.DB.prepare('UPDATE in_app_notifications SET is_read = 1 WHERE id = ?').bind(id).run();
  } else {
    await c.env.DB.prepare('UPDATE in_app_notifications SET is_read = 1 WHERE is_read = 0').run();
  }
  return c.text('Notifications updated');
});

alerts.delete('/api/triggered-alerts', async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM in_app_notifications WHERE is_read = 1').run();
    return c.text('Read notifications cleared');
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// API: Trigger Alert Checks Manually (Test)
alerts.get('/api/alerts/check-test', async (c) => {
  try {
    const results = await checkAlertRules(c.env);
    return c.json(results);
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

export default alerts;
