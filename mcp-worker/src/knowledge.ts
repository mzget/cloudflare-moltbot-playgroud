export async function getPortfolio(env: Env) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        COALESCE(h.symbol, p.symbol) as symbol,
        COALESCE(h.shares, 0) as shares,
        COALESCE(h.avg_cost, 0) as avg_cost,
        COALESCE(h.total_cost, 0) as total_cost,
        COALESCE(h.status, 'Closed') as status,
        m.price as current_price,
        m.previous_close,
        (CASE WHEN h.shares > 0 AND m.price IS NOT NULL THEN h.shares * m.price ELSE 0 END) as current_value,
        (CASE WHEN h.shares > 0 AND m.price IS NOT NULL THEN (h.shares * m.price) - h.total_cost ELSE 0 END) as unrealized_gain_loss,
        (CASE WHEN h.shares > 0 AND h.avg_cost > 0 AND m.price IS NOT NULL THEN ((m.price - h.avg_cost) / h.avg_cost) * 100 ELSE 0 END) as unrealized_gain_loss_pct,
        (CASE WHEN h.shares > 0 AND m.price IS NOT NULL AND m.previous_close IS NOT NULL THEN h.shares * (m.price - m.previous_close) ELSE 0 END) as day_gain_amt,
        (CASE WHEN h.shares > 0 AND m.price IS NOT NULL AND m.previous_close > 0 THEN ((m.price - m.previous_close) / m.previous_close) * 100 ELSE 0 END) as day_gain_pct,
        p.weight as target_weight,
        p.thesis,
        p.category
      FROM holdings h
      LEFT JOIN portfolio_holdings p ON h.symbol = p.symbol
      LEFT JOIN market_stats m ON h.symbol = m.symbol
      UNION
      SELECT 
        p.symbol,
        COALESCE(h.shares, 0) as shares,
        COALESCE(h.avg_cost, 0) as avg_cost,
        COALESCE(h.total_cost, 0) as total_cost,
        COALESCE(h.status, 'Closed') as status,
        m.price as current_price,
        m.previous_close,
        (CASE WHEN h.shares > 0 AND m.price IS NOT NULL THEN h.shares * m.price ELSE 0 END) as current_value,
        (CASE WHEN h.shares > 0 AND m.price IS NOT NULL THEN (h.shares * m.price) - h.total_cost ELSE 0 END) as unrealized_gain_loss,
        (CASE WHEN h.shares > 0 AND h.avg_cost > 0 AND m.price IS NOT NULL THEN ((m.price - h.avg_cost) / h.avg_cost) * 100 ELSE 0 END) as unrealized_gain_loss_pct,
        (CASE WHEN h.shares > 0 AND m.price IS NOT NULL AND m.previous_close IS NOT NULL THEN h.shares * (m.price - m.previous_close) ELSE 0 END) as day_gain_amt,
        (CASE WHEN h.shares > 0 AND m.price IS NOT NULL AND m.previous_close > 0 THEN ((m.price - m.previous_close) / m.previous_close) * 100 ELSE 0 END) as day_gain_pct,
        p.weight as target_weight,
        p.thesis,
        p.category
      FROM portfolio_holdings p
      LEFT JOIN holdings h ON p.symbol = h.symbol
      LEFT JOIN market_stats m ON p.symbol = m.symbol
    `).all();
    return results;
  } catch (error) {
    console.error('Failed to query combined holdings, falling back to portfolio_holdings:', error);
    try {
      const { results } = await env.DB.prepare('SELECT * FROM portfolio_holdings').all();
      return results;
    } catch (fallbackError) {
      console.error('Fallback query failed:', fallbackError);
      return [];
    }
  }
}

export async function getPortfolioHistory(env: Env) {
  const { results } = await env.DB.prepare('SELECT * FROM portfolio_history ORDER BY year').all();
  return results;
}

export async function getKnowledgeByCategory(env: Env, category: string) {
  const { results } = await env.DB.prepare('SELECT * FROM knowledge_base WHERE category = ?').bind(category).all();
  return results;
}

export async function searchKnowledge(env: Env, query: string) {
  const likeQuery = `%${query}%`;
  const { results } = await env.DB.prepare('SELECT * FROM knowledge_base WHERE title LIKE ? OR content LIKE ?').bind(likeQuery, likeQuery).all();
  return results;
}

export async function getLatestAnalysisReport(env: any, symbol: string) {
  const symbolUpper = symbol.toUpperCase();
  const result = await env.DB.prepare(
    'SELECT * FROM analysis_results WHERE symbol = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(symbolUpper).first();
  return result;
}

export async function getWatchlist(env: Env) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        w.symbol,
        w.name,
        w.sector,
        w.target_price,
        w.thesis,
        m.price as current_price,
        m.pe_ratio,
        m.fifty_two_week_high,
        m.fifty_two_week_low
      FROM watchlist w
      LEFT JOIN market_stats m ON w.symbol = m.symbol
      WHERE w.is_active = 1 OR w.is_active IS NULL
    `).all();
    return results;
  } catch (error) {
    try {
      const { results } = await env.DB.prepare('SELECT * FROM watchlist').all();
      return results;
    } catch (e) {
      console.error('Failed to query watchlist:', e);
      return [];
    }
  }
}

/** Convert a slug-friendly key from an article title */
function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

/** Serialize a market article to an OKF Markdown string */
function articleToOkf(
  article: { title: string; symbol?: string | null; summary?: string | null; key_takeaways?: string[]; source?: string },
  timestamp: string
): string {
  const tags = ['news-intelligence', 'market-analysis'];
  if (article.symbol) tags.push(article.symbol.toLowerCase());
  if (article.source) tags.push(article.source.toLowerCase());

  const frontmatter = [
    '---',
    'type: article',
    `title: "${article.title.replace(/"/g, "'")}"`,
    article.symbol ? `symbol: "${article.symbol}"` : null,
    article.summary ? `description: "${article.summary.replace(/"/g, "'")}"` : null,
    `tags: [${tags.join(', ')}]`,
    `timestamp: "${timestamp}"`,
    `source: ${article.source || 'gemini_spark'}`,
    '---',
  ].filter(Boolean).join('\n');

  const body = [
    `# ${article.title}`,
    '',
    article.summary ? `## Summary\n\n${article.summary}` : '',
    article.key_takeaways?.length
      ? `## Key Takeaways\n\n${article.key_takeaways.map((t) => `- ${t}`).join('\n')}`
      : '',
  ].filter((s) => s !== '').join('\n\n');

  return `${frontmatter}\n\n${body}\n`;
}

export interface SaveMarketArticleInput {
  title: string;
  summary: string;
  key_takeaways?: string[] | string;
  symbol?: string | null;
  category?: string | null;
  source?: string;
  url?: string | null;
  auto_publish_facebook?: boolean;
}

export async function saveMarketArticle(env: any, input: SaveMarketArticleInput) {
  const title = input.title.trim();
  const symbol = input.symbol ? input.symbol.trim().toUpperCase() : null;
  const summary = input.summary.trim();
  const source = input.source?.trim() || 'gemini_spark';
  const category = input.category ? input.category.trim() : null;
  const url = input.url ? input.url.trim() : null;
  const autoPublish = input.auto_publish_facebook ? 1 : 0;

  let takeawaysList: string[] = [];
  if (Array.isArray(input.key_takeaways)) {
    takeawaysList = input.key_takeaways.map(t => String(t).trim()).filter(Boolean);
  } else if (typeof input.key_takeaways === 'string') {
    takeawaysList = input.key_takeaways
      .split('\n')
      .map(line => line.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter(Boolean);
  }
  const takeawaysJson = JSON.stringify(takeawaysList);

  // 1. Ensure table exists
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS notebook_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      symbol TEXT,
      summary TEXT,
      key_takeaways TEXT,
      synced_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      source TEXT DEFAULT 'notebooklm',
      category TEXT,
      url TEXT,
      auto_publish INTEGER DEFAULT 0
    )
  `).run();

  // 2. Upsert into D1 notebook_articles
  await env.DB.prepare(`
    INSERT INTO notebook_articles (title, symbol, summary, key_takeaways, source, category, url, auto_publish)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(title, symbol) DO UPDATE SET
      summary = excluded.summary,
      key_takeaways = excluded.key_takeaways,
      source = excluded.source,
      category = excluded.category,
      url = excluded.url,
      auto_publish = excluded.auto_publish,
      updated_at = (strftime('%Y-%m-%d %H:%M:%S', 'now'))
  `).bind(title, symbol, summary, takeawaysJson, source, category, url, autoPublish).run();

  const articleRow = await env.DB.prepare(
    'SELECT id FROM notebook_articles WHERE title = ? AND ((symbol IS NULL AND ? IS NULL) OR symbol = ?) ORDER BY id DESC LIMIT 1'
  ).bind(title, symbol, symbol).first() as { id: number } | null;

  const articleId = articleRow?.id;

  // 3. Write OKF markdown to KNOWLEDGE_BUCKET (or BUCKET fallback)
  const targetBucket = env.KNOWLEDGE_BUCKET || env.BUCKET;
  let okfKey: string | null = null;
  if (targetBucket) {
    try {
      const slug = toSlug(title);
      okfKey = `articles/${slug}.md`;
      const okfContent = articleToOkf({
        title,
        symbol,
        summary,
        key_takeaways: takeawaysList,
        source
      }, new Date().toISOString().split('T')[0]);
      await targetBucket.put(okfKey, okfContent, {
        httpMetadata: { contentType: 'text/markdown' }
      });
    } catch (e: any) {
      console.warn(`Failed to write OKF file for "${title}":`, e.message);
    }
  }

  // 4. If auto_publish_facebook is true, queue directly to facebook_posts
  if (autoPublish === 1 && articleId) {
    try {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO facebook_posts (source_type, source_id, status) VALUES ('notebook_article', ?, 'pending')"
      ).bind(articleId).run();
    } catch (fbErr: any) {
      console.warn(`Failed to queue facebook post for article ${articleId}:`, fbErr.message);
    }
  }

  return {
    success: true,
    id: articleId,
    title,
    symbol,
    source,
    auto_publish: autoPublish === 1,
    r2_key: okfKey
  };
}

export async function createFacebookDraft(env: any, postData: { title: string; content: string }) {
  const title = postData.title.trim();
  const content = postData.content.trim();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS facebook_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      thai_title TEXT,
      thai_content TEXT,
      status TEXT DEFAULT 'pending',
      facebook_post_id TEXT,
      error_message TEXT,
      created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
      updated_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
    )
  `).run();

  await env.DB.prepare(
    "INSERT INTO facebook_posts (source_type, source_id, thai_title, thai_content, status) VALUES ('custom', 0, ?, ?, 'draft')"
  ).bind(title, content).run();

  return {
    success: true,
    message: 'Facebook post draft created successfully',
    title
  };
}

export async function getRecentArticles(env: any, limit = 10, source?: string) {
  const maxLimit = Math.min(Math.max(limit, 1), 50);
  if (source) {
    const { results } = await env.DB.prepare(
      'SELECT * FROM notebook_articles WHERE source = ? ORDER BY created_at DESC LIMIT ?'
    ).bind(source, maxLimit).all();
    return results || [];
  }
  const { results } = await env.DB.prepare(
    'SELECT * FROM notebook_articles ORDER BY created_at DESC LIMIT ?'
  ).bind(maxLimit).all();
  return results || [];
}
