import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { runFullAnalysis, getOrUpdateMarketStats } from '../analysisEngine';
import { runDialecticalDebate } from '../debateEngine';
import { formatMetricsForPrompt } from '../analysisPrompts';

const analysis = new Hono<AppEnv>();


// API: Value Investor Deep Analysis
// POST /api/analysis/run
analysis.post('/api/analysis/run', async (c) => {
  const { symbol } = await c.req.json() as any;
  if (!symbol) return c.json({ error: 'symbol is required' }, 400);
  try {
    const result = await runFullAnalysis(c.env, symbol);
    return c.json(result);
  } catch (e) {
    console.error(`Analysis failed for ${symbol}:`, e);
    return c.json({ error: (e as any).message }, 500);
  }
});

// GET /api/analysis/coverage
// Batch endpoint to check if symbols have analysis items (report, dcf, thesis)
analysis.get('/api/analysis/coverage', async (c) => {
  const symbolsParam = c.req.query('symbols');
  const symbolsList = symbolsParam
    ? symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : [];

  let reportSymbols: string[] = [];
  let dcfSymbols: string[] = [];
  let thesisSymbols: string[] = [];

  if (symbolsList.length > 0) {
    const placeholders = symbolsList.map(() => '?').join(',');
    const [reportsRes, dcfRes, thesesRes] = await Promise.all([
      c.env.DB.prepare(`SELECT DISTINCT symbol FROM analysis_results WHERE symbol IN (${placeholders})`).bind(...symbolsList).all(),
      c.env.DB.prepare(`SELECT DISTINCT symbol FROM dcf_calculations WHERE symbol IN (${placeholders})`).bind(...symbolsList).all(),
      c.env.DB.prepare(`SELECT DISTINCT symbol FROM stock_theses WHERE symbol IN (${placeholders})`).bind(...symbolsList).all(),
    ]);
    reportSymbols = (reportsRes.results || []).map((r: any) => r.symbol);
    dcfSymbols = (dcfRes.results || []).map((r: any) => r.symbol);
    thesisSymbols = (thesesRes.results || []).map((r: any) => r.symbol);
  } else {
    const [reportsRes, dcfRes, thesesRes] = await Promise.all([
      c.env.DB.prepare('SELECT DISTINCT symbol FROM analysis_results').all(),
      c.env.DB.prepare('SELECT DISTINCT symbol FROM dcf_calculations').all(),
      c.env.DB.prepare('SELECT DISTINCT symbol FROM stock_theses').all(),
    ]);
    reportSymbols = (reportsRes.results || []).map((r: any) => r.symbol);
    dcfSymbols = (dcfRes.results || []).map((r: any) => r.symbol);
    thesisSymbols = (thesesRes.results || []).map((r: any) => r.symbol);
  }

  const reportSet = new Set(reportSymbols);
  const dcfSet = new Set(dcfSymbols);
  const thesisSet = new Set(thesisSymbols);

  const allSymbols = symbolsList.length > 0
    ? symbolsList
    : Array.from(new Set([...reportSet, ...dcfSet, ...thesisSet]));

  const coverage: Record<string, { report: boolean; dcf: boolean; thesis: boolean; count: number }> = {};

  for (const sym of allSymbols) {
    const report = reportSet.has(sym);
    const dcf = dcfSet.has(sym);
    const thesis = thesisSet.has(sym);
    const count = (report ? 1 : 0) + (dcf ? 1 : 0) + (thesis ? 1 : 0);
    coverage[sym] = { report, dcf, thesis, count };
  }

  return c.json(coverage);
});

// GET /api/analysis/results
analysis.get('/api/analysis/results', async (c) => {
  const symbol = c.req.query('symbol');
  if (!symbol) return c.json({ error: 'symbol is required' }, 400);
  const symbolUpper = symbol.toUpperCase();
  const result = await c.env.DB.prepare(
    'SELECT * FROM analysis_results WHERE symbol = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(symbolUpper).first();
  if (!result) return c.json({ error: 'Analysis not found' }, 404);
  return c.json(result);
});

// GET /api/analysis/history
analysis.get('/api/analysis/history', async (c) => {
  const symbol = c.req.query('symbol');
  if (!symbol) return c.json({ error: 'symbol is required' }, 400);
  const symbolUpper = symbol.toUpperCase();
  const { results } = await c.env.DB.prepare(
    'SELECT id, symbol, conviction_level, created_at FROM analysis_results WHERE symbol = ? ORDER BY created_at DESC'
  ).bind(symbolUpper).all();
  return c.json(results);
});

// GET /api/analysis/debate
// Returns cached debate results from analysis_results if available
analysis.get('/api/analysis/debate', async (c) => {
  const symbol = c.req.query('symbol');
  if (!symbol) return c.json({ error: 'symbol is required' }, 400);
  const symbolUpper = symbol.toUpperCase();

  const result = await c.env.DB.prepare(
    'SELECT framework_results FROM analysis_results WHERE symbol = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(symbolUpper).first<{ framework_results: string }>();

  if (!result || !result.framework_results) {
    return c.json({ error: 'Debate not found for ' + symbolUpper }, 404);
  }

  try {
    const fw = JSON.parse(result.framework_results);
    if (!fw.debate) {
      return c.json({ error: 'No debate record found in analysis' }, 404);
    }
    return c.json(fw.debate);
  } catch {
    return c.json({ error: 'Failed to parse debate record' }, 500);
  }
});

// POST /api/analysis/debate
// Runs or refreshes on-demand Bull vs. Bear Dialectical Debate
analysis.post('/api/analysis/debate', async (c) => {
  const { symbol } = await c.req.json() as any;
  if (!symbol) return c.json({ error: 'symbol is required' }, 400);
  const symbolUpper = symbol.toUpperCase();
  try {
    const stats = await getOrUpdateMarketStats(c.env, symbolUpper);
    const metricsStr = formatMetricsForPrompt(stats);
    const debate = await runDialecticalDebate(c.env, symbolUpper, metricsStr);

    // If an analysis_results entry exists, update its framework_results with the refreshed debate
    const existing = await c.env.DB.prepare(
      'SELECT id, framework_results FROM analysis_results WHERE symbol = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(symbolUpper).first<{ id: number; framework_results: string }>();

    if (existing && existing.framework_results) {
      try {
        const parsed = JSON.parse(existing.framework_results);
        parsed.debate = debate;
        await c.env.DB.prepare(
          "UPDATE analysis_results SET framework_results = ?, updated_at = (datetime('now')) WHERE id = ?"
        ).bind(JSON.stringify(parsed), existing.id).run();
      } catch (dbErr) {
        console.warn('Failed to patch framework_results:', dbErr);
      }
    }

    return c.json(debate);
  } catch (e) {
    console.error(`Debate failed for ${symbolUpper}:`, e);
    return c.json({ error: (e as any).message }, 500);
  }
});


// GET /api/analysis/dcf-defaults
// Returns pre-populated DCF model parameters from market_stats
analysis.get('/api/analysis/dcf-defaults', async (c) => {
  const symbol = c.req.query('symbol');
  if (!symbol) return c.json({ error: 'symbol is required' }, 400);
  const symbolUpper = symbol.toUpperCase();

  let stats = null;
  try {
    stats = await getOrUpdateMarketStats(c.env, symbolUpper);
  } catch (e) {
    stats = null;
  }
  if (!stats) {
    try {
      stats = await c.env.DB.prepare(
        'SELECT * FROM market_stats WHERE symbol = ?'
      ).bind(symbolUpper).first() as any;
    } catch (dbErr) {}
  }

  if (!stats) {
    return c.json({ error: 'No market stats found for ' + symbolUpper }, 404);
  }

  // Revenue in $B (market_stats stores in raw USD)
  const revenueRaw = stats.revenues ?? null;
  const baseRevenue = revenueRaw !== null ? revenueRaw / 1e9 : null;

  // Revenue growth - prefer 1Y, fallback to 3Y CAGR
  let revenueGrowth = stats.revenue_1y_growth ?? stats.revenue_3y_cagr ?? null;
  if (revenueGrowth !== null) revenueGrowth = Math.round(revenueGrowth * 10000) / 100;

  // Gross margin (decimal -> %)
  const grossMargin = stats.gross_profit_margin !== null
    ? Math.round(stats.gross_profit_margin * 10000) / 100
    : null;

  // Operating margin -> OpEx margin = gross margin - operating margin (as %)
  const operatingMargin = stats.operating_margin !== null
    ? Math.round(stats.operating_margin * 10000) / 100
    : null;
  const opexMargin = (grossMargin !== null && operatingMargin !== null)
    ? Math.round((grossMargin - operatingMargin) * 100) / 100
    : null;

  // FCF margin (decimal -> %)
  const fcfMargin = stats.fcf_margin !== null
    ? Math.round(stats.fcf_margin * 10000) / 100
    : null;

  // Estimate shares outstanding from market_cap / price
  let sharesOutstanding: number | null = null;
  if (stats.market_cap && stats.price && stats.price > 0) {
    sharesOutstanding = Math.round(stats.market_cap / stats.price / 1e6); // in millions
  }

  return c.json({
    symbol: symbolUpper,
    baseRevenue,
    revenueGrowth,
    grossMargin,
    opexMargin,
    operatingMargin,
    fcfMargin,
    price: stats.price,
    marketCap: stats.market_cap,
    netDebt: stats.net_debt,
    totalCash: stats.total_cash,
    sharesOutstanding,
    updatedAt: stats.updated_at,
  });
});

// GET /api/analysis/dcf-history
// Returns historical DCF calculations for a given symbol
analysis.get('/api/analysis/dcf-history', async (c) => {
  const symbol = c.req.query('symbol');
  if (!symbol) return c.json({ error: 'symbol is required' }, 400);
  const symbolUpper = symbol.toUpperCase();

  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM dcf_calculations WHERE symbol = ? ORDER BY created_at DESC'
    ).bind(symbolUpper).all();
    return c.json(results);
  } catch (e) {
    console.error(`Failed to fetch DCF history for ${symbolUpper}:`, e);
    return c.json({ error: (e as any).message }, 500);
  }
});

// POST /api/analysis/dcf-save
// Saves a new DCF calculation for a symbol
analysis.post('/api/analysis/dcf-save', async (c) => {
  try {
    const body = await c.req.json() as any;
    const {
      symbol,
      scenarioName,
      baseRevenue,
      revenueGrowth,
      baseGrossMargin,
      grossMarginImprovement,
      opexMargin,
      taxRate,
      fcfConversion,
      wacc,
      terminalGrowth,
      sharesOutstanding,
      netCash,
      exitMultiple,
      targetShares,
      impliedSharePrice,
      mode,
      yearlyGrowth,
      yearlyOpMargin,
      yearlyFcfConv,
      rationale,
      source,
    } = body;

    if (!symbol) return c.json({ error: 'symbol is required' }, 400);
    const symbolUpper = symbol.toUpperCase();
    const finalScenarioName = scenarioName || 'Base Case';

    // Delete existing calculation for this symbol and scenario_name to achieve overwrite persistence
    await c.env.DB.prepare(
      'DELETE FROM dcf_calculations WHERE symbol = ? AND scenario_name = ?'
    ).bind(symbolUpper, finalScenarioName).run();

    await c.env.DB.prepare(
      `INSERT INTO dcf_calculations (
        symbol, scenario_name, base_revenue, revenue_growth, base_gross_margin,
        gross_margin_improvement, opex_margin, tax_rate, fcf_conversion,
        wacc, terminal_growth, shares_outstanding, net_cash, exit_multiple, target_shares, implied_share_price,
        mode, yearly_growth, yearly_op_margin, yearly_fcf_conv, rationale, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      symbolUpper,
      finalScenarioName,
      baseRevenue,
      revenueGrowth,
      baseGrossMargin,
      grossMarginImprovement,
      opexMargin,
      taxRate,
      fcfConversion,
      wacc,
      terminalGrowth,
      sharesOutstanding,
      netCash ?? 0,
      exitMultiple ?? 20.0,
      targetShares ?? sharesOutstanding ?? 0,
      impliedSharePrice,
      mode ?? 'detailed',
      typeof yearlyGrowth === 'object' ? JSON.stringify(yearlyGrowth) : (yearlyGrowth ?? null),
      typeof yearlyOpMargin === 'object' ? JSON.stringify(yearlyOpMargin) : (yearlyOpMargin ?? null),
      typeof yearlyFcfConv === 'object' ? JSON.stringify(yearlyFcfConv) : (yearlyFcfConv ?? null),
      rationale ?? null,
      source ?? 'manual'
    ).run();

    return c.json({ success: true });
  } catch (e) {
    console.error('Failed to save DCF calculation:', e);
    return c.json({ error: (e as any).message }, 500);
  }
});

// ==========================================
// STOCK THESIS API ENDPOINTS
// ==========================================

export default analysis;
