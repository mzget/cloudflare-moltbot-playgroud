import type { Env } from './index';
import {
  formatDebateContext,
  getBullOpeningPrompt,
  getBearOpeningPrompt,
  getBullRebuttalPrompt,
  getBearRebuttalPrompt,
  getArbiterSynthesisPrompt,
  type MarketEventItem,
  type NotebookArticleItem
} from './analysisPrompts';
import {
  type StockFundamental,
  type StockFundamentalDbRow,
  type ThemeSectorContext,
  deserializeStockFundamental
} from './fundamentals';

export type MarketEvent = MarketEventItem;

export interface QualitativeData {
  readonly events: readonly MarketEventItem[];
  readonly fundamental: StockFundamental | null;
  readonly themes: readonly ThemeSectorContext[];
  readonly articles?: readonly NotebookArticleItem[];
}

export interface BullOpeningOutput {
  readonly bull_thesis: string;
  readonly growth_catalysts: readonly string[];
  readonly competitive_advantages: readonly string[];
  readonly valuation_upside: string;
}

export interface BearOpeningOutput {
  readonly bear_thesis: string;
  readonly downside_risks: readonly string[];
  readonly structural_headwinds: readonly string[];
  readonly valuation_stretch: string;
}

export interface BullRebuttalOutput {
  readonly rebuttal_arguments: readonly string[];
  readonly mitigating_factors: readonly string[];
}

export interface BearRebuttalOutput {
  readonly rebuttal_arguments: readonly string[];
  readonly skeptical_counters: readonly string[];
}

export interface KeyTensionItem {
  readonly topic: string;
  readonly bull_argument: string;
  readonly bear_argument: string;
  readonly decisive_factor: string;
}

export type ConvictionLabel = 'Strong Bull' | 'Moderate Bull' | 'Neutral' | 'Moderate Bear' | 'Strong Bear';

export interface ArbiterSynthesisOutput {
  readonly key_tensions: readonly KeyTensionItem[];
  readonly consensus_points: readonly string[];
  readonly conviction_score: number;
  readonly conviction_label: ConvictionLabel;
  readonly verdict_summary: string;
}

export interface DialecticalDebateResult {
  readonly symbol: string;
  readonly round1: {
    readonly bull: BullOpeningOutput;
    readonly bear: BearOpeningOutput;
  };
  readonly round2_rebuttal: {
    readonly bull_rebuttal: BullRebuttalOutput;
    readonly bear_rebuttal: BearRebuttalOutput;
  };
  readonly synthesis: ArbiterSynthesisOutput;
  readonly model_used: string;
  readonly created_at: string;
}

/**
 * Robust JSON parser for AI outputs with unescaped newline handling
 */
export function parseDebateAIJson<T>(rawText: string, fallback: T): T {
  if (!rawText || typeof rawText !== 'string') return fallback;
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fallback;

  const rawJson = jsonMatch[0];
  try {
    return JSON.parse(rawJson) as T;
  } catch {
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
          cleaned += '\\n';
        } else {
          cleaned += char;
        }
        escape = false;
      }
    }
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      return fallback;
    }
  }
}

/**
 * Maps conviction score (-10 to +10) to standardized human-readable label
 */
export function calculateConvictionLabel(score: number): ConvictionLabel {
  const clamped = Math.max(-10, Math.min(10, Math.round(score)));
  if (clamped >= 7) return 'Strong Bull';
  if (clamped >= 2) return 'Moderate Bull';
  if (clamped <= -7) return 'Strong Bear';
  if (clamped <= -2) return 'Moderate Bear';
  return 'Neutral';
}

/**
 * Fetches qualitative fundamental brief, linked themes, recent events and articles for the symbol from Cloudflare D1
 */
export async function fetchQualitativeData(
  db: D1Database | undefined,
  symbol: string
): Promise<QualitativeData> {
  if (!db || typeof db.prepare !== 'function') {
    return { events: [], fundamental: null, themes: [], articles: [] };
  }

  const symbolUpper = symbol.trim().toUpperCase();

  try {
    const fundamentalSql = `
      SELECT 
        symbol, business_model, moat, competitors, guidance,
        key_risks, thesis_kpis, as_of_date, notebook_id, source_count, updated_at
      FROM stock_fundamentals
      WHERE symbol = ?
    `;

    const themeSql = `
      SELECT 
        t.notebook_id, t.theme_name, t.industry_dynamics,
        t.supply_chain_bottlenecks, t.competitive_landscape, t.macro_trends, t.updated_at
      FROM theme_sector_contexts t
      INNER JOIN theme_symbol_mappings m ON t.notebook_id = m.notebook_id
      WHERE m.symbol = ?
      ORDER BY t.updated_at DESC
    `;

    const eventsSql = `
      SELECT title, description, event_date, event_type
      FROM market_events
      WHERE symbol = ?
      ORDER BY event_date DESC
      LIMIT 5
    `;

    const articlesSql = `
      SELECT title, summary, key_takeaways
      FROM notebook_articles
      WHERE symbol = ?
      ORDER BY created_at DESC
      LIMIT 3
    `;

    const fundamentalStmt = db.prepare(fundamentalSql).bind(symbolUpper);
    const fundamentalPromise = typeof fundamentalStmt.first === 'function'
      ? fundamentalStmt.first<StockFundamentalDbRow>().catch(() => null)
      : (typeof (fundamentalStmt as any).all === 'function'
          ? (fundamentalStmt as any).all().then((r: any) => r?.results?.[0] ?? null).catch(() => null)
          : Promise.resolve(null));

    const [fundamentalRow, themesRes, eventsRes, articlesRes] = await Promise.all([
      fundamentalPromise,
      db.prepare(themeSql).bind(symbolUpper).all<any>().catch(() => ({ results: [] })),
      db.prepare(eventsSql).bind(symbolUpper).all<MarketEventItem>().catch(() => ({ results: [] })),
      db.prepare(articlesSql).bind(symbolUpper).all<NotebookArticleItem>().catch(() => ({ results: [] }))
    ]);

    const fundamental: StockFundamental | null = fundamentalRow
      ? deserializeStockFundamental(fundamentalRow)
      : null;

    const themes: ThemeSectorContext[] = ((themesRes?.results || []) as any[]).map((row: any) => ({
      notebook_id: row.notebook_id,
      theme_name: row.theme_name,
      industry_dynamics: row.industry_dynamics || '',
      supply_chain_bottlenecks: row.supply_chain_bottlenecks || null,
      competitive_landscape: row.competitive_landscape || null,
      macro_trends: row.macro_trends || null,
      updated_at: row.updated_at || undefined,
      symbols: [symbolUpper]
    }));

    return {
      events: eventsRes?.results || [],
      fundamental,
      themes,
      articles: articlesRes?.results || []
    };
  } catch (err) {
    console.warn(`[DebateEngine] Failed to fetch qualitative data for ${symbolUpper}:`, err);
    return { events: [], fundamental: null, themes: [], articles: [] };
  }
}

/**
 * Runs 3-round TauricResearch/TradingAgents Dialectical Debate:
 * Round 1: Parallel Bull & Bear opening theses
 * Round 2: Parallel Bull & Bear cross-examination rebuttals
 * Round 3: Dialectical Arbiter synthesis & conviction score
 */
export async function runDialecticalDebate(
  env: Env,
  symbol: string,
  metricsStr: string,
  qualitativeData?: QualitativeData
): Promise<DialecticalDebateResult> {
  const symbolUpper = symbol.toUpperCase();
  const modelToUse = env.default_ai_model || '@cf/google/gemma-4-26b-a4b-it';

  // 1. Data Grounding
  const data: QualitativeData = qualitativeData ?? (await fetchQualitativeData(env.DB, symbolUpper));
  const contextStr = formatDebateContext(
    metricsStr,
    data.events as MarketEventItem[],
    (data.articles || []) as NotebookArticleItem[],
    { fundamental: data.fundamental ?? null, themes: data.themes ?? [] }
  );

  // Default fallbacks for error resilience
  const fallbackBullOpening: BullOpeningOutput = {
    bull_thesis: `โมเดลธุรกิจของ ${symbolUpper} มีความแข็งแกร่งและมีศักยภาพการเติบโตต่อเนื่อง`,
    growth_catalysts: ['รายได้และส่วนแบ่งตลาดขยายตัว', 'โอกาสจากความต้องการในอุตสาหกรรม'],
    competitive_advantages: ['ปราการการแข่งขัน (Moat) ที่คู่แข่งเลียนแบบได้ยาก'],
    valuation_upside: 'ราคาปัจจุบันสะท้อนมูลค่าที่น่าสนใจเมื่อเทียบกับศักยภาพการเติบโต'
  };

  const fallbackBearOpening: BearOpeningOutput = {
    bear_thesis: `ความเสี่ยงหลักของ ${symbolUpper} คือความผันผวนของตลาดและแรงกดดันด้านอัตรากำไร`,
    downside_risks: ['แรงกดดันด้านต้นทุนและการแข่งขันที่สูงขึ้น', 'ความไม่แน่นอนทางเศรษฐกิจมหภาค'],
    structural_headwinds: ['การเปลี่ยนแปลงทางเทคโนโลยีที่อาจกระทบต่อโมเดลเดิม'],
    valuation_stretch: 'ระดับ Valuation ต้องจับตาความเสี่ยงในการถูกปรับลดประมาณการ'
  };

  const fallbackBullRebuttal: BullRebuttalOutput = {
    rebuttal_arguments: ['บริษัทมีวินัยทางการเงินและกระแสเงินสดเพียงพอในการรับมือความเสี่ยง'],
    mitigating_factors: ['การกระจายความเสี่ยงและฐานลูกค้าที่ภักดี']
  };

  const fallbackBearRebuttal: BearRebuttalOutput = {
    rebuttal_arguments: ['การเติบโตในอดีตอาจชะลอตัวลงเนื่องจากฐานรายได้ที่ใหญ่ขึ้น'],
    skeptical_counters: ['ประมาณการกำไรของตลาดยังคงสูงเกินจริง']
  };

  const fallbackArbiter: ArbiterSynthesisOutput = {
    key_tensions: [
      {
        topic: 'ความยั่งยืนของการเติบโตของอัตรากำไร (Margin Sustainability)',
        bull_argument: 'ความสามารถในการกำหนดราคาช่วยรักษาอัตรากำไรให้อยู่ในระดับสูง',
        bear_argument: 'การแข่งขันและแรงกดดันด้านต้นทุนจะบีบให้อัตรากำไรลดลง',
        decisive_factor: 'ผลประกอบการไตรมาสถัดไปและตัวเลข Operating Margin'
      }
    ],
    consensus_points: ['งบการเงินและสภาพคล่องมีความมั่นคงในระยะสั้นถึงปานกลาง'],
    conviction_score: 0,
    conviction_label: 'Neutral',
    verdict_summary: `ทั้งมุมมอง Bull และ Bear สำหรับ ${symbolUpper} มีน้ำหนักใกล้เคียงกัน นักลงทุนควรพิจารณาความผันผวนและรอจังหวะที่มี Margin of Safety เพียงพอ`
  };

  // ==========================================
  // ROUND 1: Parallel Opening Theses
  // ==========================================
  console.log(`[DebateEngine] Starting Round 1 (Opening Theses) for ${symbolUpper}...`);
  const bullPrompt1 = getBullOpeningPrompt(symbolUpper, contextStr);
  const bearPrompt1 = getBearOpeningPrompt(symbolUpper, contextStr);

  let bullOpening: BullOpeningOutput = fallbackBullOpening;
  let bearOpening: BearOpeningOutput = fallbackBearOpening;

  try {
    const [bullRes1, bearRes1] = await Promise.all([
      env.AI.run(modelToUse, {
        messages: [
          { role: 'system', content: bullPrompt1.system },
          { role: 'user', content: bullPrompt1.prompt }
        ],
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      } as any),
      env.AI.run(modelToUse, {
        messages: [
          { role: 'system', content: bearPrompt1.system },
          { role: 'user', content: bearPrompt1.prompt }
        ],
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      } as any)
    ]);

    const bullText1 = (bullRes1 as any)?.choices?.[0]?.message?.content || bullRes1?.response || '';
    const bearText1 = (bearRes1 as any)?.choices?.[0]?.message?.content || bearRes1?.response || '';

    bullOpening = parseDebateAIJson<BullOpeningOutput>(bullText1, fallbackBullOpening);
    bearOpening = parseDebateAIJson<BearOpeningOutput>(bearText1, fallbackBearOpening);
  } catch (err) {
    console.warn(`[DebateEngine] Round 1 parallel execution error for ${symbolUpper}:`, err);
  }

  // ==========================================
  // ROUND 2: Parallel Cross-Examination Rebuttal
  // ==========================================
  console.log(`[DebateEngine] Starting Round 2 (Cross-Examination Rebuttals) for ${symbolUpper}...`);
  const bullRebuttalPrompt = getBullRebuttalPrompt(symbolUpper, contextStr, JSON.stringify(bearOpening));
  const bearRebuttalPrompt = getBearRebuttalPrompt(symbolUpper, contextStr, JSON.stringify(bullOpening));

  let bullRebuttal: BullRebuttalOutput = fallbackBullRebuttal;
  let bearRebuttal: BearRebuttalOutput = fallbackBearRebuttal;

  try {
    const [bullRes2, bearRes2] = await Promise.all([
      env.AI.run(modelToUse, {
        messages: [
          { role: 'system', content: bullRebuttalPrompt.system },
          { role: 'user', content: bullRebuttalPrompt.prompt }
        ],
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      } as any),
      env.AI.run(modelToUse, {
        messages: [
          { role: 'system', content: bearRebuttalPrompt.system },
          { role: 'user', content: bearRebuttalPrompt.prompt }
        ],
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      } as any)
    ]);

    const bullText2 = (bullRes2 as any)?.choices?.[0]?.message?.content || bullRes2?.response || '';
    const bearText2 = (bearRes2 as any)?.choices?.[0]?.message?.content || bearRes2?.response || '';

    bullRebuttal = parseDebateAIJson<BullRebuttalOutput>(bullText2, fallbackBullRebuttal);
    bearRebuttal = parseDebateAIJson<BearRebuttalOutput>(bearText2, fallbackBearRebuttal);
  } catch (err) {
    console.warn(`[DebateEngine] Round 2 parallel execution error for ${symbolUpper}:`, err);
  }

  // ==========================================
  // ROUND 3: Dialectical Arbiter Synthesis
  // ==========================================
  console.log(`[DebateEngine] Starting Round 3 (Arbiter Synthesis) for ${symbolUpper}...`);
  const fullDebateTranscript = {
    round1: {
      bull: bullOpening,
      bear: bearOpening
    },
    round2_rebuttal: {
      bull: bullRebuttal,
      bear: bearRebuttal
    }
  };

  const arbiterPrompt = getArbiterSynthesisPrompt(symbolUpper, contextStr, JSON.stringify(fullDebateTranscript));
  let synthesis: ArbiterSynthesisOutput = fallbackArbiter;

  try {
    const arbiterRes = await env.AI.run(modelToUse, {
      messages: [
        { role: 'system', content: arbiterPrompt.system },
        { role: 'user', content: arbiterPrompt.prompt }
      ],
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    } as any);

    const arbiterText = (arbiterRes as any)?.choices?.[0]?.message?.content || arbiterRes?.response || '';
    const parsedArbiter = parseDebateAIJson<any>(arbiterText, fallbackArbiter);

    const rawScore = typeof parsedArbiter.conviction_score === 'number' ? parsedArbiter.conviction_score : 0;
    const clampedScore = Math.max(-10, Math.min(10, Math.round(rawScore)));

    synthesis = {
      key_tensions: Array.isArray(parsedArbiter.key_tensions) && parsedArbiter.key_tensions.length > 0
        ? parsedArbiter.key_tensions
        : fallbackArbiter.key_tensions,
      consensus_points: Array.isArray(parsedArbiter.consensus_points) && parsedArbiter.consensus_points.length > 0
        ? parsedArbiter.consensus_points
        : fallbackArbiter.consensus_points,
      conviction_score: clampedScore,
      conviction_label: calculateConvictionLabel(clampedScore),
      verdict_summary: typeof parsedArbiter.verdict_summary === 'string' && parsedArbiter.verdict_summary.trim()
        ? parsedArbiter.verdict_summary.trim()
        : fallbackArbiter.verdict_summary
    };
  } catch (err) {
    console.warn(`[DebateEngine] Round 3 arbiter execution error for ${symbolUpper}:`, err);
  }

  return {
    symbol: symbolUpper,
    round1: {
      bull: bullOpening,
      bear: bearOpening
    },
    round2_rebuttal: {
      bull_rebuttal: bullRebuttal,
      bear_rebuttal: bearRebuttal
    },
    synthesis,
    model_used: modelToUse,
    created_at: new Date().toISOString()
  };
}
