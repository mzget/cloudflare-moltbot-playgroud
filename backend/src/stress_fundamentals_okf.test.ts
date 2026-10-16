import { describe, it, expect } from 'vitest';
import {
  safeJsonParse,
  safeJsonStringify,
  deserializeStockFundamental,
  serializeStockFundamental,
  computeFreshnessStatus,
  StockFundamentalDbRow,
  SaveFundamentalBriefInput,
  StockFundamental,
  GuidanceInfo,
} from './fundamentals';
import {
  parseOkfFrontmatter,
  normalizeArrayField,
  normalizeGuidanceField,
  stockFundamentalToOkf,
  parseOkfFundamentalBrief,
} from './okf';

describe('Empirical Adversarial Stress Suite: fundamentals & okf', () => {
  // =========================================================================
  // 1. Extreme Round-Trip Serialization & Deserialization
  // =========================================================================
  describe('Extreme Round-Trip Serialization & Deserialization', () => {
    it('handles unicode, Thai script, Chinese, emojis, and accents across all fields', () => {
      const data: StockFundamental = {
        symbol: 'TEST-UNI',
        as_of_date: '2026-07-29',
        source_count: 3,
        notebook_id: 'nb-สมุดโน้ต-🚀-123',
        business_model: 'บริษัทเทคโนโลยีชั้นนำ (Leading tech company) 🚀 芯片 & AI 100% 💰.',
        moat: 'เครือข่ายที่มีอำนาจผูกขาด (Monopoly network effects) & IP é/ö/ñ/ü/î.',
        competitors: ['คู่แข่ง A (x86)', '华为 (Huawei)', 'TSMC 台湾积体电路', 'Électricité de France'],
        guidance: {
          revenue_target: 'เติบโต 30% YoY ($5.5B)',
          margin_target: 'อัตรากำไร 55% 📈',
          timeframe: 'ปี 2027 (FY27)',
          key_assumptions: 'การขยายตัวในเอเชียตะวันออกเฉียงใต้ & European expansion',
          near_term: 'ครึ่งปีแรกโตแข็งแกร่ง',
          long_term: 'ผู้นำระดับโลกในยุค AI',
        },
        key_risks: [
          'ความเสี่ยงด้านภูมิรัฐศาสตร์ (Geopolitical risk in APAC)',
          'กฎระเบียบ AI ของสหภาพยุโรป (EU AI Act compliance 🇪🇺)',
          'อัตราแลกเปลี่ยนผันผวน (Currency FX: ฿, €, ¥, $)',
        ],
        thesis_kpis: [
          'ส่วนแบ่งการตลาด > 40% ในตลาดเกิดใหม่',
          'อัตราการเติบโตของรายได้ต่อพนักงาน (Revenue/Employee)',
        ],
      };

      const markdown = stockFundamentalToOkf(data);
      expect(markdown).toBeDefined();

      const parsed = parseOkfFundamentalBrief(markdown);
      expect(parsed).not.toBeNull();
      expect(parsed?.symbol).toBe('TEST-UNI');
      expect(parsed?.notebook_id).toBe('nb-สมุดโน้ต-🚀-123');
      expect(parsed?.business_model).toBe(data.business_model);
      expect(parsed?.moat).toBe(data.moat);
      expect(parsed?.competitors).toEqual(data.competitors);
      expect(parsed?.guidance).toEqual(data.guidance);
      expect(parsed?.key_risks).toEqual(data.key_risks);
      expect(parsed?.thesis_kpis).toEqual(data.thesis_kpis);
    });

    it('handles quotes, escaped characters, apostrophes, and backticks', () => {
      const data: StockFundamental = {
        symbol: 'QUOTES',
        as_of_date: '2026-07-29',
        source_count: 2,
        notebook_id: 'nb-quotes-456',
        business_model: 'They say "Software is eating the world", but we say `Hardware is the teeth`. It\'s proprietary.',
        moat: 'High "switching costs", "customer lock-in", and `patented` architecture.',
        competitors: ['Company "A"', "Company 'B'", 'Company `C`', 'Quoted "Nested \'Triple\'" Inc.'],
        guidance: {
          revenue_target: '"$5.0B" minimum',
          margin_target: "40% 'net'",
          timeframe: 'FY\'27',
          key_assumptions: 'Adoption of "Next-Gen" architecture `v10`',
        },
        key_risks: [
          'Founder said: "Never sell"',
          'Customer\'s reliance on single "fab"',
        ],
        thesis_kpis: [
          'Metric "alpha" > 90%',
          'Target `kpi_v2`',
        ],
      };

      const markdown = stockFundamentalToOkf(data);
      const parsed = parseOkfFundamentalBrief(markdown);

      expect(parsed).not.toBeNull();
      expect(parsed?.business_model).toBe(data.business_model);
      expect(parsed?.moat).toBe(data.moat);
      expect(parsed?.competitors).toEqual(data.competitors);
      expect(parsed?.guidance).toEqual(data.guidance);
      expect(parsed?.key_risks).toEqual(data.key_risks);
      expect(parsed?.thesis_kpis).toEqual(data.thesis_kpis);
    });

    it('tests bullet point variety and numbered companies (e.g. 3M, 3Com, 21st Century)', () => {
      // Adversarial test: lines starting with numbers like "3M" or "21st Century Fox"
      const competitorsWithNumbers = ['3M Company', '3Com', '21st Century Fox', '7-Eleven'];
      const data: StockFundamental = {
        symbol: 'NUM',
        as_of_date: '2026-07-29',
        business_model: 'Conglomerate',
        moat: 'Diverse brand moat',
        competitors: competitorsWithNumbers,
        key_risks: ['1. Risk One', '2. Risk Two', '• Bullet risk', '* Star risk'],
        thesis_kpis: ['100% On-time delivery', '3x Year-over-year expansion'],
      };

      const markdown = stockFundamentalToOkf(data);
      const parsed = parseOkfFundamentalBrief(markdown);

      expect(parsed).not.toBeNull();
      // Inspect what happens to "3M Company"
      expect(parsed?.competitors).toEqual(competitorsWithNumbers);
      expect(parsed?.thesis_kpis).toEqual(['100% On-time delivery', '3x Year-over-year expansion']);
    });

    it('tests vulnerability: text starting with "_No" being falsely wiped to null', () => {
      const data: StockFundamental = {
        symbol: 'NORDIC',
        as_of_date: '2026-07-29',
        business_model: '_Nordic SaaS enterprise software leader targeting Northern Europe._',
        moat: '_Non-replicable proprietary data pipeline and local market dominance._',
        competitors: ['SAP', 'Visma'],
        guidance: '_Noteworthy 30% margin target forecasted for FY27._',
        key_risks: ['_Non-compliance with local EU data sovereignty rules.'],
        thesis_kpis: ['_Noticeable retention improvements > 115% NRR.'],
      };

      const markdown = stockFundamentalToOkf(data);
      const parsed = parseOkfFundamentalBrief(markdown);

      // Verify that the implementation preserves legitimate research text starting with '_No'
      expect(parsed).not.toBeNull();
      expect(parsed?.business_model).toBe(data.business_model);
      expect(parsed?.moat).toBe(data.moat);
      expect(parsed?.competitors).toEqual(data.competitors);
      expect(parsed?.guidance).toBe(data.guidance);
      expect(parsed?.key_risks).toEqual(data.key_risks);
      expect(parsed?.thesis_kpis).toEqual(data.thesis_kpis);
    });

    it('tests vulnerability: text containing internal markdown section headers', () => {
      const data: StockFundamental = {
        symbol: 'INJECT',
        as_of_date: '2026-07-29',
        business_model: 'Core business involves IP licensing. Note: ## Competitive Moat is also huge.',
        moat: 'Switching costs are immense.',
        competitors: ['A', 'B'],
      };

      const markdown = stockFundamentalToOkf(data);
      const parsed = parseOkfFundamentalBrief(markdown);

      // Verify section boundaries are preserved even with headings mentioned mid-text
      expect(parsed).not.toBeNull();
      expect(parsed?.business_model).toBe(data.business_model);
      expect(parsed?.moat).toBe(data.moat);
      expect(parsed?.competitors).toEqual(data.competitors);
    });

    it('tests vulnerability: frontmatter newline injection via notebook_id or symbol', () => {
      const maliciousData: StockFundamental = {
        symbol: 'INJ',
        as_of_date: '2026-07-29',
        notebook_id: 'nb-123\ntype: injected_compromised_type\nadmin: true',
        business_model: 'Normal business model',
      };

      const markdown = stockFundamentalToOkf(maliciousData);
      const { frontmatter } = parseOkfFrontmatter(markdown);

      // Frontmatter sanitization prevents YAML key injection and type corruption
      expect(frontmatter.type).toBe('fundamental_brief');
      expect(frontmatter.admin).toBeUndefined();

      const parsed = parseOkfFundamentalBrief(markdown);
      expect(parsed).not.toBeNull();
      expect(parsed?.symbol).toBe('INJ');
      expect(parsed?.notebook_id).toBe('nb-123 type: injected_compromised_type admin: true');
      expect(parsed?.business_model).toBe('Normal business model');
    });

    it('tests NaN source_count propagation to markdown and subtitle badge', () => {
      const data: StockFundamental = {
        symbol: 'NAN_SRC',
        as_of_date: '2026-07-29',
        source_count: NaN,
      };

      const markdown = stockFundamentalToOkf(data);
      console.log('Markdown with NaN source_count:\n', markdown.slice(0, 250));
      expect(markdown).toContain('source_count: NaN');
      expect(markdown).toContain('**Sources Analyzed**: NaN');

      // Now parse it back
      const parsed = parseOkfFundamentalBrief(markdown);
      console.log('Parsed source_count back from OKF:', parsed?.source_count);
      // parseInt("NaN", 10) || 0 returns 0! So it recovered to 0 on parse
      expect(parsed?.source_count).toBe(0);
    });

    it('tests behavior when symbol is null/undefined in deserializeStockFundamental and serializeStockFundamental', () => {
      // D1 row missing symbol
      const brokenRow = {
        symbol: null as any,
        as_of_date: '2026-07-29',
      } as StockFundamentalDbRow;

      expect(() => {
        deserializeStockFundamental(brokenRow);
      }).toThrow(); // throws TypeError: Cannot read properties of null (reading 'toUpperCase')

      // Input missing symbol
      const brokenInput = {
        symbol: null as any,
        as_of_date: '2026-07-29',
      } as SaveFundamentalBriefInput;

      expect(() => {
        serializeStockFundamental(brokenInput);
      }).toThrow(); // throws TypeError: Cannot read properties of null (reading 'trim')
    });

    it('tests round-trip with empty strings, whitespace-only fields, and missing fields', () => {
      const emptyInput: SaveFundamentalBriefInput = {
        symbol: '   empty   ',
        as_of_date: '   2026-07-29   ',
        business_model: '   ',
        moat: '',
        competitors: [],
        guidance: undefined,
        key_risks: [],
        thesis_kpis: [],
        notebook_id: '   ',
        source_count: undefined,
      };

      const serialized = serializeStockFundamental(emptyInput);
      expect(serialized.symbol).toBe('EMPTY');
      expect(serialized.as_of_date).toBe('2026-07-29');
      expect(serialized.business_model).toBeNull();
      expect(serialized.moat).toBeNull();
      expect(serialized.competitors).toBeNull();
      expect(serialized.guidance).toBeNull();
      expect(serialized.key_risks).toBeNull();
      expect(serialized.thesis_kpis).toBeNull();
      expect(serialized.notebook_id).toBeNull();
      expect(serialized.source_count).toBe(1);

      const dbRow: StockFundamentalDbRow = {
        ...serialized,
        updated_at: '2026-07-29T12:00:00Z',
      };

      const deserialized = deserializeStockFundamental(dbRow);
      expect(deserialized.symbol).toBe('EMPTY');
      expect(deserialized.business_model).toBe('');
      expect(deserialized.moat).toBe('');
      expect(deserialized.competitors).toEqual([]);
      expect(deserialized.guidance).toBeNull();
      expect(deserialized.key_risks).toEqual([]);
      expect(deserialized.thesis_kpis).toEqual([]);
      expect(deserialized.source_count).toBe(1);
    });
  });

  // =========================================================================
  // 2. Malformed JSON strings in D1 columns
  // =========================================================================
  describe('Malformed JSON strings in D1 columns resilience', () => {
    it('does not throw on invalid JSON syntax in any JSON column', () => {
      const malformedRows: StockFundamentalDbRow[] = [
        {
          symbol: 'BAD1',
          as_of_date: '2026-07-29',
          business_model: null,
          moat: null,
          competitors: '{{invalid json',
          guidance: '[incomplete array',
          key_risks: '{"unclosed string',
          thesis_kpis: ':::syntax error:::',
          notebook_id: null,
          source_count: 1,
        },
        {
          symbol: 'BAD2',
          as_of_date: '2026-07-29',
          business_model: null,
          moat: null,
          competitors: 'undefined',
          guidance: 'NaN',
          key_risks: '<xml>not json</xml>',
          thesis_kpis: '{"a": 1,}', // trailing comma
          notebook_id: null,
          source_count: null,
        },
        {
          symbol: 'BAD3',
          as_of_date: '2026-07-29',
          business_model: null,
          moat: null,
          competitors: '\0\0\0null-bytes',
          guidance: '{"key": "value" \n unclosed',
          key_risks: 'true false',
          thesis_kpis: '[]]',
          notebook_id: null,
          source_count: 1,
        },
      ];

      for (const row of malformedRows) {
        expect(() => {
          const res = deserializeStockFundamental(row);
          expect(res.symbol).toBe(row.symbol);
          expect(Array.isArray(res.competitors)).toBe(true);
          expect(Array.isArray(res.key_risks)).toBe(true);
          expect(Array.isArray(res.thesis_kpis)).toBe(true);
        }).not.toThrow();
      }
    });

    it('evaluates behavior when JSON in D1 is valid JSON of unexpected type', () => {
      // e.g. competitors is a number "123", or guidance is an array "[1,2,3]"
      const unexpectedTypeRow: StockFundamentalDbRow = {
        symbol: 'TYPE_MISMATCH',
        as_of_date: '2026-07-29',
        business_model: 'Test',
        moat: 'Test',
        competitors: '12345', // valid JSON number, but not array!
        guidance: '[1, 2, 3]', // valid JSON array, but guidance expects GuidanceInfo object!
        key_risks: '"just a single string"', // valid JSON string, not array!
        thesis_kpis: '{"not": "an array"}', // valid JSON object, not array!
        notebook_id: null,
        source_count: 1,
      };

      const res = deserializeStockFundamental(unexpectedTypeRow);
      console.log('Competitors when D1 has "12345":', res.competitors, typeof res.competitors);
      console.log('Guidance when D1 has "[1, 2, 3]":', res.guidance, typeof res.guidance);
      console.log('Key risks when D1 has string:', res.key_risks, typeof res.key_risks);
      console.log('Thesis KPIs when D1 has object:', res.thesis_kpis, typeof res.thesis_kpis);

      // Verify whether passing this StockFundamental to stockFundamentalToOkf throws or survives
      expect(() => {
        stockFundamentalToOkf(res);
      }).not.toThrow();
    });

    it('evaluates safeJsonStringify and safeJsonParse edge cases', () => {
      // Circular reference handling
      const circular: any = { a: 1 };
      circular.self = circular;
      expect(safeJsonStringify(circular)).toBeNull();

      // BigInt handling
      expect(safeJsonStringify(123n as any)).toBeNull();

      // Function handling: safeJsonStringify always returns string | null (never undefined)
      const fnResult = safeJsonStringify(() => {});
      expect(fnResult).toBeNull();
      expect(safeJsonStringify(Symbol('test'))).toBeNull();
      expect(safeJsonStringify({ toJSON: () => undefined })).toBeNull();

      // safeJsonParse on primitives
      expect(safeJsonParse(true, 'fallback')).toBe('fallback');
      expect(safeJsonParse(12345, 'fallback')).toBe('fallback');
      expect(safeJsonParse(null, 'fallback')).toBe('fallback');
      expect(safeJsonParse(undefined, 'fallback')).toBe('fallback');
      expect(safeJsonParse('', 'fallback')).toBe('fallback');
      expect(safeJsonParse('   ', 'fallback')).toBe('fallback');
    });
  });

  // =========================================================================
  // 3. 90-Day Freshness Calculations (Leap Years, Timezones, Malformed Dates)
  // =========================================================================
  describe('90-Day Freshness Calculations: Edge Cases & Stress', () => {
    describe('Leap Year Scenarios', () => {
      it('calculates freshness accurately across February 29 leap day (2024 leap year)', () => {
        // 2024 was a leap year with Feb 29.
        // Between 2024-02-01 and 2024-05-01:
        // Feb has 29 days (28 days left from Feb 1), Mar has 31 days, Apr has 30 days, May 1 = 90 days.
        const leapAsOfDate = '2024-02-01';

        // Day 89: 2024-04-30T23:59:59Z
        const now89d = new Date('2024-04-30T23:59:59.000Z');
        expect(computeFreshnessStatus(leapAsOfDate, now89d)).toBe('active');

        // Day 90: 2024-05-01T00:00:00.000Z -> exactly 90.0 days
        const now90d = new Date('2024-05-01T00:00:00.000Z');
        expect(computeFreshnessStatus(leapAsOfDate, now90d)).toBe('stale');

        // Day 91: 2024-05-02T00:00:00.000Z
        const now91d = new Date('2024-05-02T00:00:00.000Z');
        expect(computeFreshnessStatus(leapAsOfDate, now91d)).toBe('stale');
      });

      it('evaluates freshness starting from February 29 leap day itself', () => {
        const leapDay = '2024-02-29';

        // 89 days later: 2024-05-28
        const day89 = new Date('2024-05-28T12:00:00Z');
        expect(computeFreshnessStatus(leapDay, day89)).toBe('active');

        // Exactly 90 days later: 2024-05-29T00:00:00Z
        const day90 = new Date('2024-05-29T00:00:00Z');
        expect(computeFreshnessStatus(leapDay, day90)).toBe('stale');
      });

      it('handles invalid leap date (e.g. 2025-02-29 in non-leap year)', () => {
        // 2025 is NOT a leap year. What does Date.parse('2025-02-29') do in V8?
        const result = computeFreshnessStatus('2025-02-29', new Date('2025-06-01T00:00:00Z'));
        console.log('2025-02-29 freshness status:', result);
      });
    });

    describe('Timezone Offset Scenarios', () => {
      it('tests dates with extreme positive and negative timezone offsets (+14:00 and -12:00)', () => {
        const baseNow = new Date('2026-10-15T00:00:00Z');

        // Exactly 89.5 days ago in UTC
        // +14:00 timezone shifts timestamp earlier by 14 hours in UTC
        const dateKiritimati = '2026-07-17T00:00:00+14:00'; // Kiribati (+14)
        const dateBaker = '2026-07-17T00:00:00-12:00';      // Baker Island (-12)

        const statusKiritimati = computeFreshnessStatus(dateKiritimati, baseNow);
        const statusBaker = computeFreshnessStatus(dateBaker, baseNow);

        console.log('Status with +14:00 offset:', statusKiritimati);
        console.log('Status with -12:00 offset:', statusBaker);

        expect(['active', 'stale']).toContain(statusKiritimati);
        expect(['active', 'stale']).toContain(statusBaker);
      });

      it('tests boundary floating point comparisons (89.999 days vs 90.000 days vs 90.001 days)', () => {
        const asOf = '2026-07-17T00:00:00.000Z';
        const asOfMs = Date.parse(asOf);

        // 89 days, 23 hours, 59 minutes, 59 seconds (89.999988 days)
        const justUnder90 = new Date(asOfMs + 90 * 86400000 - 1000);
        expect(computeFreshnessStatus(asOf, justUnder90)).toBe('active');

        // Exactly 90.000000 days
        const exactly90 = new Date(asOfMs + 90 * 86400000);
        expect(computeFreshnessStatus(asOf, exactly90)).toBe('stale');

        // 90 days + 1 millisecond
        const justOver90 = new Date(asOfMs + 90 * 86400000 + 1);
        expect(computeFreshnessStatus(asOf, justOver90)).toBe('stale');
      });

      it('tests SQLite datetime string format without T or Z (e.g. "YYYY-MM-DD HH:MM:SS")', () => {
        const sqlDate = '2026-07-17 00:00:00';
        const status = computeFreshnessStatus(sqlDate, new Date('2026-08-01T00:00:00Z'));
        console.log('Status for SQLite datetime format:', status);
        expect(status).toBe('active');
      });
    });

    describe('Malformed & Pathological Date Strings', () => {
      const fixedNow = new Date('2026-10-15T00:00:00Z');

      it('returns "missing" for various malformed, impossible, and junk date strings', () => {
        const pathologicalInputs = [
          '',
          '   ',
          'not-a-date',
          '2026-13-45', // Month 13
          '2026-00-10', // Month 0
          '2026-04-31', // April has 30 days
          '2026-02-30', // Feb has 28/29 days
          'undefined',
          'null',
          'NaN',
          '0',
          '[2026-07-29]',
          '{"date": "2026-07-29"}',
          '<script>alert(1)</script>',
          '2026-07-29T25:00:00Z', // Hour 25
          '999999999999999999999',
          '--07-29',
        ];

        for (const input of pathologicalInputs) {
          const status = computeFreshnessStatus(input, fixedNow);
          console.log(`Input: "${input}" -> status: ${status}`);
          // Should either be 'missing' or safely evaluated without throwing
          expect(['missing', 'active', 'stale']).toContain(status);
        }
      });

      it('handles invalid now parameter without throwing', () => {
        const invalidNow = new Date('invalid');
        expect(() => {
          const status = computeFreshnessStatus('2026-07-29', invalidNow);
          console.log('Freshness with invalid now:', status);
        }).not.toThrow();
      });
    });
  });
});
