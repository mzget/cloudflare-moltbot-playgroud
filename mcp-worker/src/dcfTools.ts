export interface DcfScenarioInput {
  scenario_name: 'Base Case' | 'Bull Case' | 'Bear Case';
  mode?: 'detailed' | 'uniform';
  base_revenue: number;
  shares_outstanding: number; // in Millions ($M)
  net_cash?: number;          // in Billions ($B)
  wacc: number;               // in percent (%)
  terminal_growth: number;    // in percent (%)
  tax_rate?: number;          // in percent (%)
  exit_multiple?: number;     // e.g. 20.0
  target_shares?: number;     // in Millions ($M)
  implied_share_price: number;
  yearly_growth?: number[];   // 5 numbers
  yearly_op_margin?: number[];// 5 numbers
  yearly_fcf_conv?: number[]; // 5 numbers
  revenue_growth?: number;
  operating_margin?: number;
  fcf_conversion?: number;
  rationale?: string;
  source?: string;
}

export interface SaveDcfScenariosArgs {
  symbol: string;
  sync_target_price?: boolean;
  scenarios: DcfScenarioInput[];
}

export async function saveDcfScenarios(env: any, args: SaveDcfScenariosArgs) {
  const { symbol, sync_target_price, scenarios } = args;

  if (!symbol || typeof symbol !== 'string') {
    return { error: 'symbol is required and must be a string' };
  }

  const symbolUpper = symbol.trim().toUpperCase();

  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    return { error: 'scenarios must be a non-empty array (1 to 3 scenarios)' };
  }

  if (scenarios.length > 3) {
    return { error: 'At most 3 scenarios allowed (Base Case, Bull Case, Bear Case)' };
  }

  const validNames = ['Base Case', 'Bull Case', 'Bear Case'];
  const seenNames = new Set<string>();

  for (const sc of scenarios) {
    if (!validNames.includes(sc.scenario_name)) {
      return { 
        error: `Invalid scenario_name: '${sc.scenario_name}'. Must be one of: 'Base Case', 'Bull Case', 'Bear Case'` 
      };
    }

    if (seenNames.has(sc.scenario_name)) {
      return { error: `Duplicate scenario_name: '${sc.scenario_name}' in request` };
    }
    seenNames.add(sc.scenario_name);

    // Guardrail: Shares must be in Millions (M)
    if (typeof sc.shares_outstanding !== 'number' || sc.shares_outstanding <= 0) {
      return { error: `shares_outstanding for '${sc.scenario_name}' must be a positive number in Millions ($M)` };
    }

    if (sc.shares_outstanding < 50) {
      return {
        error: `Suspicious shares_outstanding (${sc.shares_outstanding}) for '${sc.scenario_name}'. Shares MUST be in Millions ($M) (e.g. 15000 for 15 Billion shares, not 15).`
      };
    }

    if (sc.target_shares !== undefined && sc.target_shares < 50) {
      return {
        error: `Suspicious target_shares (${sc.target_shares}) for '${sc.scenario_name}'. Shares MUST be in Millions ($M).`
      };
    }

    // Guardrail: WACC must be strictly greater than terminal_growth
    if (typeof sc.wacc !== 'number' || typeof sc.terminal_growth !== 'number') {
      return { error: `wacc and terminal_growth for '${sc.scenario_name}' must be numbers` };
    }

    if (sc.terminal_growth >= sc.wacc) {
      return {
        error: `terminal_growth (${sc.terminal_growth}%) must be strictly less than wacc (${sc.wacc}%) for '${sc.scenario_name}' to prevent division by zero or negative terminal value.`
      };
    }

    // Detailed mode array length check if provided
    if (sc.yearly_growth && sc.yearly_growth.length !== 5) {
      return { error: `yearly_growth for '${sc.scenario_name}' must have exactly 5 elements` };
    }
    if (sc.yearly_op_margin && sc.yearly_op_margin.length !== 5) {
      return { error: `yearly_op_margin for '${sc.scenario_name}' must have exactly 5 elements` };
    }
    if (sc.yearly_fcf_conv && sc.yearly_fcf_conv.length !== 5) {
      return { error: `yearly_fcf_conv for '${sc.scenario_name}' must have exactly 5 elements` };
    }
  }

  // Build atomic batch statements
  const batchStatements: any[] = [];
  let baseCasePrice: number | null = null;

  for (const sc of scenarios) {
    if (sc.scenario_name === 'Base Case') {
      baseCasePrice = sc.implied_share_price;
    }

    // Delete existing scenario for overwrite protocol (ADR 0004)
    batchStatements.push(
      env.DB.prepare('DELETE FROM dcf_calculations WHERE symbol = ? AND scenario_name = ?')
        .bind(symbolUpper, sc.scenario_name)
    );

    const mode = sc.mode || 'detailed';
    const baseRevenue = sc.base_revenue;
    const revenueGrowth = mode === 'detailed' ? (sc.yearly_growth?.[0] ?? sc.revenue_growth ?? 0) : (sc.revenue_growth ?? 0);
    const baseGrossMargin = mode === 'detailed' ? (sc.yearly_op_margin?.[0] ?? sc.operating_margin ?? 0) : (sc.operating_margin ?? 0);
    const grossMarginImprovement = (mode === 'detailed' && sc.yearly_op_margin && sc.yearly_op_margin.length >= 2)
      ? Math.max(0, sc.yearly_op_margin[1] - sc.yearly_op_margin[0])
      : 0;
    const opexMargin = 0;
    const taxRate = sc.tax_rate ?? 21.0;
    const fcfConversion = mode === 'detailed' ? (sc.yearly_fcf_conv?.[0] ?? sc.fcf_conversion ?? 75) : (sc.fcf_conversion ?? 75);
    const wacc = sc.wacc;
    const terminalGrowth = sc.terminal_growth;
    const sharesOutstanding = sc.shares_outstanding;
    const netCash = sc.net_cash ?? 0;
    const exitMultiple = sc.exit_multiple ?? 20.0;
    const targetShares = sc.target_shares ?? sc.shares_outstanding;
    const impliedSharePrice = sc.implied_share_price;
    const yearlyGrowth = sc.yearly_growth ? JSON.stringify(sc.yearly_growth) : null;
    const yearlyOpMargin = sc.yearly_op_margin ? JSON.stringify(sc.yearly_op_margin) : null;
    const yearlyFcfConv = sc.yearly_fcf_conv ? JSON.stringify(sc.yearly_fcf_conv) : null;
    const rationale = sc.rationale ?? null;
    const source = sc.source ?? 'gemini_spark';

    batchStatements.push(
      env.DB.prepare(`
        INSERT INTO dcf_calculations (
          symbol, scenario_name, base_revenue, revenue_growth, base_gross_margin,
          gross_margin_improvement, opex_margin, tax_rate, fcf_conversion,
          wacc, terminal_growth, shares_outstanding, net_cash, exit_multiple, target_shares, implied_share_price,
          mode, yearly_growth, yearly_op_margin, yearly_fcf_conv, rationale, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        symbolUpper,
        sc.scenario_name,
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
        source
      )
    );
  }

  // If sync_target_price is true and Base Case exists, update target_price in watchlist
  let targetPriceSynced = false;
  if (sync_target_price && baseCasePrice !== null && baseCasePrice > 0) {
    batchStatements.push(
      env.DB.prepare('UPDATE watchlist SET target_price = ? WHERE symbol = ?')
        .bind(baseCasePrice, symbolUpper)
    );
    targetPriceSynced = true;
  }

  await env.DB.batch(batchStatements);

  return {
    success: true,
    symbol: symbolUpper,
    saved_scenarios: scenarios.map(s => s.scenario_name),
    target_price_synced: targetPriceSynced,
    message: `Successfully saved ${scenarios.length} DCF scenarios for ${symbolUpper}`
  };
}

export async function getDcfModel(env: any, symbol: string) {
  if (!symbol || typeof symbol !== 'string') {
    return { error: 'symbol is required' };
  }

  const symbolUpper = symbol.trim().toUpperCase();

  const [dcfRes, marketRes] = await Promise.all([
    env.DB.prepare(
      `SELECT * FROM dcf_calculations 
       WHERE symbol = ? 
       ORDER BY CASE scenario_name 
         WHEN 'Base Case' THEN 1 
         WHEN 'Bull Case' THEN 2 
         WHEN 'Bear Case' THEN 3 
         ELSE 4 END`
    ).bind(symbolUpper).all(),
    env.DB.prepare('SELECT price, market_cap, pe_ratio FROM market_stats WHERE symbol = ?')
      .bind(symbolUpper).first()
  ]);

  const currentPrice = marketRes?.price ?? null;
  const rawScenarios = dcfRes?.results || [];

  const scenarios = rawScenarios.map((row: any) => {
    let yearlyGrowth = null;
    let yearlyOpMargin = null;
    let yearlyFcfConv = null;

    try {
      if (row.yearly_growth) yearlyGrowth = JSON.parse(row.yearly_growth);
    } catch {}
    try {
      if (row.yearly_op_margin) yearlyOpMargin = JSON.parse(row.yearly_op_margin);
    } catch {}
    try {
      if (row.yearly_fcf_conv) yearlyFcfConv = JSON.parse(row.yearly_fcf_conv);
    } catch {}

    const impliedPrice = row.implied_share_price;
    let upsideDownsidePct: number | null = null;
    let marginOfSafetyPct: number | null = null;

    if (currentPrice && currentPrice > 0 && impliedPrice && impliedPrice > 0) {
      upsideDownsidePct = Number((((impliedPrice - currentPrice) / currentPrice) * 100).toFixed(2));
      marginOfSafetyPct = impliedPrice > currentPrice
        ? Number((((impliedPrice - currentPrice) / impliedPrice) * 100).toFixed(2))
        : 0;
    }

    return {
      scenario_name: row.scenario_name,
      mode: row.mode || 'detailed',
      implied_share_price: impliedPrice,
      current_price: currentPrice,
      upside_downside_pct: upsideDownsidePct,
      margin_of_safety_pct: marginOfSafetyPct,
      base_revenue: row.base_revenue,
      wacc: row.wacc,
      terminal_growth: row.terminal_growth,
      exit_multiple: row.exit_multiple,
      shares_outstanding: row.shares_outstanding,
      net_cash: row.net_cash,
      tax_rate: row.tax_rate,
      yearly_growth: yearlyGrowth,
      yearly_op_margin: yearlyOpMargin,
      yearly_fcf_conv: yearlyFcfConv,
      rationale: row.rationale,
      source: row.source || 'manual',
      created_at: row.created_at
    };
  });

  return {
    symbol: symbolUpper,
    current_price: currentPrice,
    scenario_count: scenarios.length,
    scenarios
  };
}

export async function listDcfSymbols(env: any) {
  const { results } = await env.DB.prepare(`
    SELECT 
      d.symbol,
      MAX(CASE WHEN d.scenario_name = 'Base Case' THEN d.implied_share_price END) as base_case_price,
      MAX(CASE WHEN d.scenario_name = 'Bull Case' THEN d.implied_share_price END) as bull_case_price,
      MAX(CASE WHEN d.scenario_name = 'Bear Case' THEN d.implied_share_price END) as bear_case_price,
      MAX(d.created_at) as last_updated,
      MAX(d.source) as source,
      m.price as current_price
    FROM dcf_calculations d
    LEFT JOIN market_stats m ON d.symbol = m.symbol
    GROUP BY d.symbol
    ORDER BY d.symbol ASC
  `).all();

  const formatted = (results || []).map((row: any) => {
    let upsidePct: number | null = null;
    if (row.current_price && row.current_price > 0 && row.base_case_price && row.base_case_price > 0) {
      upsidePct = Number((((row.base_case_price - row.current_price) / row.current_price) * 100).toFixed(2));
    }

    return {
      symbol: row.symbol,
      current_price: row.current_price,
      base_case_price: row.base_case_price,
      bull_case_price: row.bull_case_price,
      bear_case_price: row.bear_case_price,
      base_upside_pct: upsidePct,
      last_updated: row.last_updated,
      source: row.source
    };
  });

  return {
    total_symbols: formatted.length,
    symbols: formatted
  };
}

