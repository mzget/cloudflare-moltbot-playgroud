import { Env } from './index';
import { 
  MarketStatsData, 
  formatMetricsForPrompt, 
  DEFAULT_AI_MODEL,
  getLynchPrompt,
  getHelmerPrompt,
  getBuffettPrompt,
  getMungerPrompt,
  getMarksPrompt,
  getGreenblattPrompt,
  getSynthesisPrompt,
  getFinalReportPrompt
} from './analysisPrompts';

function parseAIJson(text: string): any {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON object found in AI response');
  }
  
  const rawJson = jsonMatch[0];
  try {
    return JSON.parse(rawJson);
  } catch (e) {
    let inString = false;
    let escape = false;
    let cleaned = '';
    for (let k = 0; k < rawJson.length; k++) {
      const char = rawJson[k];
      if (char === '"' && !escape) {
        inString = !inString;
        cleaned += char;
      } else if (char === '\\' && inString) {
        escape = !escape;
        cleaned += char;
      } else {
        if (inString && (char === '\n' || char === '\r')) {
          if (char === '\n') {
            cleaned += '\\n';
          } else if (char === '\r') {
            if (rawJson[k + 1] === '\n') {
              // ok
            } else {
              cleaned += '\\n';
            }
          }
        } else {
          cleaned += char;
        }
        escape = false;
      }
    }
    return JSON.parse(cleaned);
  }
}

export async function getOrUpdateMarketStats(env: Env, symbol: string): Promise<MarketStatsData> {
  const symbolUpper = symbol.toUpperCase();
  
  const existing = await env.DB.prepare(
    'SELECT * FROM market_stats WHERE symbol = ?'
  ).bind(symbolUpper).first<MarketStatsData>();
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  
  if (existing && existing.updated_at && existing.updated_at > oneDayAgo) {
    console.log('Using cached market stats for ' + symbolUpper);
    return existing;
  }
  
  const apiKey = env.FINNHUB_API_KEY;
  if (!apiKey) {
    if (existing) {
      console.warn('FINNHUB_API_KEY is not set. Using outdated stats for ' + symbolUpper);
      return existing;
    }
    throw new Error('FINNHUB_API_KEY is not configured and no cached market stats exist.');
  }
  
  console.log('Fetching fresh market stats from Finnhub for ' + symbolUpper + '...');
  
  const [quoteRes, metricRes] = await Promise.all([
    fetch('https://finnhub.io/api/v1/quote?symbol=' + symbolUpper + '&token=' + apiKey),
    fetch('https://finnhub.io/api/v1/stock/metric?symbol=' + symbolUpper + '&metric=all&token=' + apiKey)
  ]);
  
  if (!quoteRes.ok || !metricRes.ok) {
    if (existing) {
      console.warn('Failed to fetch fresh stats for ' + symbolUpper + '. Using cached stats.');
      return existing;
    }
    throw new Error('Failed to fetch market stats for ' + symbolUpper + ' from Finnhub');
  }
  
  const q = await quoteRes.json() as any;
  const mResponse = await metricRes.json() as any;
  const m = mResponse.metric || {};
  
  const price = q.c || null;
  const market_cap = m.marketCapitalization || null;
  let revenues = null;
  if (market_cap && m.psTTM && m.psTTM > 0) {
    revenues = market_cap / m.psTTM;
  }
  
  const revenue_1y_growth = typeof m.revenueGrowthTTMYoy === 'number'
    ? m.revenueGrowthTTMYoy / 100
    : (typeof m.revenueGrowthTTM === 'number' ? m.revenueGrowthTTM / 100 : null);
  const revenue_3y_cagr = typeof m.revenueGrowth3Y === 'number' ? m.revenueGrowth3Y / 100 : null;
  const revenue_5y_cagr = typeof m.revenueGrowth5Y === 'number' ? m.revenueGrowth5Y / 100 : null;
  
  const gross_profit_margin = typeof m.grossMarginTTM === 'number' ? m.grossMarginTTM / 100 : null;
  const operating_margin = typeof m.operatingMarginTTM === 'number' ? m.operatingMarginTTM / 100 : null;
  
  let fcf_margin = typeof m.freeCashFlowMarginTTM === 'number' ? m.freeCashFlowMarginTTM / 100 : null;
  if (m.psTTM && m.pfcfShareTTM && m.pfcfShareTTM > 0) {
    fcf_margin = m.psTTM / m.pfcfShareTTM;
  }
  
  const p_ocf = typeof m.pcfShareTTM === 'number' ? m.pcfShareTTM : null;
  const p_fcf = typeof m.pfcfShareTTM === 'number' ? m.pfcfShareTTM : null;
  
  let capex_to_ocf = typeof m.capexToOperatingCashFlowTTM === 'number' ? m.capexToOperatingCashFlowTTM / 100 : null;
  if (p_ocf !== null && p_fcf !== null && p_fcf !== 0) {
    capex_to_ocf = 1 - (p_ocf / p_fcf);
  }
  
  const rd_to_revenue = typeof m.researchAndDevelopmentToRevenueTTM === 'number' ? m.researchAndDevelopmentToRevenueTTM / 100 : null;
  const debt_equity = typeof m.totalDebtToEquityTTM === 'number'
    ? m.totalDebtToEquityTTM
    : (typeof m['totalDebt/totalEquityQuarterly'] === 'number' ? m['totalDebt/totalEquityQuarterly'] : null);
  const p_e = typeof m.peBasicExclExtraTTM === 'number' ? m.peBasicExclExtraTTM : null;
  
  let total_cash = typeof m.cashAndCashEquivalents === 'number' ? m.cashAndCashEquivalents : null;
  if (m.cashPerSharePerShareQuarterly && revenues && m.revenuePerShareTTM && m.revenuePerShareTTM > 0) {
    const sharesOut = revenues / m.revenuePerShareTTM;
    total_cash = m.cashPerSharePerShareQuarterly * sharesOut;
  }
  
  let net_debt = typeof m.netDebt === 'number' ? m.netDebt : null;
  if (m.enterpriseValue && market_cap) {
    net_debt = m.enterpriseValue - market_cap;
  }
  
  let total_debt = typeof m.totalDebt === 'number' ? m.totalDebt : null;
  if (typeof m.longTermDebt === 'number' && typeof m.shortTermDebt === 'number') {
    total_debt = m.longTermDebt + m.shortTermDebt;
  } else if (net_debt !== null && total_cash !== null) {
    total_debt = net_debt + total_cash;
  }
  
  const dividend_yield = typeof m.dividendYieldIndicatedAnnual === 'number'
    ? m.dividendYieldIndicatedAnnual / 100
    : (typeof m.dividendYieldTTM === 'number' ? m.dividendYieldTTM / 100 : null);
  
  const ev_sales = typeof m.evRevenueTTM === 'number' ? m.evRevenueTTM : null;
  let ev_ebit = null;
  if (m.enterpriseValue && revenues && operating_margin && operating_margin !== 0) {
    ev_ebit = m.enterpriseValue / (revenues * operating_margin);
  }
  
  const currentUtc = new Date().toISOString().replace('T', ' ').slice(0, 19);
  
  await env.DB.prepare(`
    INSERT INTO market_stats (
      symbol, market_cap, revenues, revenue_3y_cagr, revenue_1y_growth, revenue_5y_cagr,
      gross_profit_margin, operating_margin, ev_ebit, ev_sales,
      p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
      p_e, fcf_margin, total_cash, net_debt, total_debt, dividend_yield,
      price, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(symbol) DO UPDATE SET
      market_cap=excluded.market_cap, revenues=excluded.revenues,
      revenue_3y_cagr=excluded.revenue_3y_cagr, revenue_1y_growth=excluded.revenue_1y_growth,
      revenue_5y_cagr=excluded.revenue_5y_cagr, gross_profit_margin=excluded.gross_profit_margin,
      operating_margin=excluded.operating_margin, ev_ebit=excluded.ev_ebit, ev_sales=excluded.ev_sales,
      p_ocf=excluded.p_ocf, p_fcf=excluded.p_fcf, capex_to_ocf=excluded.capex_to_ocf,
      rd_to_revenue=excluded.rd_to_revenue, debt_equity=excluded.debt_equity, p_e=excluded.p_e,
      fcf_margin=excluded.fcf_margin, total_cash=excluded.total_cash, net_debt=excluded.net_debt,
      total_debt=excluded.total_debt, dividend_yield=excluded.dividend_yield,
      price=excluded.price, updated_at=excluded.updated_at
  `).bind(
    symbolUpper, market_cap, revenues, revenue_3y_cagr, revenue_1y_growth, revenue_5y_cagr,
    gross_profit_margin, operating_margin, ev_ebit, ev_sales,
    p_ocf, p_fcf, capex_to_ocf, rd_to_revenue, debt_equity,
    p_e, fcf_margin, total_cash, net_debt, total_debt, dividend_yield,
    price, currentUtc
  ).run();
  
  return {
    symbol: symbolUpper, price, market_cap, revenues, revenue_1y_growth, revenue_3y_cagr, revenue_5y_cagr,
    gross_profit_margin, operating_margin, ev_ebit, ev_sales, p_ocf, p_fcf, capex_to_ocf,
    rd_to_revenue, debt_equity, p_e, fcf_margin, total_cash, net_debt, total_debt, dividend_yield,
    updated_at: currentUtc
  };
}

async function fetchFrameworkContent(env: Env, category: string): Promise<string> {
  const row = await env.DB.prepare(
    'SELECT content FROM knowledge_base WHERE category = ?'
  ).bind(category).first<{ content: string }>();
  return row?.content || '';
}

export async function runFullAnalysis(env: Env, symbol: string): Promise<{
  symbol: string;
  summary: string;
  conviction_level: string;
  framework_results: string;
}> {
  const symbolUpper = symbol.toUpperCase();
  const stats = await getOrUpdateMarketStats(env, symbolUpper);
  const metricsStr = formatMetricsForPrompt(stats);
  
  const [lynchFw, helmerFw, buffettFw, mungerFw, marksFw, greenblattFw] = await Promise.all([
    fetchFrameworkContent(env, 'peter_lynch'),
    fetchFrameworkContent(env, 'hamilton_helmer'),
    fetchFrameworkContent(env, 'warren_buffett'),
    fetchFrameworkContent(env, 'charlie_munger'),
    fetchFrameworkContent(env, 'howard_marks'),
    fetchFrameworkContent(env, 'joel_greenblatt')
  ]);
  
  const stepResults: Record<string, any> = {};
  
  console.log('Starting Step 1 (Peter Lynch) for ' + symbolUpper + '...');
  const lynchPrompt = getLynchPrompt(symbolUpper, metricsStr, lynchFw);
  const lynchAIResponse = await env.AI.run(DEFAULT_AI_MODEL, {
    messages: [
      { role: 'system', content: lynchPrompt.system },
      { role: 'user', content: lynchPrompt.prompt }
    ],
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  } as any);
  let lynchText = (lynchAIResponse as any).choices?.[0]?.message?.content || lynchAIResponse.response || '';
  stepResults.peter_lynch = parseAIJson(lynchText);
  
  console.log('Starting Step 2 (7 Powers) for ' + symbolUpper + '...');
  const helmerPrompt = getHelmerPrompt(symbolUpper, metricsStr, helmerFw, JSON.stringify(stepResults.peter_lynch));
  const helmerAIResponse = await env.AI.run(DEFAULT_AI_MODEL, {
    messages: [
      { role: 'system', content: helmerPrompt.system },
      { role: 'user', content: helmerPrompt.prompt }
    ],
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  } as any);
  let helmerText = (helmerAIResponse as any).choices?.[0]?.message?.content || helmerAIResponse.response || '';
  stepResults.hamilton_helmer = parseAIJson(helmerText);
  
  console.log('Starting Step 3 (Warren Buffett) for ' + symbolUpper + '...');
  const buffettPrompt = getBuffettPrompt(symbolUpper, metricsStr, buffettFw, JSON.stringify({
    peter_lynch: stepResults.peter_lynch,
    hamilton_helmer: stepResults.hamilton_helmer
  }));
  const buffettAIResponse = await env.AI.run(DEFAULT_AI_MODEL, {
    messages: [
      { role: 'system', content: buffettPrompt.system },
      { role: 'user', content: buffettPrompt.prompt }
    ],
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  } as any);
  let buffettText = (buffettAIResponse as any).choices?.[0]?.message?.content || buffettAIResponse.response || '';
  stepResults.warren_buffett = parseAIJson(buffettText);
  
  console.log('Starting Step 4 (Charlie Munger) for ' + symbolUpper + '...');
  const mungerPrompt = getMungerPrompt(symbolUpper, metricsStr, mungerFw, JSON.stringify({
    peter_lynch: stepResults.peter_lynch,
    hamilton_helmer: stepResults.hamilton_helmer,
    warren_buffett: stepResults.warren_buffett
  }));
  const mungerAIResponse = await env.AI.run(DEFAULT_AI_MODEL, {
    messages: [
      { role: 'system', content: mungerPrompt.system },
      { role: 'user', content: mungerPrompt.prompt }
    ],
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  } as any);
  let mungerText = (mungerAIResponse as any).choices?.[0]?.message?.content || mungerAIResponse.response || '';
  stepResults.charlie_munger = parseAIJson(mungerText);
  
  console.log('Starting Step 5 (Howard Marks) for ' + symbolUpper + '...');
  const marksPrompt = getMarksPrompt(symbolUpper, metricsStr, marksFw, JSON.stringify({
    peter_lynch: stepResults.peter_lynch,
    hamilton_helmer: stepResults.hamilton_helmer,
    warren_buffett: stepResults.warren_buffett,
    charlie_munger: stepResults.charlie_munger
  }));
  const marksAIResponse = await env.AI.run(DEFAULT_AI_MODEL, {
    messages: [
      { role: 'system', content: marksPrompt.system },
      { role: 'user', content: marksPrompt.prompt }
    ],
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  } as any);
  let marksText = (marksAIResponse as any).choices?.[0]?.message?.content || marksAIResponse.response || '';
  stepResults.howard_marks = parseAIJson(marksText);
  
  console.log('Starting Step 6 (Joel Greenblatt) for ' + symbolUpper + '...');
  const greenblattPrompt = getGreenblattPrompt(symbolUpper, metricsStr, greenblattFw, JSON.stringify({
    peter_lynch: stepResults.peter_lynch,
    hamilton_helmer: stepResults.hamilton_helmer,
    warren_buffett: stepResults.warren_buffett,
    charlie_munger: stepResults.charlie_munger,
    howard_marks: stepResults.howard_marks
  }));
  const greenblattAIResponse = await env.AI.run(DEFAULT_AI_MODEL, {
    messages: [
      { role: 'system', content: greenblattPrompt.system },
      { role: 'user', content: greenblattPrompt.prompt }
    ],
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  } as any);
  let greenblattText = (greenblattAIResponse as any).choices?.[0]?.message?.content || greenblattAIResponse.response || '';
  stepResults.joel_greenblatt = parseAIJson(greenblattText);
  
  console.log('Starting Step 7 (Synthesis) for ' + symbolUpper + '...');
  const synthesisPrompt = getSynthesisPrompt(symbolUpper, metricsStr, JSON.stringify(stepResults));
  const synthesisAIResponse = await env.AI.run(DEFAULT_AI_MODEL, {
    messages: [
      { role: 'system', content: synthesisPrompt.system },
      { role: 'user', content: synthesisPrompt.prompt }
    ],
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  } as any);
  let synthesisText = (synthesisAIResponse as any).choices?.[0]?.message?.content || synthesisAIResponse.response || '';
  const synthesis = parseAIJson(synthesisText);
  stepResults.synthesis = synthesis;
  
  console.log('Starting Step 8 (Markdown Compilation) for ' + symbolUpper + '...');
  const reportPrompt = getFinalReportPrompt(symbolUpper, metricsStr, JSON.stringify(synthesis), JSON.stringify(stepResults));
  const reportAIResponse = await env.AI.run(DEFAULT_AI_MODEL, {
    messages: [
      { role: 'system', content: reportPrompt.system },
      { role: 'user', content: reportPrompt.prompt }
    ],
    max_tokens: 8192
  } as any);
  const reportMarkdown = (reportAIResponse as any).choices?.[0]?.message?.content || reportAIResponse.response || '';
  
  const convictionLevel = synthesis.conviction_level || 'Medium';
  const frameworkResultsStr = JSON.stringify(stepResults);
  const currentUtc = new Date().toISOString().replace('T', ' ').slice(0, 19);
  
  await env.DB.prepare(`
    INSERT INTO analysis_results (symbol, summary, conviction_level, framework_results, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    symbolUpper,
    reportMarkdown,
    convictionLevel,
    frameworkResultsStr,
    currentUtc,
    currentUtc
  ).run();
  
  console.log('Analysis complete for ' + symbolUpper + '. Conviction: ' + convictionLevel);
  
  return {
    symbol: symbolUpper,
    summary: reportMarkdown,
    conviction_level: convictionLevel,
    framework_results: frameworkResultsStr
  };
}