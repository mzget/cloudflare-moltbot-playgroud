import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  fetchQualitativeData,
  runDialecticalDebate,
  parseDebateAIJson,
  calculateConvictionLabel,
  type DialecticalDebateResult
} from './debateEngine';

describe('Debate Prompts & Context Formatter', () => {
  it('formats context with metrics only when events, articles, and qualitative data are empty', () => {
    const metricsStr = 'Price: 100 USD\nP/E: 25';
    const context = formatDebateContext(metricsStr);
    expect(context).toContain('### 1. ข้อมูลทางการเงินและตัวชี้วัด (Financial Metrics):');
    expect(context).toContain('Price: 100 USD');
    expect(context).not.toContain('### 2.');
    expect(context).not.toContain('### 3.');
    expect(context).not.toContain('### 4.');
    expect(context).not.toContain('### 5.');
  });

  it('formats all 5 canonical sections when qualitative data, events, and articles are present', () => {
    const metricsStr = 'Price: 142.50 USD\nP/E: 78.5';
    const events: MarketEventItem[] = [
      { title: 'Q1 Earnings Beat', description: 'Revenue grew 39%', event_date: '2026-08-01', event_type: 'earnings' }
    ];
    const articles: NotebookArticleItem[] = [
      { title: 'SemiAnalysis ARM Teardown', summary: 'Deep analysis of CSS architectural licensing margin lift' }
    ];
    const qual = {
      fundamental: {
        symbol: 'ARM',
        business_model: 'IP licensing and royalty model',
        moat: 'Ecosystem lock-in',
        competitors: ['x86', 'RISC-V'],
        guidance: {
          revenue_target: 'Mid-20s % revenue CAGR',
          margin_target: '60% non-GAAP operating margin',
          timeframe: 'FY27',
          key_assumptions: 'CSS adoption acceleration'
        },
        key_risks: ['Customer in-housing', 'China joint venture'],
        thesis_kpis: ['Royalty per chip', 'CSS adoption rate'],
        as_of_date: '2026-07-29'
      },
      themes: [
        {
          notebook_id: 'nb_semi_01',
          theme_name: 'SemiAnalysis AI & Compute Dynamics',
          industry_dynamics: 'High capex transition',
          supply_chain_bottlenecks: 'CoWoS packaging constraints',
          competitive_landscape: 'TSMC advanced node monopoly',
          macro_trends: 'Hyperscaler sovereign AI buildout'
        }
      ]
    };

    const context = formatDebateContext(metricsStr, events, articles, qual);
    expect(context).toContain('### 1. ข้อมูลทางการเงินและตัวชี้วัด (Financial Metrics):');
    expect(context).toContain('Price: 142.50 USD');

    expect(context).toContain('### 2. ข้อมูลเชิงคุณภาพและบทวิเคราะห์พื้นฐาน (Company Fundamental Brief) [As of: 2026-07-29]:');
    expect(context).toContain('โมเดลธุรกิจ (Business Model): IP licensing and royalty model');
    expect(context).toContain('ปราการทางธุรกิจ (Economic Moat): Ecosystem lock-in');
    expect(context).toContain('เป้าหมายและการชี้นำของผู้บริหาร (Management Guidance): เป้ารายได้: Mid-20s % revenue CAGR | เป้าอัตรากำไร: 60% non-GAAP operating margin | กรอบเวลา: FY27 | สมมติฐานหลัก: CSS adoption acceleration');
    expect(context).toContain('คู่แข่งสำคัญ (Competitors): x86, RISC-V');
    expect(context).toContain('ปัจจัยความเสี่ยงสำคัญ (Key Risks): Customer in-housing; China joint venture');
    expect(context).toContain('ตัวชี้วัดวิทยานิพนธ์การลงทุน (Thesis KPIs): Royalty per chip; CSS adoption rate');

    expect(context).toContain('### 3. บริบทอุตสาหกรรมและภาพรวมการแข่งขัน (Sector & Competitive Dynamics):');
    expect(context).toContain('1. [ธีม: SemiAnalysis AI & Compute Dynamics]');
    expect(context).toContain('   - พลวัตอุตสาหกรรม: High capex transition');
    expect(context).toContain('   - คอขวดห่วงโซ่อุปทาน: CoWoS packaging constraints');

    expect(context).toContain('### 4. ข่าวและเหตุการณ์สำคัญล่าสุด (Recent Market Events):');
    expect(context).toContain('1. [EARNINGS] Q1 Earnings Beat (2026-08-01): Revenue grew 39%');

    expect(context).toContain('### 5. บทวิเคราะห์และมุมมองสังเคราะห์ (Research & Notes):');
    expect(context).toContain('1. หัวข้อ: SemiAnalysis ARM Teardown');
    expect(context).toContain('สรุป: Deep analysis of CSS architectural licensing margin lift');
  });

  it('renders defensive fallbacks for partial guidance, null moat, and empty thesis KPIs', () => {
    const qual = {
      fundamental: {
        symbol: 'PARTIAL',
        as_of_date: '2026-06-30',
        business_model: null,
        moat: null,
        guidance: { revenue_target: 'Single digit growth' },
        thesis_kpis: []
      },
      themes: []
    };
    const context = formatDebateContext('Price: 50 USD', [], [], qual);
    expect(context).toContain('โมเดลธุรกิจ (Business Model): N/A');
    expect(context).toContain('ปราการทางธุรกิจ (Economic Moat): N/A');
    expect(context).toContain('เป้ารายได้: Single digit growth');
    expect(context).not.toContain('เป้าอัตรากำไร:');
    expect(context).not.toContain('ตัวชี้วัดวิทยานิพนธ์การลงทุน (Thesis KPIs):');
    expect(context).not.toContain('### 3.');
  });

  it('handles null qualitative identically to empty qualitative object', () => {
    const res1 = formatDebateContext('Price: 100 USD', [], [], null);
    const res2 = formatDebateContext('Price: 100 USD', [], [], { fundamental: null, themes: [] });
    expect(res1).toBe(res2);
  });

  it('handles events without description without emitting undefined', () => {
    const events: MarketEventItem[] = [
      { title: 'Headline Only', event_date: '2026-09-01', event_type: 'macro', description: null }
    ];
    const res = formatDebateContext('Price: 100 USD', events);
    expect(res).toContain('### 4. ข่าวและเหตุการณ์สำคัญล่าสุด (Recent Market Events):');
    expect(res).toContain('[MACRO] Headline Only (2026-09-01)');
    expect(res).not.toContain('undefined');
  });

  it('generates prompt objects with mandatory grounding instructions and tokens', () => {
    const symbol = 'NVDA';
    const context = 'Price: 150 USD';
    
    const bullOpening = getBullOpeningPrompt(symbol, context);
    expect(bullOpening.system).toContain('Bullish Researcher Agent');
    expect(bullOpening.system).toContain('Management Guidance');
    expect(bullOpening.system).toContain('Moat');
    expect(bullOpening.system).toContain('Thesis KPIs');
    expect(bullOpening.system).toContain('ห้ามใช้เครื่องหมาย double quote ซ้อนภายในข้อความ');
    expect(bullOpening.prompt).toContain('NVDA');

    const bearOpening = getBearOpeningPrompt(symbol, context);
    expect(bearOpening.system).toContain('Bearish Researcher Agent');
    expect(bearOpening.system).toContain('Key Risks');
    expect(bearOpening.system).toContain('Structural Headwinds');
    expect(bearOpening.system).toContain('Inversion Thinking');
    expect(bearOpening.system).toContain('ห้ามใช้เครื่องหมาย double quote ซ้อนภายในข้อความ');
    expect(bearOpening.prompt).toContain('NVDA');

    const bullRebuttal = getBullRebuttalPrompt(symbol, context, '{"bear_thesis": "Too expensive"}');
    expect(bullRebuttal.system).toContain('Round 2: Cross-Examination Rebuttal');
    expect(bullRebuttal.system).toContain('Management Guidance');
    expect(bullRebuttal.system).toContain('Moat');
    expect(bullRebuttal.prompt).toContain('Too expensive');

    const bearRebuttal = getBearRebuttalPrompt(symbol, context, '{"bull_thesis": "Growth is infinite"}');
    expect(bearRebuttal.system).toContain('Round 2: Cross-Examination Rebuttal');
    expect(bearRebuttal.system).toContain('Guidance');
    expect(bearRebuttal.system).toContain('Moat');
    expect(bearRebuttal.prompt).toContain('Growth is infinite');

    const arbiter = getArbiterSynthesisPrompt(symbol, context, '{"transcript": "all rounds"}');
    expect(arbiter.system).toContain('Dialectical Arbiter Agent');
    expect(arbiter.system).toContain('Management Guidance');
    expect(arbiter.system).toContain('Moat');
    expect(arbiter.system).toContain('Thesis KPIs');
    expect(arbiter.prompt).toContain('all rounds');
  });
});


describe('parseDebateAIJson & calculateConvictionLabel', () => {
  it('parses clean JSON from AI output', () => {
    const raw = '```json\n{"bull_thesis": "Great upside", "growth_catalysts": ["AI"]}\n```';
    const parsed = parseDebateAIJson<any>(raw, { fallback: true });
    expect(parsed.bull_thesis).toBe('Great upside');
  });

  it('cleans unescaped newlines inside strings and parses correctly', () => {
    const raw = '{"summary": "Line 1\nLine 2", "score": 5}';
    const parsed = parseDebateAIJson<any>(raw, { fallback: true });
    expect(parsed.score).toBe(5);
  });

  it('returns fallback object if no JSON structure is found', () => {
    const raw = 'Sorry I cannot analyze this ticker.';
    const fallback = { error: 'fallback' };
    const parsed = parseDebateAIJson(raw, fallback);
    expect(parsed).toEqual(fallback);
  });

  it('correctly maps conviction scores to labels', () => {
    expect(calculateConvictionLabel(9)).toBe('Strong Bull');
    expect(calculateConvictionLabel(4)).toBe('Moderate Bull');
    expect(calculateConvictionLabel(0)).toBe('Neutral');
    expect(calculateConvictionLabel(-4)).toBe('Moderate Bear');
    expect(calculateConvictionLabel(-8)).toBe('Strong Bear');
    // Clamping checks
    expect(calculateConvictionLabel(15)).toBe('Strong Bull');
    expect(calculateConvictionLabel(-20)).toBe('Strong Bear');
  });
});

describe('fetchQualitativeData', () => {
  it('returns fundamental brief, linked themes, events, and articles for the symbol', async () => {
    const mockDb = {
      prepare: vi.fn((sql: string) => {
        if (sql.includes('FROM stock_fundamentals')) {
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue({
              symbol: 'ARM',
              business_model: 'IP licensing',
              moat: 'High switching costs',
              competitors: JSON.stringify(['x86', 'RISC-V']),
              guidance: JSON.stringify({ revenue_target: '25% CAGR' }),
              key_risks: JSON.stringify(['Risk 1']),
              thesis_kpis: JSON.stringify(['KPI 1', 'KPI 2']),
              as_of_date: '2026-07-29',
              notebook_id: 'nb_1',
              source_count: 3
            })
          };
        }
        if (sql.includes('FROM theme_sector_contexts t')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  notebook_id: 'nb_theme_1',
                  theme_name: 'SemiAnalysis',
                  industry_dynamics: 'Capex surge',
                  supply_chain_bottlenecks: 'Packaging'
                }
              ]
            })
          };
        }
        if (sql.includes('FROM market_events')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({
              results: [
                { title: 'New Chip Launch', description: 'Next gen GPU', event_date: '2026-09-01', event_type: 'news' }
              ]
            })
          };
        }
        if (sql.includes('FROM notebook_articles')) {
          return {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockResolvedValue({
              results: [
                { title: 'Thesis on ARM', summary: 'Very strong mobile moat', key_takeaways: '["Moat", "Margin"]' }
              ]
            })
          };
        }
        return {
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] })
        };
      })
    };

    const data = await fetchQualitativeData(mockDb as any, 'arm');
    expect(data.fundamental).toBeDefined();
    expect(data.fundamental?.symbol).toBe('ARM');
    expect(data.fundamental?.business_model).toBe('IP licensing');
    expect((data.fundamental?.guidance as any)?.revenue_target).toBe('25% CAGR');
    expect(data.fundamental?.thesis_kpis).toEqual(['KPI 1', 'KPI 2']);

    expect(data.themes).toHaveLength(1);
    expect(data.themes[0].theme_name).toBe('SemiAnalysis');
    expect(data.themes[0].symbols).toEqual(['ARM']);

    expect(data.events).toHaveLength(1);
    expect(data.events[0].title).toBe('New Chip Launch');
    expect(data.articles).toHaveLength(1);
    expect(data.articles?.[0].title).toBe('Thesis on ARM');
  });

  it('handles missing fundamental profile and unlinked themes gracefully', async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockResolvedValue(null),
        all: vi.fn().mockResolvedValue({ results: [] })
      }))
    };

    const data = await fetchQualitativeData(mockDb as any, 'UNKNOWN');
    expect(data.fundamental).toBeNull();
    expect(data.themes).toEqual([]);
    expect(data.events).toEqual([]);
    expect(data.articles).toEqual([]);
  });

  it('handles database exceptions gracefully and returns empty defaults', async () => {
    const brokenDb = {
      prepare: vi.fn(() => {
        throw new Error('D1 connection failed');
      })
    };

    const data = await fetchQualitativeData(brokenDb as any, 'AAPL');
    expect(data.events).toEqual([]);
    expect(data.articles).toEqual([]);
    expect(data.fundamental).toBeNull();
    expect(data.themes).toEqual([]);
  });

  it('handles null/undefined db binding gracefully', async () => {
    const data = await fetchQualitativeData(undefined as any, 'TSLA');
    expect(data.events).toEqual([]);
    expect(data.articles).toEqual([]);
    expect(data.fundamental).toBeNull();
    expect(data.themes).toEqual([]);
  });
});

describe('runDialecticalDebate (TauricResearch Dialectical Engine)', () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {
      default_ai_model: '@cf/google/gemma-4-26b-a4b-it',
      AI: {
        run: vi.fn(async (model: string, options: any) => {
          const sys = options.messages[0].content;
          if (sys.includes('Bullish Researcher Agent') && sys.includes('Round 2')) {
            return {
              response: JSON.stringify({
                rebuttal_arguments: ['Gross margin will stay high due to pricing power'],
                mitigating_factors: ['Software revenue mix increasing']
              })
            };
          }
          if (sys.includes('Bearish Researcher Agent') && sys.includes('Round 2')) {
            return {
              response: JSON.stringify({
                rebuttal_arguments: ['Hyperscaler capex cannot grow forever'],
                skeptical_counters: ['Custom silicon competition rising']
              })
            };
          }
          if (sys.includes('Bullish Researcher Agent')) {
            return {
              response: JSON.stringify({
                bull_thesis: 'Leading the AI revolution with unparalleled CUDA moat.',
                growth_catalysts: ['Hyperscale demand', 'Enterprise AI adoption'],
                competitive_advantages: ['CUDA Ecosystem', '80% Market Share'],
                valuation_upside: 'Fair value at 35x forward EPS'
              })
            };
          }
          if (sys.includes('Bearish Researcher Agent')) {
            return {
              response: JSON.stringify({
                bear_thesis: 'Cyclical peak in GPU spending and customer concentration risk.',
                downside_risks: ['Top 4 customers are 40% of sales', 'Margin compression'],
                structural_headwinds: ['Antitrust scrutiny', 'In-house ASICs'],
                valuation_stretch: 'Currently trading at 45x trailing P/E'
              })
            };
          }
          if (sys.includes('Dialectical Arbiter Agent')) {
            return {
              response: JSON.stringify({
                key_tensions: [
                  {
                    topic: 'Hyperscaler Capex Sustainability',
                    bull_argument: 'Capex will expand into inference era',
                    bear_argument: 'Capex digestion cycle is imminent',
                    decisive_factor: 'Next quarter datacenter guidance'
                  }
                ],
                consensus_points: ['Balance sheet has no debt issues', 'Technology leadership is unquestioned'],
                conviction_score: 5,
                conviction_label: 'Moderate Bull',
                verdict_summary: 'Bull case holds stronger edge due to software moat, but short-term volatility is high.'
              })
            };
          }
          return { response: '{}' };
        })
      },
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn().mockReturnThis(),
          all: vi.fn().mockResolvedValue({ results: [] })
        }))
      }
    };
  });

  it('runs complete 3-round dialectical debate and returns structured result', async () => {
    const result: DialecticalDebateResult = await runDialecticalDebate(
      mockEnv,
      'NVDA',
      'Price: 130 USD\nP/E: 45'
    );

    expect(result.symbol).toBe('NVDA');
    expect(result.model_used).toBe('@cf/google/gemma-4-26b-a4b-it');
    
    // Round 1 assertions
    expect(result.round1.bull.bull_thesis).toContain('CUDA moat');
    expect(result.round1.bull.growth_catalysts).toHaveLength(2);
    expect(result.round1.bear.bear_thesis).toContain('Cyclical peak');
    expect(result.round1.bear.downside_risks).toHaveLength(2);

    // Round 2 assertions
    expect(result.round2_rebuttal.bull_rebuttal.rebuttal_arguments[0]).toContain('Gross margin');
    expect(result.round2_rebuttal.bear_rebuttal.rebuttal_arguments[0]).toContain('Hyperscaler capex');

    // Round 3 Arbiter assertions
    expect(result.synthesis.key_tensions).toHaveLength(1);
    expect(result.synthesis.key_tensions[0].topic).toBe('Hyperscaler Capex Sustainability');
    expect(result.synthesis.conviction_score).toBe(5);
    expect(result.synthesis.conviction_label).toBe('Moderate Bull');
    expect(result.synthesis.consensus_points).toHaveLength(2);

    // Verify AI calls count:
    // Round 1: 2 parallel calls (Bull + Bear)
    // Round 2: 2 parallel calls (Bull Rebuttal + Bear Rebuttal)
    // Round 3: 1 Arbiter call
    // Total = 5 calls
    expect(mockEnv.AI.run).toHaveBeenCalledTimes(5);
  });

  it('handles AI failures in Round 1/2/3 gracefully with fallbacks', async () => {
    mockEnv.AI.run = vi.fn().mockRejectedValue(new Error('AI rate limit exceeded'));

    const result = await runDialecticalDebate(
      mockEnv,
      'TSLA',
      'Price: 200 USD'
    );

    expect(result.symbol).toBe('TSLA');
    expect(result.round1.bull.bull_thesis).toBeDefined();
    expect(result.round1.bear.bear_thesis).toBeDefined();
    expect(result.synthesis.conviction_label).toBe('Neutral');
    expect(result.synthesis.conviction_score).toBe(0);
  });

  it('passes qualitative fundamental profile and themes into debate context', async () => {
    let capturedPrompt = '';
    mockEnv.AI.run = vi.fn(async (_model: string, options: any) => {
      capturedPrompt = options.messages?.[1]?.content || options.prompt || '';
      return { response: JSON.stringify({ bull_thesis: 'ok', growth_catalysts: [], competitive_advantages: [], valuation_upside: 'ok' }) };
    });

    const qualData = {
      events: [],
      articles: [],
      fundamental: {
        symbol: 'ARM',
        business_model: 'Licensing architecture',
        moat: 'High switching costs',
        as_of_date: '2026-07-29',
        guidance: { revenue_target: '25% CAGR' },
        thesis_kpis: ['Royalty/chip']
      },
      themes: [
        {
          notebook_id: 'nb_1',
          theme_name: 'SemiAnalysis',
          industry_dynamics: 'Capex boom'
        }
      ]
    };

    await runDialecticalDebate(mockEnv, 'ARM', 'Price: 140 USD', qualData as any);
    expect(capturedPrompt).toContain('### 2. ข้อมูลเชิงคุณภาพและบทวิเคราะห์พื้นฐาน (Company Fundamental Brief)');
    expect(capturedPrompt).toContain('Licensing architecture');
    expect(capturedPrompt).toContain('### 3. บริบทอุตสาหกรรมและภาพรวมการแข่งขัน (Sector & Competitive Dynamics)');
    expect(capturedPrompt).toContain('SemiAnalysis');
  });
});

describe('Analysis Debate Routes (Hono Endpoints)', () => {
  it('GET /api/analysis/debate returns 400 when symbol is missing', async () => {
    const analysisRoutes = (await import('./routes/analysis')).default;
    const res = await analysisRoutes.request('/api/analysis/debate', { method: 'GET' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe('symbol is required');
  });

  it('GET /api/analysis/debate returns 404 when no analysis or debate found', async () => {
    const analysisRoutes = (await import('./routes/analysis')).default;
    const mockEnv = {
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null)
        }))
      }
    };
    const res = await analysisRoutes.request('/api/analysis/debate?symbol=AAPL', { method: 'GET' }, mockEnv);
    expect(res.status).toBe(404);
  });

  it('GET /api/analysis/debate returns parsed debate when present in framework_results', async () => {
    const analysisRoutes = (await import('./routes/analysis')).default;
    const mockDebate = { symbol: 'AAPL', synthesis: { conviction_score: 3 } };
    const mockEnv = {
      DB: {
        prepare: vi.fn(() => ({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            framework_results: JSON.stringify({ debate: mockDebate })
          })
        }))
      }
    };
    const res = await analysisRoutes.request('/api/analysis/debate?symbol=AAPL', { method: 'GET' }, mockEnv);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.symbol).toBe('AAPL');
    expect(data.synthesis.conviction_score).toBe(3);
  });

  it('GET /api/analysis/results ignores debate-only rows where summary is empty', async () => {
    const analysisRoutes = (await import('./routes/analysis')).default;
    let executedSql = '';
    const mockEnv = {
      DB: {
        prepare: vi.fn((sql: string) => {
          executedSql = sql;
          return {
            bind: vi.fn().mockReturnThis(),
            first: vi.fn().mockResolvedValue(null)
          };
        })
      }
    };
    const res = await analysisRoutes.request('/api/analysis/results?symbol=ARM', { method: 'GET' }, mockEnv);
    expect(res.status).toBe(404);
    expect(executedSql).toContain("summary IS NOT NULL AND summary != ''");
  });

  it('POST /api/analysis/debate inserts initial row into analysis_results when no record exists', async () => {
    const analysisRoutes = (await import('./routes/analysis')).default;
    let insertedSql = '';
    let insertedBinds: any[] = [];
    const mockEnv = {
      default_ai_model: '@cf/meta/llama-3-8b-instruct',
      AI: {
        run: vi.fn().mockImplementation(async (_model: string, options: any) => {
          const sys = options.messages?.[0]?.content || '';
          const user = options.messages?.[1]?.content || options.prompt || '';
          if (sys.includes('Arbiter') || user.includes('บันทึกการโต้วาที')) {
            return {
              response: JSON.stringify({
                key_tensions: [{ topic: 'Valuation', bull_argument: 'Cheap', bear_argument: 'Expensive', decisive_factor: 'Growth' }],
                consensus_points: ['Healthy balance sheet'],
                conviction_score: 5,
                conviction_label: 'Moderate Bull',
                verdict_summary: 'Moderate Bull edge'
              })
            };
          }
          return {
            response: JSON.stringify({
              bull_thesis: 'Leading IP provider',
              bear_thesis: 'Valuation concerns',
              growth_catalysts: ['AI PCs'],
              downside_risks: ['Customer in-housing'],
              structural_headwinds: ['Macro'],
              competitive_advantages: ['Moat'],
              valuation_upside: 'High growth',
              valuation_stretch: 'Multiple compression',
              rebuttal_arguments: ['Strong FCF'],
              mitigating_factors: ['Diversification'],
              skeptical_counters: ['Margin peak']
            })
          };
        })
      },
      DB: {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn((...args: any[]) => {
            if (sql.startsWith('INSERT INTO analysis_results')) {
              insertedSql = sql;
              insertedBinds = args;
            }
            return {
              first: vi.fn().mockImplementation(async () => {
                if (sql.includes('FROM market_stats')) {
                  return {
                    symbol: 'ARM',
                    price: 140,
                    pe_ratio: 75,
                    market_cap: 140000000000,
                    updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
                  };
                }
                return null;
              }),
              run: vi.fn().mockResolvedValue({ success: true }),
              all: vi.fn().mockResolvedValue({ results: [] })
            };
          }),
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes('FROM market_stats')) {
              return {
                symbol: 'ARM',
                price: 140,
                pe_ratio: 75,
                market_cap: 140000000000,
                updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
              };
            }
            return null;
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
          all: vi.fn().mockResolvedValue({ results: [] })
        }))
      }
    };

    const res = await analysisRoutes.request('/api/analysis/debate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: 'ARM' })
    }, mockEnv);

    expect(res.status).toBe(200);
    expect(insertedSql).toContain('INSERT INTO analysis_results');
    expect(insertedBinds[0]).toBe('ARM');
    expect(insertedBinds[1]).toBe('Moderate Bull');
    expect(insertedBinds[2]).toContain('"debate"');
  });
});

