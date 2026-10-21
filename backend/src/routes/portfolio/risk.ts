import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import {
  DEFAULT_RISK_CONFIG,
  computeConcentrationAudit,
  computeCorrelationAndBeta,
  calculateFixedBasePositionSize,
  simulatePreTradeImpact,
  computePortfolioHealthScore,
  type RiskHoldingInput,
  type ThemeMappingInput,
  type PriceSeriesBySymbol,
  type RiskCapConfig,
} from '../../portfolioRisk';
import { ensureSymbolPrices, getStartDate } from '../../historicalPrices';
import { parseAIJson } from '../../analysisEngine';

const risk = new Hono<AppEnv>();

function getSafeExecutionCtx(c: any): { waitUntil: (promise: Promise<any>) => void } | undefined {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
}

// Helper to load portfolio audit data from D1
export async function loadPortfolioRiskData(
  db: D1Database,
  executionCtx?: { waitUntil: (promise: Promise<any>) => void }
) {
  // 1. Open Holdings & quotes
  const holdingsResult = await db.prepare(`
    SELECT 
      h.symbol, h.shares, h.avg_cost, h.total_cost, h.status,
      w.name, w.sector_label,
      m.price as last_price, m.previous_close
    FROM holdings h
    LEFT JOIN watchlist w ON h.symbol = w.symbol
    LEFT JOIN market_stats m ON h.symbol = m.symbol
    WHERE LOWER(h.status) = 'open'
    ORDER BY h.symbol ASC
  `).all();

  const holdingsRows = (holdingsResult.results || []) as any[];

  const riskHoldings: RiskHoldingInput[] = holdingsRows.map(r => ({
    symbol: r.symbol,
    shares: Number(r.shares) || 0,
    lastPrice: r.last_price !== null && r.last_price !== undefined ? Number(r.last_price) : null,
    status: r.status,
  }));

  // 2. Themes from theme_sector_contexts and theme_symbol_mappings
  const themesResult = await db.prepare(`
    SELECT 
      m.symbol,
      c.notebook_id,
      c.theme_name
    FROM theme_sector_contexts c
    LEFT JOIN theme_symbol_mappings m ON c.notebook_id = m.notebook_id
  `).all();

  const themeMappings: ThemeMappingInput[] = ((themesResult.results || []) as any[]).map(r => ({
    symbol: r.symbol || '',
    themeName: r.theme_name,
    notebookId: r.notebook_id,
  }));

  // Build current price lookup from holdings
  const priceBySymbol: Record<string, number> = {};
  for (const h of holdingsRows) {
    if (h.last_price !== null && h.last_price !== undefined && Number(h.last_price) > 0) {
      priceBySymbol[h.symbol] = Number(h.last_price);
    }
  }

  // 3. DCF valuation scenarios (Base Case & Bear Case)
  const dcfResult = await db.prepare(`
    SELECT symbol, scenario_name, implied_share_price
    FROM dcf_calculations
    WHERE scenario_name IN ('Base Case', 'Bear Case')
    ORDER BY id DESC
  `).all();

  const dcfBySymbol: Record<string, { baseMoS?: number; bearMoS?: number; baseIntrinsic?: number; bearIntrinsic?: number }> = {};
  for (const row of (dcfResult.results || []) as any[]) {
    const sym = row.symbol;
    if (!dcfBySymbol[sym]) {
      dcfBySymbol[sym] = {};
    }
    const scenarioName = row.scenario_name || row.scenario;
    const impliedPrice = row.implied_share_price !== null && row.implied_share_price !== undefined
      ? Number(row.implied_share_price)
      : (row.intrinsic_price !== null && row.intrinsic_price !== undefined ? Number(row.intrinsic_price) : undefined);

    const currentPrice = priceBySymbol[sym];
    let mos: number | undefined = undefined;
    if (row.margin_of_safety_pct !== null && row.margin_of_safety_pct !== undefined) {
      mos = Number(row.margin_of_safety_pct);
    } else if (currentPrice && currentPrice > 0 && impliedPrice !== undefined && impliedPrice > 0) {
      mos = Number((((impliedPrice - currentPrice) / currentPrice) * 100).toFixed(1));
    }

    if (scenarioName === 'Base Case' && dcfBySymbol[sym].baseIntrinsic === undefined && dcfBySymbol[sym].baseMoS === undefined) {
      dcfBySymbol[sym].baseMoS = mos;
      dcfBySymbol[sym].baseIntrinsic = impliedPrice;
    } else if (scenarioName === 'Bear Case' && dcfBySymbol[sym].bearIntrinsic === undefined && dcfBySymbol[sym].bearMoS === undefined) {
      dcfBySymbol[sym].bearMoS = mos;
      dcfBySymbol[sym].bearIntrinsic = impliedPrice;
    }
  }

  // 4. Fundamental intelligence (conviction score & debate from debate_json)
  const fundamentalsResult = await db.prepare(`
    SELECT symbol, debate_json
    FROM stock_fundamentals
  `).all();

  const fundamentalsBySymbol: Record<string, { convictionScore?: number; hasDebate?: boolean }> = {};
  for (const row of (fundamentalsResult.results || []) as any[]) {
    let convictionScore: number | undefined = undefined;
    let hasDebate = false;
    if (row.debate_json) {
      hasDebate = true;
      try {
        const parsed = typeof row.debate_json === 'string' ? JSON.parse(row.debate_json) : row.debate_json;
        if (parsed && typeof parsed === 'object') {
          const score = parsed.synthesis?.conviction_score ?? parsed.conviction_score;
          if (typeof score === 'number' && !isNaN(score)) {
            convictionScore = score;
          }
        }
      } catch {
        // Corrupt or non-JSON debate string
      }
    }
    if (convictionScore === undefined && row.conviction_score !== null && row.conviction_score !== undefined) {
      const num = Number(row.conviction_score);
      if (!isNaN(num)) {
        convictionScore = num;
      }
    }
    fundamentalsBySymbol[row.symbol] = {
      convictionScore,
      hasDebate,
    };
  }

  // 5. Historical prices (last 380 calendar days for ~252 trading days)
  const startDate = getStartDate('1y');
  const symbolsToFetch = Array.from(new Set([...riskHoldings.map(h => h.symbol), '^GSPC']));

  const priceSeries: Record<string, { date: string; close: number }[]> = {};

  if (symbolsToFetch.length > 0) {
    // SQLite parameter limit safeguard
    const placeholders = symbolsToFetch.map(() => '?').join(',');
    const priceRowsResult = await db.prepare(`
      SELECT symbol, date, close
      FROM historical_prices
      WHERE symbol IN (${placeholders}) AND date >= ?
      ORDER BY date ASC
    `).bind(...symbolsToFetch, startDate).all();

    for (const row of (priceRowsResult.results || []) as any[]) {
      if (!priceSeries[row.symbol]) {
        priceSeries[row.symbol] = [];
      }
      priceSeries[row.symbol].push({
        date: row.date,
        close: Number(row.close),
      });
    }

    // Check for symbols with missing history and trigger background sync
    if (executionCtx) {
      for (const sym of symbolsToFetch) {
        if (!priceSeries[sym] || priceSeries[sym].length === 0) {
          executionCtx.waitUntil(ensureSymbolPrices(db, sym));
        }
      }
    }
  }

  // 6. Latest saved advisory
  const latestAdvisoryResult = await db.prepare(`
    SELECT id, health_score, risk_level, executive_summary, key_warnings_json, rebalancing_actions_json, source, created_at
    FROM portfolio_risk_advisories
    ORDER BY id DESC LIMIT 1
  `).first<any>();

  let latestAdvisory = null;
  if (latestAdvisoryResult) {
    try {
      latestAdvisory = {
        ...latestAdvisoryResult,
        key_warnings: JSON.parse(latestAdvisoryResult.key_warnings_json || '[]'),
        rebalancing_actions: JSON.parse(latestAdvisoryResult.rebalancing_actions_json || '[]'),
      };
    } catch {
      latestAdvisory = latestAdvisoryResult;
    }
  }

  return {
    holdingsRows,
    riskHoldings,
    themeMappings,
    dcfBySymbol,
    fundamentalsBySymbol,
    priceSeries,
    latestAdvisory,
  };
}

// GET /api/portfolio/risk-audit - Deterministic Risk, Concentration, Correlation & Beta
risk.get('/api/portfolio/risk-audit', async (c) => {
  try {
    const data = await loadPortfolioRiskData(c.env.DB, getSafeExecutionCtx(c));

    const concentration = computeConcentrationAudit(
      data.riskHoldings,
      data.themeMappings,
      DEFAULT_RISK_CONFIG
    );

    const correlation = computeCorrelationAndBeta(
      data.riskHoldings,
      data.priceSeries,
      '^GSPC',
      DEFAULT_RISK_CONFIG.correlationThreshold
    );

    const health = computePortfolioHealthScore(concentration, correlation);

    // Compute sizing capacity and enrich with fundamentals for each holding
    const holdingsSizing = concentration.stockConcentrations.map(sc => {
      const holdingRow = data.holdingsRows.find(h => h.symbol === sc.symbol);
      const price = holdingRow?.last_price || 0;
      const sizing = calculateFixedBasePositionSize({
        symbol: sc.symbol,
        currentPrice: price,
        audit: concentration,
        themeMappings: data.themeMappings,
        config: DEFAULT_RISK_CONFIG,
      });

      const dcf = data.dcfBySymbol[sc.symbol];
      const fund = data.fundamentalsBySymbol[sc.symbol];

      return {
        ...sc,
        name: holdingRow?.name || sc.symbol,
        sector_label: holdingRow?.sector_label || null,
        shares: holdingRow?.shares || 0,
        lastPrice: price,
        stockBeta: correlation.stockBetas[sc.symbol] ?? 1.0,
        stockAnnualizedVol: correlation.stockAnnualizedVolatilities[sc.symbol] ?? 20.0,
        dcfBaseMoS: dcf?.baseMoS ?? null,
        dcfBearMoS: dcf?.bearMoS ?? null,
        dcfBaseIntrinsic: dcf?.baseIntrinsic ?? null,
        dcfBearIntrinsic: dcf?.bearIntrinsic ?? null,
        convictionScore: fund?.convictionScore ?? null,
        hasDebate: fund?.hasDebate ?? false,
        sizing,
      };
    });

    return c.json({
      concentration,
      correlation,
      health,
      holdingsSizing,
      latestAdvisory: data.latestAdvisory,
    });
  } catch (error: any) {
    console.error('[RiskAudit] Error generating risk audit:', error);
    return c.json({ error: error.message || 'Failed to compute risk audit' }, 500);
  }
});

// POST /api/portfolio/position-sizing - Sizing & Pre-Trade Simulation
risk.post('/api/portfolio/position-sizing', async (c) => {
  try {
    const body = await c.req.json();
    const symbol = (body.symbol || '').trim().toUpperCase();
    if (!symbol) {
      return c.json({ error: 'symbol is required' }, 400);
    }

    const price = Number(body.price) || 0;
    const shares = Number(body.shares) || 0;
    const tradeType = body.type === 'Sell' ? 'Sell' : 'Buy';

    const customConfig: RiskCapConfig = {
      targetWeightPct: Number(body.config?.targetWeightPct) || DEFAULT_RISK_CONFIG.targetWeightPct,
      stockWarningPct: Number(body.config?.stockWarningPct) || DEFAULT_RISK_CONFIG.stockWarningPct,
      maxStockCapPct: Number(body.config?.maxStockCapPct) || DEFAULT_RISK_CONFIG.maxStockCapPct,
      themeWarningPct: Number(body.config?.themeWarningPct) || DEFAULT_RISK_CONFIG.themeWarningPct,
      maxThemeCapPct: Number(body.config?.maxThemeCapPct) || DEFAULT_RISK_CONFIG.maxThemeCapPct,
      correlationThreshold: Number(body.config?.correlationThreshold) || DEFAULT_RISK_CONFIG.correlationThreshold,
    };

    const data = await loadPortfolioRiskData(c.env.DB, getSafeExecutionCtx(c));

    const concentration = computeConcentrationAudit(
      data.riskHoldings,
      data.themeMappings,
      customConfig
    );

    const sizing = calculateFixedBasePositionSize({
      symbol,
      currentPrice: price,
      audit: concentration,
      themeMappings: data.themeMappings,
      config: customConfig,
    });

    let simulation = null;
    if (shares > 0 && price > 0) {
      simulation = simulatePreTradeImpact({
        audit: concentration,
        order: {
          symbol,
          type: tradeType,
          shares,
          price,
        },
        themeMappings: data.themeMappings,
        config: customConfig,
      });
    }

    return c.json({
      symbol,
      sizing,
      simulation,
    });
  } catch (error: any) {
    console.error('[PositionSizing] Error:', error);
    return c.json({ error: error.message || 'Failed to calculate position size' }, 500);
  }
});

// POST /api/portfolio/risk-advisory - Run AI Risk Officer Audit using Workers AI
risk.post('/api/portfolio/risk-advisory', async (c) => {
  try {
    const data = await loadPortfolioRiskData(c.env.DB, getSafeExecutionCtx(c));

    const concentration = computeConcentrationAudit(
      data.riskHoldings,
      data.themeMappings,
      DEFAULT_RISK_CONFIG
    );

    const correlation = computeCorrelationAndBeta(
      data.riskHoldings,
      data.priceSeries,
      '^GSPC',
      DEFAULT_RISK_CONFIG.correlationThreshold
    );

    const health = computePortfolioHealthScore(concentration, correlation);

    // Format concise risk audit context for Workers AI
    const breachedStocks = concentration.stockConcentrations
      .filter(s => s.status === 'breach')
      .map(s => `${s.symbol} (${s.weightPct.toFixed(1)}% weight, trim $${Math.round(s.trimToCapUsd)})`);

    const warningStocks = concentration.stockConcentrations
      .filter(s => s.status === 'warning')
      .map(s => `${s.symbol} (${s.weightPct.toFixed(1)}% weight)`);

    const breachedThemes = concentration.themeExposures
      .filter(t => !t.isUnassigned && t.status === 'breach')
      .map(t => `${t.themeName} (${t.weightPct.toFixed(1)}% weight)`);

    const highCorrPairs = correlation.highCorrelationPairs
      .slice(0, 5)
      .map(p => `${p.symbolA} & ${p.symbolB} (r=${p.correlation.toFixed(2)}, combined weight ${p.combinedWeightPct.toFixed(1)}%)`);

    const contextPayload = {
      totalStockPortfolioUsd: Math.round(concentration.totalStockPortfolioUsd),
      healthScore: health.healthScore,
      riskLevel: health.riskLevel,
      portfolioBetaVsSP500: Number(correlation.portfolioBeta.toFixed(2)),
      effectivePositions: Number(concentration.effectivePositions.toFixed(1)),
      top3ConcentrationPct: Number(concentration.top3ConcentrationPct.toFixed(1)),
      breachedStocks,
      warningStocks,
      breachedThemes,
      highCorrelationPairs: highCorrPairs,
    };

    const systemPrompt = `You are the Chief Risk Officer for Oaktree Capital Management, strictly adhering to Howard Marks' principles on risk control, margin of safety, and avoiding catastrophic drawdowns.
Analyze the provided portfolio concentration and correlation audit. Produce a high-conviction, disciplined risk advisory.
Return ONLY valid JSON matching this schema:
{
  "executive_summary": "string (2-3 sentences assessing overall portfolio fragility, beta exposure, and concentration)",
  "key_warnings": ["string (bullet point warning)", ...],
  "rebalancing_actions": ["string (concrete action, e.g. 'Trim MSFT by $X to bring within 15% cap')", ...]
}
Do NOT use unescaped double quotes inside strings. Ensure clean JSON output.`;

    const userPrompt = `Here is the current portfolio risk audit:
${JSON.stringify(contextPayload, null, 2)}

Provide your Risk Officer Advisory in the specified JSON format.`;

    const aiResponse = await c.env.AI.run(c.env.default_ai_model, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const aiText = (aiResponse as any).choices?.[0]?.message?.content || aiResponse.response || '';
    const parsed = parseAIJson(aiText);

    const executiveSummary = parsed.executive_summary || 'Risk audit completed.';
    const keyWarnings = Array.isArray(parsed.key_warnings) ? parsed.key_warnings : [];
    const rebalancingActions = Array.isArray(parsed.rebalancing_actions) ? parsed.rebalancing_actions : [];

    // Save into portfolio_risk_advisories
    const insertResult = await c.env.DB.prepare(`
      INSERT INTO portfolio_risk_advisories (
        health_score, risk_level, executive_summary, key_warnings_json, rebalancing_actions_json, source, created_at
      ) VALUES (?, ?, ?, ?, ?, 'workers_ai', datetime('now'))
    `).bind(
      health.healthScore,
      health.riskLevel,
      executiveSummary,
      JSON.stringify(keyWarnings),
      JSON.stringify(rebalancingActions)
    ).run();

    const newId = insertResult.meta?.last_row_id;
    const savedAdvisory = {
      id: newId,
      health_score: health.healthScore,
      risk_level: health.riskLevel,
      executive_summary: executiveSummary,
      key_warnings: keyWarnings,
      rebalancing_actions: rebalancingActions,
      source: 'workers_ai',
      created_at: new Date().toISOString(),
    };

    return c.json({
      success: true,
      advisory: savedAdvisory,
    });
  } catch (error: any) {
    console.error('[RiskAdvisory] Error running AI risk audit:', error);
    return c.json({ error: error.message || 'Failed to run AI risk audit' }, 500);
  }
});

// DELETE /api/portfolio/themes/:name
risk.delete('/api/portfolio/themes/:name', async (c) => {
  const rawName = c.req.param('name');
  if (!rawName || !rawName.trim()) {
    return c.json({ error: 'Theme name is required' }, 400);
  }

  const themeName = decodeURIComponent(rawName).trim();

  try {
    const deleteMappingsSql = `
      DELETE FROM theme_symbol_mappings
      WHERE notebook_id IN (
        SELECT notebook_id FROM theme_sector_contexts WHERE LOWER(TRIM(theme_name)) = LOWER(TRIM(?))
      )
    `;
    const deleteContextSql = `
      DELETE FROM theme_sector_contexts
      WHERE LOWER(TRIM(theme_name)) = LOWER(TRIM(?))
    `;

    if (typeof c.env.DB.batch === 'function') {
      await c.env.DB.batch([
        c.env.DB.prepare(deleteMappingsSql).bind(themeName),
        c.env.DB.prepare(deleteContextSql).bind(themeName),
      ]);
    } else {
      await c.env.DB.prepare(deleteMappingsSql).bind(themeName).run();
      await c.env.DB.prepare(deleteContextSql).bind(themeName).run();
    }

    return c.json({ success: true, deletedTheme: themeName });
  } catch (error: any) {
    console.error('[DeleteTheme] Error deleting theme:', error);
    return c.json({ error: error.message || 'Failed to delete theme' }, 500);
  }
});

// PUT /api/portfolio/themes/:name
risk.put('/api/portfolio/themes/:name', async (c) => {
  const rawName = c.req.param('name');
  if (!rawName || !rawName.trim()) {
    return c.json({ error: 'Theme name is required' }, 400);
  }

  const oldThemeName = decodeURIComponent(rawName).trim();
  if (!oldThemeName || oldThemeName.toLowerCase() === 'unassigned') {
    return c.json({ error: 'Cannot rename Unassigned theme' }, 400);
  }

  try {
    const body = (await c.req.json().catch(() => ({}))) as any;
    const rawNewName = body?.newThemeName ?? body?.themeName ?? '';
    const newThemeName = typeof rawNewName === 'string' ? rawNewName.trim() : '';

    if (!newThemeName) {
      return c.json({ error: 'New theme name is required' }, 400);
    }

    if (newThemeName.toLowerCase() === 'unassigned') {
      return c.json({ error: 'Cannot rename theme to reserved name "Unassigned"' }, 400);
    }

    const updateContextSql = `
      UPDATE theme_sector_contexts
      SET theme_name = ?, updated_at = datetime('now')
      WHERE LOWER(TRIM(theme_name)) = LOWER(TRIM(?))
    `;

    await c.env.DB.prepare(updateContextSql).bind(newThemeName, oldThemeName).run();

    return c.json({
      success: true,
      oldThemeName,
      newThemeName,
    });
  } catch (error: any) {
    console.error('[UpdateTheme] Error renaming theme:', error);
    return c.json({ error: error.message || 'Failed to rename theme' }, 500);
  }
});

export default risk;
