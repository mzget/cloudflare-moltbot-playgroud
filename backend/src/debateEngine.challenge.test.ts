import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatDebateContext,
  getBullOpeningPrompt,
  getBearOpeningPrompt,
  getBullRebuttalPrompt,
  getBearRebuttalPrompt,
  getArbiterSynthesisPrompt,
  type MarketEventItem,
  type NotebookArticleItem,
  type QualitativeDebateData
} from './analysisPrompts';
import {
  fetchQualitativeData,
  runDialecticalDebate,
  type QualitativeData
} from './debateEngine';

describe('Empirical Challenge: Debate Context & Grounding Engine', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('1. 5-Section Canonical Numbering Invariance (All 16 Permutations)', () => {
    const sampleFundamental = {
      symbol: 'TEST',
      as_of_date: '2026-08-01',
      business_model: 'Test model',
      moat: 'Test moat'
    };

    const sampleThemes = [
      {
        notebook_id: 'nb_test',
        theme_name: 'Test Theme',
        industry_dynamics: 'Test dynamics'
      }
    ];

    const sampleEvents: MarketEventItem[] = [
      {
        title: 'Test Event',
        event_date: '2026-08-01',
        event_type: 'earnings',
        description: 'Details'
      }
    ];

    const sampleArticles: NotebookArticleItem[] = [
      {
        title: 'Test Article',
        summary: 'Article summary'
      }
    ];

    // Generate all 16 combinations of [hasFundamental, hasThemes, hasEvents, hasArticles]
    for (let mask = 0; mask < 16; mask++) {
      const hasFund = Boolean(mask & 1);
      const hasTheme = Boolean(mask & 2);
      const hasEv = Boolean(mask & 4);
      const hasArt = Boolean(mask & 8);

      const label = `Permutation [Fund:${hasFund}, Theme:${hasTheme}, Event:${hasEv}, Art:${hasArt}]`;

      it(`preserves canonical numbering strictly under ${label}`, () => {
        const events = hasEv ? sampleEvents : [];
        const articles = hasArt ? sampleArticles : [];
        const qual: QualitativeDebateData = {
          fundamental: hasFund ? sampleFundamental : null,
          themes: hasTheme ? sampleThemes : []
        };

        const result = formatDebateContext('Price: 100 USD', events, articles, qual);

        // Section 1 must ALWAYS be present and numbered 1
        expect(result).toContain('### 1. ข้อมูลทางการเงินและตัวชี้วัด (Financial Metrics):');

        // Section 2
        if (hasFund) {
          expect(result).toContain('### 2. ข้อมูลเชิงคุณภาพและบทวิเคราะห์พื้นฐาน (Company Fundamental Brief)');
        } else {
          expect(result).not.toContain('### 2.');
        }

        // Section 3
        if (hasTheme) {
          expect(result).toContain('### 3. บริบทอุตสาหกรรมและภาพรวมการแข่งขัน (Sector & Competitive Dynamics):');
        } else {
          expect(result).not.toContain('### 3.');
        }

        // Section 4
        if (hasEv) {
          expect(result).toContain('### 4. ข่าวและเหตุการณ์สำคัญล่าสุด (Recent Market Events):');
        } else {
          expect(result).not.toContain('### 4.');
        }

        // Section 5
        if (hasArt) {
          expect(result).toContain('### 5. บทวิเคราะห์และมุมมองสังเคราะห์ (Research & Notes):');
        } else {
          expect(result).not.toContain('### 5.');
        }

        // Verify that section numbers appear in strictly ascending order and never collapse/renumber
        const matches = [...result.matchAll(/### (\d+)\./g)].map(m => parseInt(m[1], 10));
        expect(matches[0]).toBe(1);
        for (let i = 1; i < matches.length; i++) {
          expect(matches[i]).toBeGreaterThan(matches[i - 1]);
        }
      });
    }
  });

  describe('2. Boundary Inputs & Format Equivalence', () => {
    it('produces identical output for null vs { fundamental: null, themes: [] } vs { fundamental: undefined, themes: undefined }', () => {
      const baseMetrics = 'Price: 100 USD\nP/E: 20';
      const out1 = formatDebateContext(baseMetrics, [], [], null);
      const out2 = formatDebateContext(baseMetrics, [], [], { fundamental: null, themes: [] });
      const out3 = formatDebateContext(baseMetrics, [], [], { fundamental: undefined, themes: undefined });
      const out4 = formatDebateContext(baseMetrics, [], [], {});
      const out5 = formatDebateContext(baseMetrics, undefined, undefined, undefined);
      const out6 = formatDebateContext(baseMetrics);

      expect(out1).toBe(out2);
      expect(out2).toBe(out3);
      expect(out3).toBe(out4);
      expect(out4).toBe(out5);
      expect(out5).toBe(out6);
    });

    it('never emits "undefined" or "null" literal strings when optional fields are empty or null', () => {
      const qual: QualitativeDebateData = {
        fundamental: {
          symbol: 'NULL_TEST',
          as_of_date: '2026-08-01',
          business_model: null,
          moat: null,
          guidance: null,
          competitors: null,
          key_risks: null,
          thesis_kpis: null
        },
        themes: [
          {
            notebook_id: 'nb_empty',
            theme_name: 'Empty Theme',
            industry_dynamics: '',
            supply_chain_bottlenecks: null,
            competitive_landscape: null,
            macro_trends: null
          }
        ]
      };

      const events: MarketEventItem[] = [
        {
          title: 'Event No Description',
          event_date: '2026-08-01',
          event_type: 'press',
          description: null
        }
      ];

      const articles: NotebookArticleItem[] = [
        {
          title: 'Article No Summary',
          summary: null,
          key_takeaways: null
        }
      ];

      const result = formatDebateContext('Price: 50 USD', events, articles, qual);

      expect(result).not.toContain('undefined');
      expect(result).not.toContain('null');
    });
  });

  describe('3. Partial Guidance Objects & Defensive Fallbacks', () => {
    it('renders only revenue_target when only revenue_target is specified', () => {
      const qual: QualitativeDebateData = {
        fundamental: {
          symbol: 'TEST',
          as_of_date: '2026-08-01',
          guidance: { revenue_target: '30% CAGR' }
        }
      };
      const result = formatDebateContext('Price: 100', [], [], qual);
      expect(result).toContain('เป้าหมายและการชี้นำของผู้บริหาร (Management Guidance): เป้ารายได้: 30% CAGR');
      expect(result).not.toContain('เป้าอัตรากำไร:');
      expect(result).not.toContain('กรอบเวลา:');
      expect(result).not.toContain('สมมติฐานหลัก:');
      expect(result).not.toContain('undefined');
    });

    it('renders only margin_target and timeframe when specified', () => {
      const qual: QualitativeDebateData = {
        fundamental: {
          symbol: 'TEST',
          as_of_date: '2026-08-01',
          guidance: { margin_target: '55% operating margin', timeframe: 'FY28' }
        }
      };
      const result = formatDebateContext('Price: 100', [], [], qual);
      expect(result).toContain('เป้าหมายและการชี้นำของผู้บริหาร (Management Guidance): เป้าอัตรากำไร: 55% operating margin | กรอบเวลา: FY28');
      expect(result).not.toContain('เป้ารายได้:');
      expect(result).not.toContain('สมมติฐานหลัก:');
      expect(result).not.toContain('undefined');
    });

    it('omits guidance line entirely when guidance object is empty {}', () => {
      const qual: QualitativeDebateData = {
        fundamental: {
          symbol: 'TEST',
          as_of_date: '2026-08-01',
          guidance: {}
        }
      };
      const result = formatDebateContext('Price: 100', [], [], qual);
      expect(result).not.toContain('เป้าหมายและการชี้นำของผู้บริหาร');
      expect(result).not.toContain('undefined');
    });

    it('supports string guidance defensively as key_assumptions', () => {
      const qual: QualitativeDebateData = {
        fundamental: {
          symbol: 'TEST',
          as_of_date: '2026-08-01',
          guidance: 'Management expects market share expansion' as any
        }
      };
      const result = formatDebateContext('Price: 100', [], [], qual);
      expect(result).toContain('เป้าหมายและการชี้นำของผู้บริหาร (Management Guidance): สมมติฐานหลัก: Management expects market share expansion');
    });
  });

  describe('4. Null Business Model and Moat Formatting', () => {
    it('renders "N/A" for null, undefined, or empty business model and moat', () => {
      const testCases = [
        { business_model: null, moat: null },
        { business_model: undefined, moat: undefined },
        { business_model: '', moat: '' }
      ];

      for (const tc of testCases) {
        const qual: QualitativeDebateData = {
          fundamental: {
            symbol: 'TEST',
            as_of_date: '2026-08-01',
            ...tc
          }
        };
        const result = formatDebateContext('Price: 100', [], [], qual);
        expect(result).toContain('- โมเดลธุรกิจ (Business Model): N/A');
        expect(result).toContain('- ปราการทางธุรกิจ (Economic Moat): N/A');
      }
    });
  });

  describe('5. Empty Arrays and Missing Field Omissions', () => {
    it('completely omits competitors, key_risks, and thesis_kpis when arrays are empty', () => {
      const qual: QualitativeDebateData = {
        fundamental: {
          symbol: 'TEST',
          as_of_date: '2026-08-01',
          competitors: [],
          key_risks: [],
          thesis_kpis: []
        }
      };
      const result = formatDebateContext('Price: 100', [], [], qual);
      expect(result).not.toContain('คู่แข่งสำคัญ (Competitors):');
      expect(result).not.toContain('ปัจจัยความเสี่ยงสำคัญ (Key Risks):');
      expect(result).not.toContain('ตัวชี้วัดวิทยานิพนธ์การลงทุน (Thesis KPIs):');
    });

    it('supports string representation for competitors, key_risks, and thesis_kpis', () => {
      const qual: QualitativeDebateData = {
        fundamental: {
          symbol: 'TEST',
          as_of_date: '2026-08-01',
          competitors: 'Intel, AMD',
          key_risks: 'Macro downturn',
          thesis_kpis: 'Revenue growth'
        }
      };
      const result = formatDebateContext('Price: 100', [], [], qual);
      expect(result).toContain('- คู่แข่งสำคัญ (Competitors): Intel, AMD');
      expect(result).toContain('- ปัจจัยความเสี่ยงสำคัญ (Key Risks): Macro downturn');
      expect(result).toContain('- ตัวชี้วัดวิทยานิพนธ์การลงทุน (Thesis KPIs): Revenue growth');
    });
  });

  describe('6. Mandatory Prompt Grounding Tokens', () => {
    const symbol = 'ARM';
    const context = 'Price: 140 USD';

    it('verifies Bull Opening Prompt contains mandatory tokens', () => {
      const prompt = getBullOpeningPrompt(symbol, context);
      expect(prompt.system).toContain('Management Guidance');
      expect(prompt.system).toContain('Moat');
      expect(prompt.system).toContain('Thesis KPIs');
      expect(prompt.system).toContain('ห้ามใช้เครื่องหมาย double quote ซ้อนภายในข้อความ');
      expect(prompt.prompt).toContain('ARM');
      expect(prompt.prompt).toContain(context);
    });

    it('verifies Bear Opening Prompt contains mandatory tokens', () => {
      const prompt = getBearOpeningPrompt(symbol, context);
      expect(prompt.system).toContain('Key Risks');
      expect(prompt.system).toContain('Structural Headwinds');
      expect(prompt.system).toContain('Inversion Thinking');
      expect(prompt.system).toContain('ห้ามใช้เครื่องหมาย double quote ซ้อนภายในข้อความ');
      expect(prompt.prompt).toContain('ARM');
      expect(prompt.prompt).toContain(context);
    });

    it('verifies Bull Rebuttal Prompt contains mandatory tokens', () => {
      const prompt = getBullRebuttalPrompt(symbol, context, '{"bear_thesis": "Risk"}');
      expect(prompt.system).toContain('Management Guidance');
      expect(prompt.system).toContain('Moat');
      expect(prompt.system).toContain('ห้ามใช้เครื่องหมาย double quote ซ้อนภายในข้อความ');
      expect(prompt.prompt).toContain('Risk');
    });

    it('verifies Bear Rebuttal Prompt contains mandatory tokens', () => {
      const prompt = getBearRebuttalPrompt(symbol, context, '{"bull_thesis": "Upside"}');
      expect(prompt.system).toContain('Guidance');
      expect(prompt.system).toContain('Moat');
      expect(prompt.system).toContain('ห้ามใช้เครื่องหมาย double quote ซ้อนภายในข้อความ');
      expect(prompt.prompt).toContain('Upside');
    });

    it('verifies Arbiter Synthesis Prompt contains mandatory tokens', () => {
      const prompt = getArbiterSynthesisPrompt(symbol, context, '{"round1": {}}');
      expect(prompt.system).toContain('Management Guidance');
      expect(prompt.system).toContain('Moat');
      expect(prompt.system).toContain('Thesis KPIs');
      expect(prompt.system).toContain('ห้ามใช้เครื่องหมาย double quote ซ้อนภายในข้อความ');
      expect(prompt.prompt).toContain('round1');
    });
  });

  describe('7. fetchQualitativeData Error Handling and Unseeded Resilience', () => {
    it('returns empty defaults when db is undefined or invalid object', async () => {
      const r1 = await fetchQualitativeData(undefined, 'AAPL');
      expect(r1).toEqual({ events: [], fundamental: null, themes: [], articles: [] });

      const r2 = await fetchQualitativeData({} as any, 'AAPL');
      expect(r2).toEqual({ events: [], fundamental: null, themes: [], articles: [] });
    });

    it('returns empty defaults when db.prepare throws synchronously', async () => {
      const brokenDb = {
        prepare: vi.fn(() => {
          throw new Error('D1 internal error: disk I/O failure');
        })
      };

      const result = await fetchQualitativeData(brokenDb as any, 'AAPL');
      expect(result).toEqual({ events: [], fundamental: null, themes: [], articles: [] });
    });

    it('handles query promise rejections gracefully in Promise.all', async () => {
      const rejectingDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockRejectedValue(new Error('table stock_fundamentals missing')),
          all: vi.fn().mockRejectedValue(new Error('D1 timeout'))
        }))
      };

      const result = await fetchQualitativeData(rejectingDb as any, 'AAPL');
      expect(result).toEqual({ events: [], fundamental: null, themes: [], articles: [] });
    });

    it('handles unseeded symbol correctly without throwing', async () => {
      const emptyDb = {
        prepare: vi.fn(() => ({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] })
        }))
      };

      const result = await fetchQualitativeData(emptyDb as any, 'UNSEEDED_TICKER');
      expect(result.fundamental).toBeNull();
      expect(result.themes).toEqual([]);
      expect(result.events).toEqual([]);
      expect(result.articles).toEqual([]);
    });

    it('normalizes symbol to uppercase and trims surrounding whitespace', async () => {
      let boundSymbol: string | null = null;
      const mockDb = {
        prepare: vi.fn(() => {
          const stmt: any = {
            bind: vi.fn((sym: string) => {
              boundSymbol = sym;
              return stmt;
            }),
            first: vi.fn().mockResolvedValue(null),
            all: vi.fn().mockResolvedValue({ results: [] })
          };
          return stmt;
        })
      };

      await fetchQualitativeData(mockDb as any, '  arm  ');
      expect(boundSymbol).toBe('ARM');
    });

    it('handles mock DBs lacking .first() by falling back to .all()', async () => {
      const allOnlyDb = {
        prepare: vi.fn((sql: string) => {
          const stmt: any = {
            bind: vi.fn().mockReturnThis(),
            all: vi.fn().mockImplementation(async () => {
              if (sql.includes('FROM stock_fundamentals')) {
                return {
                  results: [
                    {
                      symbol: 'ARM',
                      business_model: 'Licensing IP',
                      moat: 'High switching costs',
                      as_of_date: '2026-07-29',
                      source_count: 5
                    }
                  ]
                };
              }
              return { results: [] };
            })
          };
          return stmt;
        })
      };

      const result = await fetchQualitativeData(allOnlyDb as any, 'ARM');
      expect(result.fundamental).toBeDefined();
      expect(result.fundamental?.symbol).toBe('ARM');
      expect(result.fundamental?.business_model).toBe('Licensing IP');
    });

    it('handles malformed / corrupt JSON columns in stock_fundamentals row gracefully', async () => {
      const corruptDb = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn().mockReturnThis(),
          first: vi.fn().mockResolvedValue({
            symbol: 'CORRUPT',
            business_model: 'Corrupt Co',
            moat: 'None',
            competitors: '{{invalid json',
            guidance: '{unquoted_key: val}',
            key_risks: '[broken',
            thesis_kpis: 'NaN',
            as_of_date: '2026-08-01',
            source_count: null,
            updated_at: null
          }),
          all: vi.fn().mockResolvedValue({ results: [] })
        }))
      };

      const result = await fetchQualitativeData(corruptDb as any, 'CORRUPT');
      expect(result.fundamental).not.toBeNull();
      expect(result.fundamental?.competitors).toEqual([]);
      expect(result.fundamental?.guidance).toBeNull();
      expect(result.fundamental?.key_risks).toEqual([]);
      expect(result.fundamental?.thesis_kpis).toEqual([]);
      expect(result.fundamental?.source_count).toBe(1);
    });
  });
});
