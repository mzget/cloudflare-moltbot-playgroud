import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CopyPromptModal, generateGeminiExtractionPrompt } from './CopyPromptModal';

describe('CopyPromptModal & Prompt Generator', () => {
  describe('generateGeminiExtractionPrompt helper', () => {
    it('generates markdown prompt targeting the given ticker symbol', () => {
      const prompt = generateGeminiExtractionPrompt('ARM');
      expect(prompt).toContain('# Fundamental Research Extraction Prompt: ARM');
      expect(prompt).toContain('"symbol": "ARM"');
    });

    it('includes save_fundamental_brief JSON schema structure with all required fields', () => {
      const prompt = generateGeminiExtractionPrompt('NVDA');
      expect(prompt).toContain('save_fundamental_brief');
      expect(prompt).toContain('"business_model":');
      expect(prompt).toContain('"moat":');
      expect(prompt).toContain('"competitors":');
      expect(prompt).toContain('"guidance":');
      expect(prompt).toContain('"revenue_target":');
      expect(prompt).toContain('"margin_target":');
      expect(prompt).toContain('"timeframe":');
      expect(prompt).toContain('"key_assumptions":');
      expect(prompt).toContain('"key_risks":');
      expect(prompt).toContain('"thesis_kpis":');
      expect(prompt).toContain('"as_of_date":');
    });

    it('instructs Gemini to derive as_of_date strictly from source filing with no date invention', () => {
      const prompt = generateGeminiExtractionPrompt('ARM');
      expect(prompt).toContain('MUST be derived from the filing or earnings release date');
      expect(prompt).toContain('Do NOT invent dates');
    });

    it('normalizes input symbols with whitespace and casing', () => {
      const prompt = generateGeminiExtractionPrompt('  tsm  ');
      expect(prompt).toContain('# Fundamental Research Extraction Prompt: TSM');
      expect(prompt).toContain('"symbol": "TSM"');
    });

    it('falls back to TICKER when symbol is missing or empty', () => {
      const prompt = generateGeminiExtractionPrompt('');
      expect(prompt).toContain('# Fundamental Research Extraction Prompt: TICKER');
      expect(prompt).toContain('"symbol": "TICKER"');
    });

    it('formats prompt with valid markdown json code blocks', () => {
      const prompt = generateGeminiExtractionPrompt('AVGO');
      expect(prompt).toContain('```json');
      expect(prompt).toContain('```');
    });
  });

  describe('CopyPromptModal SSR Component', () => {
    it('renders modal dialog and prompt content when open is true', () => {
      const html = renderToString(
        <CopyPromptModal
          open={true}
          onClose={() => {}}
          symbol="ARM"
          companyName="Arm Holdings plc"
          asOfDate="2026-07-29"
        />
      );

      // Verify header and symbol
      expect(html).toContain('Gemini Extraction Prompt: ARM');
      expect(html).toContain('Arm Holdings plc (ARM)');
      expect(html).toContain('2026-07-29');

      // Verify instruction text and action button
      expect(html).toContain('Instructions for Gemini Notebooks');
      expect(html).toContain('save_fundamental_brief');
      expect(html).toContain('Copy Extraction Prompt');
      expect(html).toContain('Close');
    });

    it('does not render dialog content when open is false', () => {
      const html = renderToString(
        <CopyPromptModal
          open={false}
          onClose={() => {}}
          symbol="ARM"
        />
      );

      // Joy UI Modal with open={false} produces empty string or comments in SSR
      expect(html).not.toContain('Gemini Extraction Prompt: ARM');
      expect(html).not.toContain('Instructions for Gemini Notebooks');
    });
  });
});
