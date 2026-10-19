import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseAIJson, runAnalysisStepAi, runFullAnalysis } from './analysisEngine';
import type { Env } from './index';

describe('AnalysisEngine - parseAIJson', () => {
  it('parses valid JSON string output correctly', () => {
    const raw = '```json\n{"category": "Fast Growers", "story": "High momentum cloud firm."}\n```';
    const parsed = parseAIJson(raw);
    expect(parsed.category).toBe('Fast Growers');
    expect(parsed.story).toBe('High momentum cloud firm.');
  });

  it('handles unescaped newlines inside JSON strings gracefully', () => {
    const raw = '{"reasoning": "Line 1\nLine 2\nLine 3"}';
    const parsed = parseAIJson(raw);
    expect(parsed.reasoning).toContain('Line 1');
    expect(parsed.reasoning).toContain('Line 2');
  });

  it('throws an error when no JSON object is present', () => {
    expect(() => parseAIJson('Plain text without json braces')).toThrow('No JSON object found in AI response');
  });
});

describe('AnalysisEngine - runAnalysisStepAi (Retry & Fallback)', () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      default_ai_model: '@cf/google/gemma-4-26b-a4b-it',
      facebook_summarize_model: '@cf/meta/llama-4-scout-17b-16e-instruct',
      AI: {
        run: vi.fn()
      }
    } as unknown as Env;
  });

  it('succeeds on first attempt without retrying or fallback', () => {
    return new Promise<void>((resolve, reject) => {
      (mockEnv.AI.run as any).mockResolvedValueOnce({
        response: '{"category": "Stalwarts"}'
      });

      runAnalysisStepAi(mockEnv, 'Peter Lynch', 'COIN', {
        messages: [{ role: 'user', content: 'analyze' }],
        max_tokens: 4096
      }).then((res) => {
        expect(mockEnv.AI.run).toHaveBeenCalledTimes(1);
        expect(mockEnv.AI.run).toHaveBeenCalledWith('@cf/google/gemma-4-26b-a4b-it', expect.any(Object));
        expect(res.response).toBe('{"category": "Stalwarts"}');
        resolve();
      }).catch(reject);
    });
  });

  it('retries when first attempt throws a transient parse error and succeeds on second attempt', () => {
    return new Promise<void>((resolve, reject) => {
      (mockEnv.AI.run as any)
        .mockRejectedValueOnce(new Error('Ai._parseError at cloudflare-internal:ai-api:220:24'))
        .mockResolvedValueOnce({ response: '{"category": "Turnarounds"}' });

      runAnalysisStepAi(mockEnv, 'Peter Lynch', 'COIN', {
        messages: [{ role: 'user', content: 'analyze' }],
        max_tokens: 4096
      }, 1).then((res) => {
        expect(mockEnv.AI.run).toHaveBeenCalledTimes(2);
        expect(res.response).toBe('{"category": "Turnarounds"}');
        resolve();
      }).catch(reject);
    });
  });

  it('falls back to facebook_summarize_model when primary model exhausts retries', () => {
    return new Promise<void>((resolve, reject) => {
      (mockEnv.AI.run as any)
        // Primary model fails all retries (0 retries in this test)
        .mockRejectedValueOnce(new Error('504 Gateway Timeout on gemma'))
        // Fallback model succeeds
        .mockResolvedValueOnce({ response: '{"category": "Asset Plays"}' });

      runAnalysisStepAi(mockEnv, 'Peter Lynch', 'COIN', {
        messages: [{ role: 'user', content: 'analyze' }],
        max_tokens: 4096
      }, 0).then((res) => {
        expect(mockEnv.AI.run).toHaveBeenCalledTimes(2);
        expect(mockEnv.AI.run).toHaveBeenNthCalledWith(1, '@cf/google/gemma-4-26b-a4b-it', expect.any(Object));
        expect(mockEnv.AI.run).toHaveBeenNthCalledWith(2, '@cf/meta/llama-4-scout-17b-16e-instruct', expect.any(Object));
        expect(res.response).toBe('{"category": "Asset Plays"}');
        resolve();
      }).catch(reject);
    });
  });

  it('throws descriptive error with step name and symbol when all models fail', () => {
    return new Promise<void>((resolve, reject) => {
      (mockEnv.AI.run as any).mockRejectedValue(new Error('All inference nodes busy'));

      runAnalysisStepAi(mockEnv, 'Hamilton Helmer', 'COIN', {
        messages: [{ role: 'user', content: 'analyze' }],
        max_tokens: 4096
      }, 0).then(() => {
        reject(new Error('Expected runAnalysisStepAi to throw'));
      }).catch((err: Error) => {
        expect(err.message).toContain('[Step: Hamilton Helmer]');
        expect(err.message).toContain('AI execution failed for COIN');
        expect(err.message).toContain('All inference nodes busy');
        resolve();
      });
    });
  });
});

describe('AnalysisEngine - runFullAnalysis orchestration', () => {
  let mockEnv: Env;

  beforeEach(() => {
    const mockDb = {
      prepare: vi.fn().mockImplementation((query: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockImplementation(async () => {
          if (query.includes('market_stats')) {
            return {
              symbol: 'COIN',
              price: 215,
              market_cap: 50000000000,
              updated_at: new Date().toISOString()
            };
          }
          if (query.includes('stock_fundamentals')) {
            return {
              symbol: 'COIN',
              debate_json: JSON.stringify({
                symbol: 'COIN',
                synthesis: {
                  conviction_score: 5,
                  conviction_label: 'Moderate Bull',
                  verdict_summary: 'Leader in compliant crypto exchange infrastructure'
                }
              })
            };
          }
          return null;
        }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true })
      }))
    };

    mockEnv = {
      DB: mockDb,
      default_ai_model: '@cf/google/gemma-4-26b-a4b-it',
      facebook_summarize_model: '@cf/meta/llama-4-scout-17b-16e-instruct',
      AI: {
        run: vi.fn().mockImplementation(async (_model: string, payload: any) => {
          // If response_format is json_object, return structured mock json
          if (payload.response_format?.type === 'json_object') {
            return {
              response: JSON.stringify({
                category: 'Fast Growers',
                story: 'Crypto infrastructure leader',
                moat_type: 'Network Effect',
                overall_power_strength: 'High',
                conviction_level: 'High',
                scores: { peter_lynch: 8, hamilton_helmer: 8, warren_buffett: 7, charlie_munger: 8, howard_marks: 7, joel_greenblatt: 8 }
              })
            };
          }
          return { response: '# Executive Summary for COIN\nDeep analysis report content.' };
        })
      }
    } as unknown as Env;
  });

  it('completes all 8 steps successfully and preserves Gemini debate context', async () => {
    const result = await runFullAnalysis(mockEnv, 'COIN');
    expect(result.symbol).toBe('COIN');
    expect(result.conviction_level).toBe('High');
    expect(result.summary).toContain('# Executive Summary for COIN');
    expect(result.debate).toBeDefined();
    expect(result.debate?.synthesis.conviction_label).toBe('Moderate Bull');

    // Verify DB insert recorded the final analysis
    const prepSpy = mockEnv.DB.prepare as any;
    const insertCall = prepSpy.mock.calls.find((call: any[]) => call[0].includes('INSERT INTO analysis_results'));
    expect(insertCall).toBeDefined();
  });
});
