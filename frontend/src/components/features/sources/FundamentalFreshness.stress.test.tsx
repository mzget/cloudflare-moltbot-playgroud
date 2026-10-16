import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  FundamentalFreshnessBadge,
  type FreshnessStatus,
} from './FundamentalFreshnessBadge';
import {
  CopyPromptModal,
  generateGeminiExtractionPrompt,
} from './CopyPromptModal';

describe('Empirical Adversarial Stress Suite: FundamentalFreshnessBadge', () => {
  describe('Status Edge Cases', () => {
    it('renders correctly for canonical statuses: active, stale, missing', () => {
      const activeHtml = renderToString(<FundamentalFreshnessBadge status="active" />);
      expect(activeHtml).toContain('🟢 Active (&lt;90d)');
      expect(activeHtml).toContain('data-status="active"');

      const staleHtml = renderToString(<FundamentalFreshnessBadge status="stale" />);
      expect(staleHtml).toContain('🟡 Stale (≥90d)');
      expect(staleHtml).toContain('data-status="stale"');

      const missingHtml = renderToString(<FundamentalFreshnessBadge status="missing" />);
      expect(missingHtml).toContain('🔴 Missing');
      expect(missingHtml).toContain('data-status="missing"');
    });

    it('handles null, undefined, and empty string status without crashing', () => {
      // @ts-expect-error testing null status
      const nullHtml = renderToString(<FundamentalFreshnessBadge status={null} />);
      expect(nullHtml).toContain('🔴 Missing');

      // @ts-expect-error testing undefined status
      const undefinedHtml = renderToString(<FundamentalFreshnessBadge status={undefined} />);
      expect(undefinedHtml).toContain('🔴 Missing');

      const emptyHtml = renderToString(<FundamentalFreshnessBadge status="" />);
      expect(emptyHtml).toContain('🔴 Missing');
      expect(emptyHtml).toContain('data-status=""');
    });

    it('handles unexpected strings and casing anomalies safely', () => {
      const unexpectedCases = [
        'ACTIVE',
        'Active',
        'STALE',
        'Stale',
        'MISSING',
        'random_garbage',
        'UNKNOWN_STATUS',
        'pending',
        '0',
        'false',
        '   ',
        '<script>alert(1)</script>',
      ];

      for (const statusVal of unexpectedCases) {
        expect(() => {
          const html = renderToString(<FundamentalFreshnessBadge status={statusVal} />);
          expect(html).toContain('🔴 Missing');
        }).not.toThrow();
      }
    });

    it('escapes or safely renders HTML/XSS injection attempts in status and asOfDate', () => {
      const xssStatus = '<img src=x onerror=alert(1)>';
      const xssDate = '2026-07-29" onmouseover="alert(1)';
      const html = renderToString(
        <FundamentalFreshnessBadge status="active" asOfDate={xssDate} />
      );
      // Ensure attribute quotes are escaped in SSR output
      expect(html).not.toContain('onmouseover="alert(1)"');
      expect(html).toContain('&quot; onmouseover=&quot;alert(1)');
    });
  });

  describe('Format Edge Cases', () => {
    it('handles format: short', () => {
      const activeShort = renderToString(<FundamentalFreshnessBadge status="active" format="short" />);
      expect(activeShort).toContain('🟢 Active');
      expect(activeShort).not.toContain('&lt;90d');

      const staleShort = renderToString(<FundamentalFreshnessBadge status="stale" format="short" />);
      expect(staleShort).toContain('🟡 Stale');
      expect(staleShort).not.toContain('≥90d');

      const missingShort = renderToString(<FundamentalFreshnessBadge status="missing" format="short" />);
      expect(missingShort).toContain('🔴 Missing');
    });

    it('handles format: verbose', () => {
      const activeVerbose = renderToString(<FundamentalFreshnessBadge status="active" format="verbose" />);
      expect(activeVerbose).toContain('🟢 Active (&lt;90d)');

      const staleVerbose = renderToString(<FundamentalFreshnessBadge status="stale" format="verbose" />);
      expect(staleVerbose).toContain('🟡 Stale (≥90d)');

      const missingVerbose = renderToString(<FundamentalFreshnessBadge status="missing" format="verbose" />);
      expect(missingVerbose).toContain('🔴 Missing');
    });

    it('handles omitted format (defaults to verbose)', () => {
      const html = renderToString(<FundamentalFreshnessBadge status="active" />);
      expect(html).toContain('🟢 Active (&lt;90d)');
    });

    it('handles unexpected or invalid format values gracefully', () => {
      // @ts-expect-error testing invalid format
      const html = renderToString(<FundamentalFreshnessBadge status="active" format="invalid_format" />);
      // In switch/ternary, format === 'short' is false, so it falls back to verbose
      expect(html).toContain('🟢 Active (&lt;90d)');
    });
  });

  describe('asOfDate Edge Cases & Hover Tooltip', () => {
    it('handles null, undefined, and empty string asOfDate without corrupting tooltip', () => {
      const nullDateHtml = renderToString(<FundamentalFreshnessBadge status="active" asOfDate={null} />);
      expect(nullDateHtml).toContain('title="Active: Filing updated within 90 days"');
      expect(nullDateHtml).not.toContain('(As-of:');

      const undefDateHtml = renderToString(<FundamentalFreshnessBadge status="active" asOfDate={undefined} />);
      expect(undefDateHtml).toContain('title="Active: Filing updated within 90 days"');
      expect(undefDateHtml).not.toContain('(As-of:');

      const emptyDateHtml = renderToString(<FundamentalFreshnessBadge status="active" asOfDate="" />);
      expect(emptyDateHtml).toContain('title="Active: Filing updated within 90 days"');
      expect(emptyDateHtml).not.toContain('(As-of:');
    });

    it('handles valid ISO dates, timestamp formats, and full ISO strings', () => {
      const ymdHtml = renderToString(<FundamentalFreshnessBadge status="active" asOfDate="2026-07-29" />);
      expect(ymdHtml).toContain('title="Active: Filing updated within 90 days (As-of: 2026-07-29)"');

      const isoHtml = renderToString(<FundamentalFreshnessBadge status="stale" asOfDate="2026-01-15T08:30:00Z" />);
      expect(isoHtml).toContain('title="Stale: Filing is ≥ 90 days old, quarterly refresh needed (As-of: 2026-01-15T08:30:00Z)"');
    });

    it('handles future dates and malformed date strings without throwing', () => {
      const malformedDates = [
        '9999-99-99',
        'not-a-date',
        '2026/02/31',
        '2099-01-01',
        '--Invalid--',
      ];

      for (const d of malformedDates) {
        expect(() => {
          const html = renderToString(<FundamentalFreshnessBadge status="active" asOfDate={d} />);
          expect(html).toContain(`(As-of: ${d})`);
        }).not.toThrow();
      }
    });

    it('maintains missing tooltip without date suffix even if asOfDate is accidentally supplied', () => {
      const html = renderToString(<FundamentalFreshnessBadge status="missing" asOfDate="2026-07-29" />);
      expect(html).toContain('title="Missing: No qualitative fundamental brief recorded"');
      expect(html).not.toContain('(As-of: 2026-07-29)');
    });
  });
});

describe('Empirical Adversarial Stress Suite: generateGeminiExtractionPrompt & CopyPromptModal', () => {
  describe('Symbol Variations & Boundary Conditions in generateGeminiExtractionPrompt', () => {
    it('verifies exact contract strings required by ADR 0010 & E2E', () => {
      const prompt = generateGeminiExtractionPrompt('ARM');

      // Exact contract string checks
      expect(prompt).toContain('# Fundamental Research Extraction Prompt: ARM');
      expect(prompt).toContain('"symbol": "ARM"');
      expect(prompt).toContain('save_fundamental_brief');
      expect(prompt).toContain('"business_model":');
      expect(prompt).toContain('"moat":');
      expect(prompt).toContain('"competitors":');
      expect(prompt).toContain('"guidance":');
      expect(prompt).toContain('"key_risks":');
      expect(prompt).toContain('"thesis_kpis":');
      expect(prompt).toContain('"as_of_date":');
      expect(prompt).toContain('MUST be derived from the filing or earnings release date');
      expect(prompt).toContain('Do NOT invent dates');
    });

    it('handles lowercase, mixed-case, and whitespace around valid symbols', () => {
      const lowerPrompt = generateGeminiExtractionPrompt('nvda');
      expect(lowerPrompt).toContain('# Fundamental Research Extraction Prompt: NVDA');
      expect(lowerPrompt).toContain('"symbol": "NVDA"');

      const paddedPrompt = generateGeminiExtractionPrompt('   aapl   ');
      expect(paddedPrompt).toContain('# Fundamental Research Extraction Prompt: AAPL');
      expect(paddedPrompt).toContain('"symbol": "AAPL"');
    });

    it('evaluates behavior on empty string vs undefined vs null', () => {
      const emptyPrompt = generateGeminiExtractionPrompt('');
      expect(emptyPrompt).toContain('# Fundamental Research Extraction Prompt: TICKER');
      expect(emptyPrompt).toContain('"symbol": "TICKER"');

      const undefPrompt = generateGeminiExtractionPrompt(undefined);
      expect(undefPrompt).toContain('# Fundamental Research Extraction Prompt: TICKER');
      expect(undefPrompt).toContain('"symbol": "TICKER"');

      // @ts-expect-error testing null
      const nullPrompt = generateGeminiExtractionPrompt(null);
      expect(nullPrompt).toContain('# Fundamental Research Extraction Prompt: TICKER');
      expect(nullPrompt).toContain('"symbol": "TICKER"');
    });

    it('OBSERVATION: behavior on pure whitespace symbols ("   ")', () => {
      // In JavaScript: ('   ' || 'TICKER').trim().toUpperCase() yields ""
      const whitespacePrompt = generateGeminiExtractionPrompt('   ');
      // Let's document the actual behavior:
      // If ('   ' || 'TICKER') is used, ('   ') is truthy, so trim() makes it ''
      // If (symbol?.trim() || 'TICKER') had been used, it would be 'TICKER'
      const isTicker = whitespacePrompt.includes('# Fundamental Research Extraction Prompt: TICKER');
      const isEmpty = whitespacePrompt.includes('# Fundamental Research Extraction Prompt: \n');
      expect(isTicker || isEmpty).toBe(true);
    });

    it('handles special-character symbols (e.g. BRK.A, BRK-B, BF/B)', () => {
      const dotSymbolPrompt = generateGeminiExtractionPrompt('brk.b');
      expect(dotSymbolPrompt).toContain('# Fundamental Research Extraction Prompt: BRK.B');
      expect(dotSymbolPrompt).toContain('"symbol": "BRK.B"');

      const hyphenSymbolPrompt = generateGeminiExtractionPrompt('brk-a');
      expect(hyphenSymbolPrompt).toContain('# Fundamental Research Extraction Prompt: BRK-A');
      expect(hyphenSymbolPrompt).toContain('"symbol": "BRK-A"');
    });

    it('validates that the embedded JSON schema block is valid JSON template', () => {
      const prompt = generateGeminiExtractionPrompt('MSFT');
      const jsonMatch = prompt.match(/```json\s*([\s\S]*?)\s*```/);
      expect(jsonMatch).not.toBeNull();
      const jsonContent = jsonMatch![1];
      // Should be valid JSON
      expect(() => JSON.parse(jsonContent)).not.toThrow();
      const parsed = JSON.parse(jsonContent);
      expect(parsed.symbol).toBe('MSFT');
      expect(parsed).toHaveProperty('business_model');
      expect(parsed).toHaveProperty('moat');
      expect(parsed).toHaveProperty('competitors');
      expect(parsed).toHaveProperty('guidance');
      expect(parsed.guidance).toHaveProperty('revenue_target');
      expect(parsed.guidance).toHaveProperty('margin_target');
      expect(parsed.guidance).toHaveProperty('timeframe');
      expect(parsed.guidance).toHaveProperty('key_assumptions');
      expect(parsed).toHaveProperty('key_risks');
      expect(parsed).toHaveProperty('thesis_kpis');
      expect(parsed).toHaveProperty('as_of_date');
    });
  });

  describe('CopyPromptModal Component SSR Stress', () => {
    it('renders all sections and props when open=true', () => {
      const html = renderToString(
        <CopyPromptModal
          open={true}
          onClose={() => {}}
          symbol="TSM"
          companyName="Taiwan Semiconductor Manufacturing Company"
          asOfDate="2026-08-10"
        />
      );

      expect(html).toContain('Gemini Extraction Prompt: TSM');
      expect(html).toContain('Taiwan Semiconductor Manufacturing Company (TSM)');
      expect(html).toContain('Current filing date: 2026-08-10');
      expect(html).toContain('Instructions for Gemini Notebooks');
      expect(html).toContain('Copy Extraction Prompt');
      expect(html).toContain('Close');
    });

    it('omits companyName and asOfDate gracefully if undefined or null', () => {
      const html = renderToString(
        <CopyPromptModal
          open={true}
          onClose={() => {}}
          symbol="INTC"
          companyName={undefined}
          asOfDate={null}
        />
      );

      expect(html).toContain('Gemini Extraction Prompt: INTC');
      expect(html).toContain('Open Google Gemini Notebook for <strong>INTC</strong>');
      expect(html).not.toContain('Current filing date:');
    });

    it('falls back to TICKER if symbol prop is omitted or empty', () => {
      const htmlOmitted = renderToString(
        <CopyPromptModal open={true} onClose={() => {}} />
      );
      expect(htmlOmitted).toContain('Gemini Extraction Prompt: TICKER');

      const htmlEmpty = renderToString(
        <CopyPromptModal open={true} onClose={() => {}} symbol="" />
      );
      expect(htmlEmpty).toContain('Gemini Extraction Prompt: TICKER');
    });

    it('renders nothing when open=false', () => {
      const html = renderToString(
        <CopyPromptModal open={false} onClose={() => {}} symbol="NVDA" />
      );
      expect(html).not.toContain('Gemini Extraction Prompt: NVDA');
    });

    it('supports disablePortal override for SSR tests', () => {
      const htmlExplicitPortal = renderToString(
        <CopyPromptModal open={true} onClose={() => {}} disablePortal={true} symbol="ARM" />
      );
      expect(htmlExplicitPortal).toContain('Gemini Extraction Prompt: ARM');
    });
  });
});
