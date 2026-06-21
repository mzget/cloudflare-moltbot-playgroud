export async function getPortfolio(env: Env) {
  const { results } = await env.DB.prepare('SELECT * FROM portfolio_holdings').all();
  return results;
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
