import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { runCrawler } from '../crawler';
import { sendDailyEmailReport } from '../email';
import { fetchAndStoreMarketStats } from '../marketData';

const system = new Hono<AppEnv>();

// API: Trigger Email Manually (Test)
system.get('/api/email-test', async (c) => {
  try {
    const instance = await c.env.OAKTREE_SYNC_WORKFLOW.create({
      id: `manual-email-test-${Date.now()}`,
      params: { sendDailyEmailReport: false } // Disabled for this phase
    });
    return c.text(`Email trigger started via Workflow: ${instance.id}`);
  } catch (e) {
    return c.text(`Failed to start email trigger workflow: ${(e as any).message}`, 500);
  }
});

// Helper: Ensure system_settings table exists and is seeded with defaults
async function ensureSystemSettingsTable(db: D1Database) {
  await db.prepare(`
		CREATE TABLE IF NOT EXISTS system_settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)
	`).run();

  // Seed default values if they do not exist
  await db.prepare(`
		INSERT OR IGNORE INTO system_settings (key, value) VALUES 
		('pause_daily_report_facebook', '0'),
		('pause_email_digest_facebook', '0'),
		('pause_custom_facebook', '0'),
		('pause_notebook_facebook', '0'),
		('pause_market_breakout_notifications', '0'),
		('pause_market_breakout_scan', '0')
	`).run();
}

// API: System Settings
system.get('/api/settings', async (c) => {
  try {
    await ensureSystemSettingsTable(c.env.DB);
    const { results } = await c.env.DB.prepare('SELECT * FROM system_settings').all();

    // Convert results array to key-value record
    const settings: Record<string, string> = {};
    for (const row of (results || []) as any[]) {
      settings[row.key] = row.value;
    }
    return c.json(settings);
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

system.post('/api/settings', async (c) => {
  try {
    await ensureSystemSettingsTable(c.env.DB);
    const body = await c.req.json() as Record<string, string>;

    for (const [key, value] of Object.entries(body)) {
      await c.env.DB.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)')
        .bind(key, value)
        .run();
    }
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

system.post('/api/settings/clear-breakout-notifications', async (c) => {
  try {
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM in_app_notifications WHERE metric IN ('ath', 'atl', '52w_high', '52w_low')"),
      c.env.DB.prepare("DELETE FROM record_breaker_events WHERE event_type IN ('ath', 'atl', '52w_high', '52w_low')")
    ]);
    return c.json({ success: true, message: 'Breakout notifications cleared successfully' });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});


// API: Trigger Crawler (Chains to Summarizer)
system.get('/api/crawl', async (c) => {
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
system.get('/api/summarize-all', async (c) => {
  try {
    const force = c.req.query('force') === 'true';
    const instance = await c.env.OAKTREE_SYNC_WORKFLOW.create({
      id: `manual-summarize-all-${Date.now()}`,
      params: {
        generateDailySummaries: true,
        generateDailySummariesForce: force
      }
    });
    return c.text(`Summarization started via Workflow: ${instance.id}`);
  } catch (e) {
    return c.text(`Failed to start summarization workflow: ${(e as any).message}`, 500);
  }
});

// API: Trigger Full Daily Sequence Manually (Legacy/Combined)
system.get('/api/run-all', (c) => {
  return c.redirect(`/api/crawl`, 307);
});

// API: Trigger Market Stats Update Manually (Test)
system.get('/api/test-market-stats', async (c) => {
  try {
    const force = c.req.query('force') === 'true';
    const results = await fetchAndStoreMarketStats(c.env, { force });
    return c.json(results);
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

export default system;
