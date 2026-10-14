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
  it('formats context with metrics only when events and articles are empty', () => {
    const metricsStr = 'Price: 100 USD\nP/E: 25';
    const context = formatDebateContext(metricsStr);
    expect(context).toContain('### 1. ข้อมูลทางการเงินและตัวชี้วัด (Financial Metrics):');
    expect(context).toContain('Price: 100 USD');
    expect(context).not.toContain('### 2. ข่าวและเหตุการณ์สำคัญล่าสุด');
    expect(context).not.toContain('### 3. บทวิเคราะห์และมุมมองสังเคราะห์');
  });

  it('formats context with both events and articles', () => {
    const metricsStr = 'Price: 150 USD';
    const events: MarketEventItem[] = [
      { title: 'Earnings Beat Q2', description: 'Revenue grew 30%', event_date: '2026-08-15', event_type: 'earnings' }
    ];
    const articles: NotebookArticleItem[] = [
      { title: 'AI Infrastructure Moat', summary: 'Deep dive into data center demand' }
    ];

    const context = formatDebateContext(metricsStr, events, articles);
    expect(context).toContain('[EARNINGS] Earnings Beat Q2 (2026-08-15): Revenue grew 30%');
    expect(context).toContain('หัวข้อ: AI Infrastructure Moat');
    expect(context).toContain('สรุป: Deep dive into data center demand');
  });

  it('generates prompt objects with system instructions and user prompt', () => {
    const symbol = 'NVDA';
    const context = 'Price: 150 USD';
    
    const bullOpening = getBullOpeningPrompt(symbol, context);
    expect(bullOpening.system).toContain('Bullish Researcher Agent');
    expect(bullOpening.prompt).toContain('NVDA');

    const bearOpening = getBearOpeningPrompt(symbol, context);
    expect(bearOpening.system).toContain('Bearish Researcher Agent');
    expect(bearOpening.prompt).toContain('NVDA');

    const bullRebuttal = getBullRebuttalPrompt(symbol, context, '{"bear_thesis": "Too expensive"}');
    expect(bullRebuttal.system).toContain('Round 2: Cross-Examination Rebuttal');
    expect(bullRebuttal.prompt).toContain('Too expensive');

    const bearRebuttal = getBearRebuttalPrompt(symbol, context, '{"bull_thesis": "Growth is infinite"}');
    expect(bearRebuttal.system).toContain('Round 2: Cross-Examination Rebuttal');
    expect(bearRebuttal.prompt).toContain('Growth is infinite');

    const arbiter = getArbiterSynthesisPrompt(symbol, context, '{"transcript": "all rounds"}');
    expect(arbiter.system).toContain('Dialectical Arbiter Agent');
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
  it('returns events and articles for the symbol', async () => {
    const mockDb = {
      prepare: vi.fn((sql: string) => {
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
                { title: 'Thesis on NVDA', summary: 'Very strong datacenter moat', key_takeaways: '["Moat", "Margin"]' }
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

    const data = await fetchQualitativeData(mockDb as any, 'NVDA');
    expect(data.events).toHaveLength(1);
    expect(data.events[0].title).toBe('New Chip Launch');
    expect(data.articles).toHaveLength(1);
    expect(data.articles[0].title).toBe('Thesis on NVDA');
  });

  it('handles database exceptions gracefully and returns empty arrays', async () => {
    const brokenDb = {
      prepare: vi.fn(() => {
        throw new Error('D1 connection failed');
      })
    };

    const data = await fetchQualitativeData(brokenDb as any, 'AAPL');
    expect(data.events).toEqual([]);
    expect(data.articles).toEqual([]);
  });

  it('handles null/undefined db binding gracefully', async () => {
    const data = await fetchQualitativeData(undefined as any, 'TSLA');
    expect(data.events).toEqual([]);
    expect(data.articles).toEqual([]);
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
});

