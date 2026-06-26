export async function getPortfolio(env: Env) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT 
        COALESCE(h.symbol, p.symbol) as symbol,
        COALESCE(h.shares, 0) as shares,
        COALESCE(h.avg_cost, 0) as avg_cost,
        COALESCE(h.total_cost, 0) as total_cost,
        COALESCE(h.status, 'Closed') as status,
        p.weight,
        p.thesis,
        p.category
      FROM holdings h
      LEFT JOIN portfolio_holdings p ON h.symbol = p.symbol
      UNION
      SELECT 
        p.symbol,
        COALESCE(h.shares, 0) as shares,
        COALESCE(h.avg_cost, 0) as avg_cost,
        COALESCE(h.total_cost, 0) as total_cost,
        COALESCE(h.status, 'Closed') as status,
        p.weight,
        p.thesis,
        p.category
      FROM portfolio_holdings p
      LEFT JOIN holdings h ON p.symbol = h.symbol
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
