import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { getAuthUrl, exchangeCodeForTokens } from '../gmail';
import { generateEmailDigests } from '../emailSummarizer';
import { encryptToken } from '../auth';
import { syncAndProcessFacebookPosts } from '../facebook';

const gmail = new Hono<AppEnv>();

// API: Get Google OAuth URL
gmail.get('/api/auth/google/url', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const redirectUri = c.req.query('redirect_uri');
  if (!clientId || !redirectUri) {
    return c.text('Missing client_id configuration or redirect_uri parameter', 400);
  }
  const authUrl = getAuthUrl(clientId, redirectUri);
  return c.json({ url: authUrl });
});

// API: Google OAuth Callback (Code Exchange)
gmail.post('/api/auth/google/callback', async (c) => {
  try {
    const { code, redirect_uri } = await c.req.json() as any;
    const clientId = c.env.GOOGLE_CLIENT_ID;
    const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret || !code || !redirect_uri) {
      return c.text('Missing configuration, code, or redirect_uri', 400);
    }
    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirect_uri);
    const expiryDate = Date.now() + tokens.expires_in * 1000;
    const jwtSecret = c.env.JWT_SECRET;
    if (!jwtSecret && c.env.IS_LOCAL !== 'true') {
      return c.text('JWT Secret is not configured', 500);
    }
    const encAccessToken = await encryptToken(tokens.access_token, jwtSecret || '');
    const encRefreshToken = await encryptToken(tokens.refresh_token, jwtSecret || '');
    await c.env.DB.prepare(
      'INSERT INTO gmail_oauth (id, access_token, refresh_token, expiry_date) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET access_token = excluded.access_token, refresh_token = excluded.refresh_token, expiry_date = excluded.expiry_date, updated_at = (strftime(\'%s\', \'now\'))'
    ).bind('default', encAccessToken, encRefreshToken, expiryDate).run();
    return c.json({ success: true });
  } catch (e) {
    return c.text(`OAuth callback exchange failed: ${(e as any).message}`, 500);
  }
});

// API: Get Google Auth Status
gmail.get('/api/auth/google/status', async (c) => {
  const row = await c.env.DB.prepare('SELECT 1 FROM gmail_oauth WHERE id = ?').bind('default').first();
  return c.json({ connected: !!row });
});

// API: Google Disconnect
gmail.post('/api/auth/google/disconnect', async (c) => {
  await c.env.DB.prepare('DELETE FROM gmail_oauth WHERE id = ?').bind('default').run();
  return c.text('Disconnected');
});

// API: Subscriptions CRUD
gmail.get('/api/subscriptions', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM email_subscriptions ORDER BY created_at DESC').all();
  return c.json(results || []);
});

gmail.post('/api/subscriptions', async (c) => {
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

gmail.put('/api/subscriptions', async (c) => {
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

gmail.delete('/api/subscriptions', async (c) => {
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
gmail.get('/api/email-sync', async (c) => {
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
gmail.get('/api/test-email-digest', async (c) => {
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

// API: Mark Email Digest as Read
gmail.post('/api/email-digests/mark-read', async (c) => {
  try {
    const { id } = await c.req.json() as any;
    if (id === undefined || id === null || isNaN(Number(id))) {
      return c.json({ error: 'Missing or invalid digest ID' }, 400);
    }
    const digestId = Number(id);
    const result = await c.env.DB.prepare(
      'UPDATE email_digests SET is_readed = 1 WHERE id = ?'
    ).bind(digestId).run();
    return c.json({ success: true, message: 'Digest marked as read', changes: result.meta?.changes ?? 0 });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// API: Reprocess Email Digest
gmail.post('/api/email-digests/reprocess', async (c) => {
  try {
    const { email_id, digest_id } = await c.req.json() as any;
    if (digest_id) {
      await c.env.DB.prepare('DELETE FROM email_digests WHERE id = ?').bind(Number(digest_id)).run();
      await c.env.DB.prepare("DELETE FROM facebook_posts WHERE source_type = 'email_digest' AND source_id = ?").bind(Number(digest_id)).run();
    }
    if (email_id) {
      await c.env.DB.prepare('UPDATE ingested_emails SET processed = 0 WHERE id = ?').bind(email_id).run();
    }
    await generateEmailDigests(c.env, true);
    return c.json({ success: true, message: 'Reprocessed email successfully' });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// API: Get Email Digests
gmail.get('/api/email-digests', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        e.id, 
        'email_digest' as source_type,
        e.category, 
        e.summary, 
        e.key_takeaways, 
        e.source_emails, 
        e.digest_date, 
        COALESCE(e.is_readed, 0) as is_readed, 
        CAST(strftime('%s', e.created_at) as INTEGER) as created_at,
        f.status as facebook_status,
        f.facebook_post_id,
        f.error_message as facebook_error
      FROM email_digests e
      LEFT JOIN facebook_posts f ON f.source_type = 'email_digest' AND f.source_id = e.id
      WHERE COALESCE(e.is_readed, 0) = 0 
      ORDER BY e.created_at DESC 
      LIMIT 50
    `).all();
    return c.json(results || []);
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// API: Get Notebook Articles
gmail.get('/api/notebook-articles', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        n.id, 
        'notebook_article' as source_type,
        n.title, 
        n.symbol, 
        n.summary, 
        n.key_takeaways, 
        COALESCE(n.source, 'notebooklm') as source,
        n.category,
        n.url,
        COALESCE(n.auto_publish, 0) as auto_publish,
        CAST(strftime('%s', n.created_at) as INTEGER) as created_at,
        f.status as facebook_status,
        f.facebook_post_id,
        f.error_message as facebook_error
      FROM notebook_articles n
      LEFT JOIN facebook_posts f ON f.source_type = 'notebook_article' AND f.source_id = n.id
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all();
    return c.json(results || []);
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

export default gmail;
