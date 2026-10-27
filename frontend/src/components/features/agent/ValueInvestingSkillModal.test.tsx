import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  ValueInvestingSkillModal,
  generateGeminiValueReportPrompt,
  PORTABLE_VALUE_INVESTING_SKILL_MD,
} from './ValueInvestingSkillModal';

describe('ValueInvestingSkillModal & Skill/Prompt Generators', () => {
  describe('PORTABLE_VALUE_INVESTING_SKILL_MD', () => {
    it('includes YAML frontmatter and all 6 Master Value Investors', () => {
      expect(PORTABLE_VALUE_INVESTING_SKILL_MD).toContain('name: value-investing-brainstormer');
      expect(PORTABLE_VALUE_INVESTING_SKILL_MD).toContain('Hamilton Helmer');
      expect(PORTABLE_VALUE_INVESTING_SKILL_MD).toContain('Howard Marks');
      expect(PORTABLE_VALUE_INVESTING_SKILL_MD).toContain('Charlie Munger');
      expect(PORTABLE_VALUE_INVESTING_SKILL_MD).toContain('Warren Buffett');
      expect(PORTABLE_VALUE_INVESTING_SKILL_MD).toContain('Peter Lynch');
      expect(PORTABLE_VALUE_INVESTING_SKILL_MD).toContain('Joel Greenblatt');
      expect(PORTABLE_VALUE_INVESTING_SKILL_MD).toContain('save_value_investing_report');
    });
  });

  describe('generateGeminiValueReportPrompt', () => {
    it('generates 8-section Thai Deep Value prompt targeting the given symbol', () => {
      const prompt = generateGeminiValueReportPrompt('rmbs');
      expect(prompt).toContain('# รายงานการวิเคราะห์การลงทุนเชิงลึก: RMBS');
      expect(prompt).toContain('save_value_investing_report');
      expect(prompt).toContain('"symbol": "RMBS"');
      expect(prompt).toContain('## 1. บทสรุปการวิเคราะห์เชิงรับ (Executive Summary)');
      expect(prompt).toContain('## 2. การจำแนกประเภทและเรื่องราวของหุ้น (Peter Lynch Framework)');
      expect(prompt).toContain('## 3. ปราการทางยุทธศาสตร์และการแข่งขัน (Hamilton Helmer 7 Powers)');
      expect(prompt).toContain('## 4. คูเมืองและคุณภาพทางการเงินของกิจการ (Warren Buffett Framework)');
      expect(prompt).toContain('## 5. การจำลองความคิดและการวิเคราะห์เชิงกลับ (Charlie Munger Framework)');
      expect(prompt).toContain('## 6. การคิดขั้นที่สองและวัฏจักรตลาด (Howard Marks Framework)');
      expect(prompt).toContain('## 7. คะแนนคุณภาพและความถูกของธุรกิจ (Joel Greenblatt Magic Formula)');
      expect(prompt).toContain('## 8. ตารางคะแนนรวมและบทสรุปเพื่อการตัดสินใจ (Meta-Synthesis & Verdict)');
    });

    it('falls back to TICKER when symbol is empty or omitted', () => {
      const prompt = generateGeminiValueReportPrompt('   ');
      expect(prompt).toContain('# รายงานการวิเคราะห์การลงทุนเชิงลึก: TICKER');
      expect(prompt).toContain('"symbol": "TICKER"');
    });
  });

  describe('ValueInvestingSkillModal SSR Component', () => {
    it('renders modal dialog, tabs, Download SKILL.md button, and Copy button when open is true', () => {
      const html = renderToString(
        <ValueInvestingSkillModal
          open={true}
          onClose={() => {}}
          symbol="RMBS"
        />
      );

      expect(html).toContain('6-Guru Deep Value Skill &amp; Prompt: RMBS');
      expect(html).toContain('save_value_investing_report');
      expect(html).toContain('Download SKILL.md');
      expect(html).toContain('Copy Gemini Prompt');
    });

    it('does not render modal dialog when open is false', () => {
      const html = renderToString(
        <ValueInvestingSkillModal
          open={false}
          onClose={() => {}}
          symbol="RMBS"
        />
      );

      expect(html).not.toContain('6-Guru Deep Value Skill &amp; Prompt: RMBS');
      expect(html).not.toContain('Download SKILL.md');
    });
  });
});
