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
} from '@oaktree/shared';

// Helper to query all necessary portfolio data from D1
async function queryPortfolioRiskData(db: any) {
  // 1. Open Holdings
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

  // 2. Theme mappings
  const themesResult = await db.prepare(`
    SELECT 
      m.symbol,
      m.notebook_id,
      c.theme_name
    FROM theme_symbol_mappings m
    JOIN theme_sector_contexts c ON m.notebook_id = c.notebook_id
  `).all();

  const themeMappings: ThemeMappingInput[] = ((themesResult.results || []) as any[]).map(r => ({
    symbol: r.symbol,
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

  const dcfBySymbol: Record<string, { baseMoS?: number; bearMoS?: number }> = {};
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

    if (scenarioName === 'Base Case' && dcfBySymbol[sym].baseMoS === undefined) {
      dcfBySymbol[sym].baseMoS = mos;
    } else if (scenarioName === 'Bear Case' && dcfBySymbol[sym].bearMoS === undefined) {
      dcfBySymbol[sym].bearMoS = mos;
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

  // 5. Historical prices (last 380 calendar days)
  const now = new Date();
  const d = new Date();
  d.setFullYear(now.getFullYear() - 1);
  const startDate = d.toISOString().split('T')[0];

  const symbolsToFetch = Array.from(new Set([...riskHoldings.map(h => h.symbol), '^GSPC']));
  const priceSeries: PriceSeriesBySymbol = {};

  if (symbolsToFetch.length > 0) {
    const placeholders = symbolsToFetch.map(() => '?').join(',');
    const priceRowsResult = await db.prepare(`
      SELECT symbol, date, close
      FROM historical_prices
      WHERE symbol IN (${placeholders}) AND date >= ?
      ORDER BY date ASC
    `).bind(...symbolsToFetch, startDate).all();

    const mutableSeries: Record<string, { date: string; close: number }[]> = {};
    for (const row of (priceRowsResult.results || []) as any[]) {
      if (!mutableSeries[row.symbol]) {
        mutableSeries[row.symbol] = [];
      }
      mutableSeries[row.symbol].push({
        date: row.date,
        close: Number(row.close),
      });
    }
    Object.assign(priceSeries, mutableSeries);
  }

  // 6. Latest saved advisory
  const latestAdvisoryResult = await db.prepare(`
    SELECT id, health_score, risk_level, executive_summary, key_warnings_json, rebalancing_actions_json, source, created_at
    FROM portfolio_risk_advisories
    ORDER BY id DESC LIMIT 1
  `).first();

  let latestAdvisory = null;
  if (latestAdvisoryResult) {
    try {
      latestAdvisory = {
        ...latestAdvisoryResult,
        key_warnings: JSON.parse((latestAdvisoryResult as any).key_warnings_json || '[]'),
        rebalancing_actions: JSON.parse((latestAdvisoryResult as any).rebalancing_actions_json || '[]'),
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

/**
 * MCP Tool 1: get_portfolio_risk_audit
 */
export async function getPortfolioRiskAudit(env: any) {
  try {
    const data = await queryPortfolioRiskData(env.DB);

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
        convictionScore: fund?.convictionScore ?? null,
        hasDebate: fund?.hasDebate ?? false,
        sizing,
      };
    });

    return {
      concentration,
      correlation,
      health,
      holdingsSizing,
      latestAdvisory: data.latestAdvisory,
    };
  } catch (error: any) {
    return { error: error.message || 'Failed to compute portfolio risk audit' };
  }
}

export interface CalculatePositionSizeArgs {
  symbol: string;
  price?: number;
  shares?: number;
  type?: 'Buy' | 'Sell';
}

/**
 * MCP Tool 2: calculate_position_size
 */
export async function calculatePositionSize(env: any, args: CalculatePositionSizeArgs) {
  try {
    const symbol = (args.symbol || '').trim().toUpperCase();
    if (!symbol) {
      return { error: 'symbol is required' };
    }

    const price = Number(args.price) || 0;
    const shares = Number(args.shares) || 0;
    const tradeType = args.type === 'Sell' ? 'Sell' : 'Buy';

    const data = await queryPortfolioRiskData(env.DB);

    const concentration = computeConcentrationAudit(
      data.riskHoldings,
      data.themeMappings,
      DEFAULT_RISK_CONFIG
    );

    const sizing = calculateFixedBasePositionSize({
      symbol,
      currentPrice: price,
      audit: concentration,
      themeMappings: data.themeMappings,
      config: DEFAULT_RISK_CONFIG,
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
        config: DEFAULT_RISK_CONFIG,
      });
    }

    return {
      symbol,
      sizing,
      simulation,
    };
  } catch (error: any) {
    return { error: error.message || 'Failed to calculate position size' };
  }
}

export interface SaveRiskAdvisoryArgs {
  health_score: number;
  risk_level: 'Low' | 'Moderate' | 'Elevated' | 'High';
  executive_summary: string;
  key_warnings: string[];
  rebalancing_actions: string[];
  source?: string;
}

/**
 * MCP Tool 3: save_risk_advisory
 */
export async function saveRiskAdvisory(env: any, args: SaveRiskAdvisoryArgs) {
  try {
    const { health_score, risk_level, executive_summary, key_warnings, rebalancing_actions } = args;

    if (typeof health_score !== 'number' || isNaN(health_score) || health_score < 0 || health_score > 100) {
      return { error: 'health_score must be a number between 0 and 100' };
    }

    const validLevels = ['Low', 'Moderate', 'Elevated', 'High'];
    if (!validLevels.includes(risk_level)) {
      return { error: `risk_level must be one of: ${validLevels.join(', ')}` };
    }

    if (!executive_summary || typeof executive_summary !== 'string') {
      return { error: 'executive_summary must be a non-empty string' };
    }

    if (!Array.isArray(key_warnings)) {
      return { error: 'key_warnings must be an array of strings' };
    }

    if (!Array.isArray(rebalancing_actions)) {
      return { error: 'rebalancing_actions must be an array of strings' };
    }

    const source = args.source || 'gemini_spark';

    const insertResult = await env.DB.prepare(`
      INSERT INTO portfolio_risk_advisories (
        health_score, risk_level, executive_summary, key_warnings_json, rebalancing_actions_json, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      health_score,
      risk_level,
      executive_summary,
      JSON.stringify(key_warnings),
      JSON.stringify(rebalancing_actions),
      source
    ).run();

    const newId = insertResult.meta?.last_row_id;

    return {
      success: true,
      id: newId,
      message: 'Risk Officer Advisory saved successfully',
    };
  } catch (error: any) {
    return { error: error.message || 'Failed to save risk advisory' };
  }
}
