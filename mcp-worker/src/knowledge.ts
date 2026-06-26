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
