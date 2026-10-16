import { describe, it, expect, vi } from 'vitest';
import {
  parseOkfFrontmatter,
  normalizeArrayField,
  normalizeGuidanceField,
  stockFundamentalToOkf,
  parseOkfFundamentalBrief,
  getFundamentalDoc,
  OKF_FALLBACK_PLACEHOLDERS,
  isPlaceholder,
  escapeRegex,
  createHeadingRegex,
  findHeadingMatch,
  OKF_CANONICAL_SECTIONS,
  sanitizeYamlScalar,
  StockFundamental,
} from './okf';

describe('okf.ts', () => {
  describe('parseOkfFrontmatter', () => {
    it('parses valid YAML frontmatter and extracts body', () => {
      const markdown = `---
type: article
title: "Arm Architecture Deep Dive"
tags: [semiconductor, arm, ai]
timestamp: "2026-07-29"
---
# Main Content

This is the body text.`;

      const { frontmatter, body } = parseOkfFrontmatter(markdown);

      expect(frontmatter.type).toBe('article');
      expect(frontmatter.title).toBe('Arm Architecture Deep Dive');
      expect(frontmatter.tags).toEqual(['semiconductor', 'arm', 'ai']);
      expect(frontmatter.timestamp).toBe('2026-07-29');
      expect(body).toBe('# Main Content\n\nThis is the body text.');
    });

    it('returns type "unknown" when frontmatter delimiter is missing', () => {
      const markdown = '# Just a markdown heading without frontmatter';
      const { frontmatter, body } = parseOkfFrontmatter(markdown);
      expect(frontmatter.type).toBe('unknown');
      expect(body).toBe(markdown);
    });

    it('returns type "unknown" when closing delimiter is missing', () => {
      const markdown = '---\ntype: article\ntitle: Broken';
      const { frontmatter, body } = parseOkfFrontmatter(markdown);
      expect(frontmatter.type).toBe('unknown');
      expect(body).toBe(markdown);
    });
  });

  describe('normalizeArrayField', () => {
    it('normalizes string array', () => {
      expect(normalizeArrayField(['  x86  ', 'RISC-V', ''])).toEqual(['x86', 'RISC-V']);
    });

    it('normalizes JSON string array', () => {
      expect(normalizeArrayField('["Intel", "AMD", "Qualcomm"]')).toEqual(['Intel', 'AMD', 'Qualcomm']);
    });

    it('normalizes multiline bulleted string', () => {
      const text = `- Risk 1\n* Risk 2\n• Risk 3\nPlain Risk 4`;
      expect(normalizeArrayField(text)).toEqual(['Risk 1', 'Risk 2', 'Risk 3', 'Plain Risk 4']);
    });

    it('returns empty array on null, undefined, or empty string', () => {
      expect(normalizeArrayField(null)).toEqual([]);
      expect(normalizeArrayField(undefined)).toEqual([]);
      expect(normalizeArrayField('')).toEqual([]);
      expect(normalizeArrayField('   ')).toEqual([]);
    });

    it('handles non-array JSON string gracefully', () => {
      expect(normalizeArrayField('{"key": "val"}')).toEqual([]);
    });
  });

  describe('normalizeGuidanceField', () => {
    it('returns object if already GuidanceInfo object', () => {
      const g = { revenue_target: '$4.0B' };
      expect(normalizeGuidanceField(g)).toBe(g);
    });

    it('parses JSON string into GuidanceInfo object', () => {
      const json = '{"revenue_target": "$4.0B", "margin_target": "45%"}';
      expect(normalizeGuidanceField(json)).toEqual({
        revenue_target: '$4.0B',
        margin_target: '45%',
      });
    });

    it('returns raw text if string is not JSON object', () => {
      expect(normalizeGuidanceField('Management expects strong 20% growth')).toBe('Management expects strong 20% growth');
    });

    it('returns null on null, undefined, or empty string', () => {
      expect(normalizeGuidanceField(null)).toBeNull();
      expect(normalizeGuidanceField(undefined)).toBeNull();
      expect(normalizeGuidanceField('')).toBeNull();
      expect(normalizeGuidanceField('   ')).toBeNull();
    });
  });

  describe('stockFundamentalToOkf', () => {
    it('serializes a complete StockFundamental record with all sections', () => {
      const data: StockFundamental = {
        symbol: 'arm',
        as_of_date: '2026-07-29',
        source_count: 5,
        notebook_id: 'nb-uuid-1234',
        business_model: 'Arm licenses high-efficiency RISC processor architectures.',
        moat: 'High switching costs driven by massive software ecosystem inertia.',
        competitors: ['Intel (x86)', 'AMD (x86)', 'RISC-V'],
        guidance: {
          revenue_target: '$4.0B - $4.1B',
          margin_target: '45% - 48%',
          timeframe: 'FY2026',
          key_assumptions: 'Armv9 doubling royalty rate',
          near_term: 'Strong mobile royalty growth',
          long_term: 'Datacenter expansion',
        },
        key_risks: [
          'Arm China joint venture collections',
          'Customer concentration',
        ],
        thesis_kpis: [
          'Armv9 royalty mix > 35%',
          'CSS hyperscaler adoption',
        ],
      };

      const markdown = stockFundamentalToOkf(data);

      // Verify frontmatter format
      expect(markdown).toContain('type: fundamental_brief');
      expect(markdown).toContain('symbol: "ARM"');
      expect(markdown).toContain('title: "Fundamental Brief: ARM"');
      expect(markdown).toContain('as_of_date: "2026-07-29"');
      expect(markdown).toContain('source_count: 5');
      expect(markdown).toContain('notebook_id: "nb-uuid-1234"');
      expect(markdown).toContain('tags: [fundamental-brief, single-stock, arm]');
      expect(markdown).toContain('timestamp: "2026-07-29"');

      // Verify subtitle badge
      expect(markdown).toContain('> **As of**: 2026-07-29 | **Sources Analyzed**: 5 | **Notebook ID**: `nb-uuid-1234`');

      // Verify sections
      expect(markdown).toContain('## Business Model\n\nArm licenses high-efficiency RISC processor architectures.');
      expect(markdown).toContain('## Competitive Moat\n\nHigh switching costs driven by massive software ecosystem inertia.');
      expect(markdown).toContain('### Key Competitors\n- Intel (x86)\n- AMD (x86)\n- RISC-V');
      expect(markdown).toContain('## Management Guidance');
      expect(markdown).toContain('- **Revenue Target**: $4.0B - $4.1B');
      expect(markdown).toContain('- **Margin Target**: 45% - 48%');
      expect(markdown).toContain('- **Timeframe**: FY2026');
      expect(markdown).toContain('- **Key Assumptions**: Armv9 doubling royalty rate');
      expect(markdown).toContain('- **Near-Term Guidance**: Strong mobile royalty growth');
      expect(markdown).toContain('- **Long-Term Guidance**: Datacenter expansion');
      expect(markdown).toContain('## Key Risks\n\n- Arm China joint venture collections\n- Customer concentration');
      expect(markdown).toContain('## Thesis KPIs\n\n- Armv9 royalty mix > 35%\n- CSS hyperscaler adoption');

      // Must strictly parse with parseOkfFrontmatter
      const parsed = parseOkfFrontmatter(markdown);
      expect(parsed.frontmatter.type).toBe('fundamental_brief');
      expect(parsed.frontmatter.symbol).toBe('ARM');
      expect(parsed.frontmatter.tags).toEqual(['fundamental-brief', 'single-stock', 'arm']);
    });

    it('renders clean fallback text for sparse/empty profile', () => {
      const data: StockFundamental = {
        symbol: 'NVDA',
        as_of_date: '2026-08-01',
      };

      const markdown = stockFundamentalToOkf(data);

      expect(markdown).toContain('symbol: "NVDA"');
      expect(markdown).not.toContain('notebook_id:');
      expect(markdown).toContain('> **As of**: 2026-08-01 | **Sources Analyzed**: 0');
      expect(markdown).toContain('## Business Model\n\n_No business model summary provided._');
      expect(markdown).toContain('## Competitive Moat\n\n_No competitive moat analysis provided._');
      expect(markdown).not.toContain('### Key Competitors');
      expect(markdown).toContain('## Management Guidance\n\n_No formal management guidance documented._');
      expect(markdown).toContain('## Key Risks\n\n_No key risks specified._');
      expect(markdown).toContain('## Thesis KPIs\n\n_No thesis KPIs specified._');
    });

    it('normalizes symbols to uppercase and handles plain string guidance', () => {
      const data: StockFundamental = {
        symbol: 'aapl',
        as_of_date: '2026-09-01',
        guidance: 'Expected revenue growth 5-7% next quarter.',
      };

      const markdown = stockFundamentalToOkf(data);
      expect(markdown).toContain('symbol: "AAPL"');
      expect(markdown).toContain('tags: [fundamental-brief, single-stock, aapl]');
      expect(markdown).toContain('## Management Guidance\n\nExpected revenue growth 5-7% next quarter.');
    });
  });

  describe('parseOkfFundamentalBrief', () => {
    it('returns null if type is not fundamental_brief', () => {
      const md = `---
type: article
symbol: "ARM"
---
# Some Article`;
      expect(parseOkfFundamentalBrief(md)).toBeNull();
    });

    it('returns null if symbol is missing in frontmatter', () => {
      const md = `---
type: fundamental_brief
title: "No symbol"
---
# Content`;
      expect(parseOkfFundamentalBrief(md)).toBeNull();
    });

    it('parses OKF markdown into a typed StockFundamental object', () => {
      const original: StockFundamental = {
        symbol: 'ARM',
        as_of_date: '2026-07-29',
        source_count: 5,
        notebook_id: 'nb-555',
        business_model: 'RISC licensing and royalties.',
        moat: 'Ecosystem switching costs.',
        competitors: ['Intel', 'AMD'],
        guidance: {
          revenue_target: '$4.1B',
          margin_target: '46%',
          timeframe: 'FY26',
          key_assumptions: 'v9 rollout',
          near_term: 'Q1 beat',
          long_term: 'Cloud dominance',
        },
        key_risks: ['China JV collections', 'Macro slowdown'],
        thesis_kpis: ['v9 adoption rate > 30%'],
      };

      const serialized = stockFundamentalToOkf(original);
      const parsed = parseOkfFundamentalBrief(serialized);

      expect(parsed).not.toBeNull();
      expect(parsed?.symbol).toBe('ARM');
      expect(parsed?.as_of_date).toBe('2026-07-29');
      expect(parsed?.source_count).toBe(5);
      expect(parsed?.notebook_id).toBe('nb-555');
      expect(parsed?.business_model).toBe('RISC licensing and royalties.');
      expect(parsed?.moat).toBe('Ecosystem switching costs.');
      expect(parsed?.competitors).toEqual(['Intel', 'AMD']);
      expect(parsed?.guidance).toEqual({
        revenue_target: '$4.1B',
        margin_target: '46%',
        timeframe: 'FY26',
        key_assumptions: 'v9 rollout',
        near_term: 'Q1 beat',
        long_term: 'Cloud dominance',
      });
      expect(parsed?.key_risks).toEqual(['China JV collections', 'Macro slowdown']);
      expect(parsed?.thesis_kpis).toEqual(['v9 adoption rate > 30%']);
    });

    it('converts fallback placeholders back to null or empty arrays', () => {
      const sparse: StockFundamental = {
        symbol: 'GOOGL',
        as_of_date: '2026-05-10',
      };

      const serialized = stockFundamentalToOkf(sparse);
      const parsed = parseOkfFundamentalBrief(serialized);

      expect(parsed?.symbol).toBe('GOOGL');
      expect(parsed?.business_model).toBeNull();
      expect(parsed?.moat).toBeNull();
      expect(parsed?.competitors).toEqual([]);
      expect(parsed?.guidance).toBeNull();
      expect(parsed?.key_risks).toEqual([]);
      expect(parsed?.thesis_kpis).toEqual([]);
    });
  });

  describe('getFundamentalDoc', () => {
    it('returns parsed StockFundamental from R2 bucket when found', async () => {
      const original: StockFundamental = {
        symbol: 'TSM',
        as_of_date: '2026-06-15',
        business_model: 'Pure-play foundry semiconductor manufacturing.',
      };
      const markdown = stockFundamentalToOkf(original);

      const mockBucket = {
        get: vi.fn().mockImplementation(async (key: string) => {
          if (key === 'fundamentals/TSM.md') {
            return {
              text: async () => markdown,
            };
          }
          return null;
        }),
      };

      const doc = await getFundamentalDoc(mockBucket as any, 'tsm');
      expect(doc).not.toBeNull();
      expect(doc?.symbol).toBe('TSM');
      expect(doc?.business_model).toBe('Pure-play foundry semiconductor manufacturing.');
      expect(mockBucket.get).toHaveBeenCalledWith('fundamentals/TSM.md');
    });

    it('returns null if object is not found in R2 bucket', async () => {
      const mockBucket = {
        get: vi.fn().mockResolvedValue(null),
      };

      const doc = await getFundamentalDoc(mockBucket as any, 'UNKNOWN');
      expect(doc).toBeNull();
      expect(mockBucket.get).toHaveBeenCalledWith('fundamentals/UNKNOWN.md');
    });

    it('returns null if symbol is empty string', async () => {
      const mockBucket = {
        get: vi.fn(),
      };

      const doc = await getFundamentalDoc(mockBucket as any, '');
      expect(doc).toBeNull();
      expect(mockBucket.get).not.toHaveBeenCalled();
    });
  });

  describe('OKF_FALLBACK_PLACEHOLDERS and isPlaceholder', () => {
    it('accurately identifies exact placeholders and normalized variations', () => {
      expect(isPlaceholder(OKF_FALLBACK_PLACEHOLDERS.business_model, OKF_FALLBACK_PLACEHOLDERS.business_model)).toBe(true);
      expect(isPlaceholder('No business model summary provided', OKF_FALLBACK_PLACEHOLDERS.business_model)).toBe(true);
      expect(isPlaceholder('*No business model summary provided.*', OKF_FALLBACK_PLACEHOLDERS.business_model)).toBe(true);
      expect(isPlaceholder('   _No business model summary provided._   ', OKF_FALLBACK_PLACEHOLDERS.business_model)).toBe(true);
      expect(isPlaceholder(null, OKF_FALLBACK_PLACEHOLDERS.business_model)).toBe(true);
      expect(isPlaceholder('', OKF_FALLBACK_PLACEHOLDERS.business_model)).toBe(true);
    });

    it('does not treat legitimate research text starting with No as placeholders', () => {
      expect(isPlaceholder('_Nordic SaaS enterprise software leader targeting Northern Europe._', OKF_FALLBACK_PLACEHOLDERS.business_model)).toBe(false);
      expect(isPlaceholder('_Non-replicable proprietary data pipeline and local market dominance._', OKF_FALLBACK_PLACEHOLDERS.moat)).toBe(false);
      expect(isPlaceholder('_Noteworthy 30% margin target forecasted for FY27._', OKF_FALLBACK_PLACEHOLDERS.guidance)).toBe(false);
      expect(isPlaceholder('_Non-compliance with local EU data sovereignty rules.', OKF_FALLBACK_PLACEHOLDERS.key_risks)).toBe(false);
      expect(isPlaceholder('_Noticeable retention improvements > 115% NRR.', OKF_FALLBACK_PLACEHOLDERS.thesis_kpis)).toBe(false);
      expect(isPlaceholder('No debt on balance sheet with $2B net cash reserve.', OKF_FALLBACK_PLACEHOLDERS.moat)).toBe(false);
    });
  });

  describe('Line-Anchored Heading Matching (createHeadingRegex, findHeadingMatch)', () => {
    it('matches headings at line starts and ignores mid-line occurrences', () => {
      const text = 'Some preamble text. Note: ## Competitive Moat is also mentioned.\n\n## Competitive Moat\n\nActual moat content.';
      const match = findHeadingMatch(text, '## Competitive Moat');
      expect(match).not.toBeNull();
      // Should match the newline-anchored one, NOT character index 26
      expect(text.substring(match!.startIndex, match!.endIndex)).toContain('## Competitive Moat');
      expect(match!.startIndex).toBe(text.indexOf('\n\n## Competitive Moat') + 2);
    });

    it('preserves mid-text headings without premature section truncation during parseOkfFundamentalBrief', () => {
      const data: StockFundamental = {
        symbol: 'INJECT',
        as_of_date: '2026-07-29',
        business_model: 'Core business involves IP licensing. Note: ## Competitive Moat is also huge.',
        moat: 'Switching costs are immense.',
        competitors: ['Company A', 'Company B'],
      };

      const markdown = stockFundamentalToOkf(data);
      const parsed = parseOkfFundamentalBrief(markdown);

      expect(parsed).not.toBeNull();
      expect(parsed?.business_model).toBe(data.business_model);
      expect(parsed?.moat).toBe(data.moat);
      expect(parsed?.competitors).toEqual(data.competitors);
    });
  });

  describe('sanitizeYamlScalar and Frontmatter Injection Defense', () => {
    it('sanitizes newlines, carriage returns, quotes, and trailing backslashes', () => {
      expect(sanitizeYamlScalar('line1\nline2\r\nline3')).toBe('line1 line2 line3');
      expect(sanitizeYamlScalar('He said "Hello"')).toBe("He said 'Hello'");
      expect(sanitizeYamlScalar('escaped\\')).toBe('escaped');
      expect(sanitizeYamlScalar(123)).toBe('');
      expect(sanitizeYamlScalar(null)).toBe('');
    });

    it('neutralizes YAML frontmatter key and type injection in stockFundamentalToOkf', () => {
      const malicious: StockFundamental = {
        symbol: 'INJ',
        as_of_date: '2026-07-29',
        notebook_id: 'nb-123\ntype: injected_compromised_type\nadmin: true',
        business_model: 'Normal business model with "quotes" and \nnewlines',
      };

      const markdown = stockFundamentalToOkf(malicious);
      const { frontmatter } = parseOkfFrontmatter(markdown);

      expect(frontmatter.type).toBe('fundamental_brief');
      expect(frontmatter.admin).toBeUndefined();

      const parsed = parseOkfFundamentalBrief(markdown);
      expect(parsed).not.toBeNull();
      expect(parsed?.symbol).toBe('INJ');
      expect(parsed?.notebook_id).toBe('nb-123 type: injected_compromised_type admin: true');
      expect(parsed?.business_model).toBe('Normal business model with "quotes" and \nnewlines');
    });
  });
});
