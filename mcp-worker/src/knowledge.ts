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
