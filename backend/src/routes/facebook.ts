import { Hono } from 'hono';
import { cache } from 'hono/cache';
import type { AppEnv } from '../env';
import { syncAndProcessFacebookPosts, styleCustomPost, queueFacebookPost, publishArticleNow } from '../facebook';

const facebook = new Hono<AppEnv>();

// API: Test Facebook Posting (Manual Trigger)
facebook.post('/api/test-facebook-post', async (c) => {
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

// API: Get Facebook Custom Posts
facebook.get('/api/facebook/posts', cache({ cacheName: 'oaktree-facebook-posts', cacheControl: 'max-age=600' }), async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
			SELECT id, source_type, source_id, thai_title, thai_content, status, facebook_post_id, error_message, 
			       CAST(strftime('%s', created_at) as INTEGER) as created_at 
			FROM facebook_posts 
			WHERE source_type = 'custom'
			ORDER BY created_at DESC 
			LIMIT 50
		`).all();
    return c.json(results || []);
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// API: Create Custom Post Draft
facebook.post('/api/facebook/posts', async (c) => {
  try {
    const { title, content } = await c.req.json() as any;
    await c.env.DB.prepare(
      "INSERT INTO facebook_posts (source_type, source_id, thai_title, thai_content, status) VALUES ('custom', 0, ?, ?, 'draft')"
    ).bind(title || '', content || '').run();
    return c.json({ success: true, message: 'Custom post draft created' });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// API: Style Custom Facebook Post using Workers AI
facebook.post('/api/facebook/posts/style', async (c) => {
  try {
    const { content, tone, instructions } = await c.req.json() as any;
    if (!content) {
      return c.json({ error: 'Content is required' }, 400);
    }
    const styledContent = await styleCustomPost(c.env, content, tone || 'engaging', instructions);
    return c.json({ success: true, styledContent });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// API: Update Custom Post
facebook.put('/api/facebook/posts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { title, content, status } = await c.req.json() as any;

    // Build dynamic update query
    const fields: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      fields.push('thai_title = ?');
      values.push(title);
    }
    if (content !== undefined) {
      fields.push('thai_content = ?');
      values.push(content);
    }
    if (status !== undefined) {
      fields.push('status = ?');
      values.push(status);
    }

    if (fields.length === 0) {
      return c.json({ error: 'No fields to update' }, 400);
    }

    fields.push("updated_at = (strftime('%Y-%m-%d %H:%M:%S', 'now'))");
    values.push(id);

    const sql = `UPDATE facebook_posts SET ${fields.join(', ')} WHERE id = ?`;
    await c.env.DB.prepare(sql).bind(...values).run();

    return c.json({ success: true, message: 'Custom post updated' });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// API: Delete Custom Post
facebook.delete('/api/facebook/posts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await c.env.DB.prepare('DELETE FROM facebook_posts WHERE id = ? AND source_type = \'custom\'').bind(id).run();
    return c.json({ success: true, message: 'Custom post deleted' });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// API: Publish Custom Post Immediately
facebook.post('/api/facebook/posts/:id/post-now', async (c) => {
  try {
    const id = c.req.param('id');
    const { content } = await c.req.json() as any;

    // Verify post exists and is custom
    const post = await c.env.DB.prepare(
      "SELECT * FROM facebook_posts WHERE id = ? AND source_type = 'custom'"
    ).bind(id).first() as { id: number; thai_title: string; thai_content: string } | null;

    if (!post) {
      return c.json({ error: 'Post not found or is not a custom post' }, 404);
    }

    const thaiPost = content !== undefined ? content : post.thai_content;

    if (!c.env.FACEBOOK_PAGE_ID || !c.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
      return c.json({ error: 'Facebook Page configurations (ID or token) are missing' }, 400);
    }

    console.log(`Manually publishing custom post ID ${id} directly to Facebook Page: ${c.env.FACEBOOK_PAGE_ID}`);
    const fbResponse = await fetch(`https://graph.facebook.com/v20.0/${c.env.FACEBOOK_PAGE_ID}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: thaiPost,
        access_token: c.env.FACEBOOK_PAGE_ACCESS_TOKEN,
      }),
    });

    const fbResult = await fbResponse.json() as any;

    if (!fbResponse.ok || fbResult.error) {
      const errorMsg = fbResult.error?.message || JSON.stringify(fbResult);
      await c.env.DB.prepare(
        "UPDATE facebook_posts SET thai_content = ?, status = 'failed', error_message = ?, updated_at = (strftime('%Y-%m-%d %H:%M:%S', 'now')) WHERE id = ?"
      ).bind(thaiPost, errorMsg, id).run();
      return c.json({ success: false, error: errorMsg }, 400);
    }

    const facebookPostId = fbResult.id;
    console.log(`Successfully posted custom post manually. Post ID: ${facebookPostId}`);

    await c.env.DB.prepare(
      "UPDATE facebook_posts SET thai_content = ?, status = 'posted', facebook_post_id = ?, error_message = NULL, updated_at = (strftime('%Y-%m-%d %H:%M:%S', 'now')) WHERE id = ?"
    ).bind(thaiPost, facebookPostId, id).run();

    return c.json({ success: true, facebookPostId });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});


// API: Queue Facebook Post
facebook.post('/api/facebook/queue', async (c) => {
  try {
    const { source_type, source_id } = await c.req.json() as any;
    if (!source_type || !source_id) {
      return c.json({ error: 'source_type and source_id are required' }, 400);
    }
    if (source_type !== 'email_digest' && source_type !== 'daily_report' && source_type !== 'notebook_article') {
      return c.json({ error: 'Invalid source_type' }, 400);
    }
    await queueFacebookPost(c.env, source_type, parseInt(source_id));
    return c.json({ success: true, message: `${source_type} queued for Facebook posting` });
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

// API: Publish Notebook Article Immediately
facebook.post('/api/facebook/publish-article-now', async (c) => {
  try {
    const { article_id } = await c.req.json() as any;
    if (!article_id) {
      return c.json({ error: 'article_id is required' }, 400);
    }
    const result = await publishArticleNow(c.env, parseInt(article_id));
    return c.json(result);
  } catch (e) {
    return c.json({ error: (e as any).message }, 500);
  }
});

export default facebook;
