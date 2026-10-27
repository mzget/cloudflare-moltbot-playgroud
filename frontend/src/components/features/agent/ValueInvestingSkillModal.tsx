import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  ModalClose,
  Button,
  Typography,
  Box,
  Stack,
  Textarea,
  Sheet,
  Tabs,
  TabList,
  Tab,
} from '@mui/joy';
import { Copy, Check, Sparkles, Download, FileText, BookOpen } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';

export interface ValueInvestingSkillModalProps {
  /** Controls modal open/close state */
  open: boolean;
  /** Modal close callback handler */
  onClose: () => void;
  /** Target stock ticker symbol (e.g. "RMBS", "NVDA"). Defaults to "TICKER" if omitted */
  symbol?: string;
  /** Disable portal to render modal inline (useful for SSR and test environments) */
  disablePortal?: boolean;
}

export const PORTABLE_VALUE_INVESTING_SKILL_MD = `---
name: value-investing-brainstormer
description: Brainstorm, analyze, and stress-test investment opportunities using Hamilton Helmer's 7 Powers, Howard Marks' market cycle insights, Charlie Munger's inversion & mental models, Warren Buffett's moat & owner mentality, Peter Lynch's stock categories & PEG, and Joel Greenblatt's Magic Formula (ROC & EY). Supports both interactive brainstorming and automated Oaktree Deep Value Report generation via MCP (\`save_value_investing_report\`).
---

# Value Investing Brainstormer & 6-Guru Deep Analysis Skill

A specialized multi-disciplinary skill for analyzing businesses, competitive advantages, valuation resilience, and market positioning through the synthesis of **6 Master Value Investors**:
- **Hamilton Helmer's 7 Powers** (Statics & Dynamics)
- **Howard Marks' Second-Level Thinking & Market Cycles**
- **Charlie Munger's Latticework of Mental Models & Inversion**
- **Warren Buffett's Circle of Competence, Economic Moat & Owner Mentality**
- **Peter Lynch's 6 Stock Categories, PEG Ratio & The Story**
- **Joel Greenblatt's Magic Formula (Return on Capital & Earnings Yield) & Value Trap Check**

---

## When to Use

Use this skill in either of two operational modes:
- **Mode 1 — Interactive Brainstorming & Stress-Testing**:
  - Brainstorming or analyzing an equity, business model, or industry disruption.
  - Evaluating corporate economic moats, differential margins, and competitive durability.
  - Performing pre-mortem stress testing ("Invert, always invert") and vulnerability assessments.
  - Determining market cycle positioning, risk asymmetry, and margin of safety.
  - Deconstructing technology, semiconductor, platform, or infrastructure ecosystems.
- **Mode 2 — Oaktree Deep Value Report & MCP Persistence**:
  - Generating a comprehensive Institutional-Grade Thai Deep Value Analysis Report (8 sections + 6-Guru scorecard) for a stock symbol and saving it directly to the Oaktree platform via the \`save_value_investing_report\` MCP tool.

---

## Analytical Frameworks

### 1. Hamilton Helmer's 7 Powers (Moat & Dynamics)
Every true strategy must satisfy **The Mantra: A route to continuing Power in significant markets**.
Power requires both a **Benefit** (cash flow boost via higher pricing, reduced cost, or lower capex) and a **Barrier** (prevents competitive arbitrage).

Evaluate the business against the 7 Powers:
1. **Scale Economies**: Declining unit cost with volume + prohibitive barrier to match scale.
2. **Network Economies**: Customer value increases with installed base + leader advantage.
3. **Counter-Positioning**: Challenger adopts a superior, heterodox model that incumbent cannot match due to collateral damage to its legacy business (cannibalization, cognitive bias, or agency issues).
4. **Switching Costs**: Unattractive prospective switching loss / lock-in (financial, procedural, relational).
5. **Branding**: Durable attribution of higher value to an objectively identical offering via historical trust and repetition.
6. **Cornered Resource**: Preferential access to a coveted asset (must pass tests: *Idiosyncratic, Transferable, Ongoing, Sufficient*).
7. **Process Power**: Complex, opaque, embedded organization and routines with hysteresis (speed limit to imitation).

Also track **Power Dynamics**:
- *Origination*: Counter-Positioning, Cornered Resource.
- *Takeoff*: Scale Economies, Network Economies, Switching Costs.
- *Stability*: Process Power, Branding.

### 2. Howard Marks' Second-Level Thinking & Cycles
- **Second-Level Thinking**: Ask "What does consensus think? What do I think differently? What is priced in? What if I am wrong?"
- **Market Cycles & Asymmetry**: Understand where we stand in the pendulum cycle. Focus on asymmetric risk/reward: limited downside with substantial upside.
- **Permanent Capital Loss**: Risk is the probability of permanent capital loss, not short-term volatility.
- **Defensive Investing**: Emphasize the avoidance of losers ("In tennis, amateur games are won by avoiding unforced errors"). Surviving the worst days and maintaining price discipline are paramount.

### 3. Charlie Munger & Warren Buffett Mentality
- **Owner Mindset & Owner's Earnings (Buffett)**: Evaluate the business as if acquiring 100% of it and holding it with the stock exchange closed for 10 years. Focus on true cash generation (\`Owner's Earnings = Net Income + D&A - Maintenance CapEx\`), ROE/ROIC consistency, moat durability, and earnings predictability.
- **Inversion ("Invert, always invert" — Munger)**: First identify how this business could fail, get disintermediated, or face margin collapse. Conduct a 2-year pre-mortem stress test.
- **Incentives & Agency**: Audit management compensation, capital allocation track record, SBC dilution, and alignment with long-term per-share value.
- **Latticework of Mental Models**: Integrate physics (critical mass, feedback loops), biology (co-evolution, niche adaptation), psychology (social proof, commitment bias, incentive-caused bias), and economics (opportunity cost, supply elasticity).
- **Circle of Competence**: Strictly define boundary between what is genuinely understood and what is speculative noise.

### 4. Peter Lynch's 6 Stock Categories, PEG Ratio & The Story
- **6 Stock Categories**: Classify the company into one of the 6 groups to anchor expectations:
  1. *Slow Growers* (2–4% growth, steady dividends)
  2. *Stalwarts* (10–12% growth, resilient market leaders)
  3. *Fast Growers* (20–25%+ growth, high upside with execution risk)
  4. *Cyclicals* (revenue/margins fluctuate with macro or industry capex cycles)
  5. *Turnarounds* (recovering from distress or restructuring)
  6. *Asset Plays* (unrecognized asset value exceeding market price)
- **The Story & PEG / PEGY Analysis**: Summarize the 2-sentence investment story and evaluate \`PEG = P/E ÷ Annual Growth Rate\` (\`< 1.0\` attractive).

### 5. Joel Greenblatt's Magic Formula (Quality + Cheap)
- **Return on Capital (ROC)**: Measure underlying business quality (\`EBIT ÷ (Net Working Capital + Net Fixed Assets)\` or ROIC/Operating Margin proxy).
- **Earnings Yield (EY)**: Measure valuation attractiveness (\`EBIT ÷ Enterprise Value\`, \`EV/EBIT\`, or \`FCF Yield\`).
- **Value Trap Check**: Verify whether an optically low multiple masks structural decay or peak cyclical earnings.

---

## Mode 1: Brainstorming & Analysis Workflow

1. **Business Deconstruction & Lynch Category**:
   - What does the company actually sell, to whom, and why do customers stay?
   - Classify into Peter Lynch's 6 categories and state the unit economics and core value proposition in plain language without corporate buzzwords.
2. **Power & Moat Audit (Helmer + Buffett)**:
   - Assess which of the 7 Powers exist today (Statics) and which are emerging/fading (Dynamics).
   - Identify the exact **Benefit** and the persistent **Barrier**. If there is no barrier, declare it operational excellence, not power.
3. **Inversion & Stress-Testing (Munger Style)**:
   - What kills this company in 5–10 years? (2-Year Pre-Mortem).
   - Are management incentives aligned with long-term per-share value creation?
4. **Second-Level, Cycle & Magic Formula Check (Marks + Greenblatt)**:
   - What is the consensus narrative? Where are we in the cycle?
   - Check ROC vs. Earnings Yield (\`EV/EBIT\`, \`P/FCF\`), audit for Value Traps, and verify if there is a margin of safety.
5. **Synthesis & Verdict**:
   - Summarize with candor, wit, and pragmatic clarity.

---

## Mode 2: Oaktree Deep Value Report & MCP Persistence (\`save_value_investing_report\`)

1. Ground every claim in real figures from the uploaded Notebook documents and/or Oaktree MCP tools (\`get_fundamental_brief\`, \`get_bull_bear_debate\`, \`get_dcf_model\`).
2. Write the full 8-section report in **Institutional-Grade Thai (ภาษาไทยระดับนักวิเคราะห์สถาบัน)**.
3. Call \`save_value_investing_report\` once with \`{ symbol, summary, conviction_level, source: "gemini_app" }\`.
`;

export function generateGeminiValueReportPrompt(symbol?: string): string {
  const normSymbol = (symbol || '').trim().toUpperCase() || 'TICKER';
  return [
    `# Value Investing Brainstormer & 6-Guru Deep Value Report: ${normSymbol}`,
    '',
    `You are a Master Value Investing Committee synthesizing the frameworks of **Hamilton Helmer (7 Powers)**, **Howard Marks (Second-Level Thinking & Cycles)**, **Charlie Munger (Inversion & Mental Models)**, **Warren Buffett (Owner Mentality & Moat)**, **Peter Lynch (6 Categories & PEG)**, and **Joel Greenblatt (Magic Formula ROC & EY)**.`,
    '',
    '## Step 1: Gather Grounded Context',
    `1. Review all primary filings (10-K, 10-Q, Earnings Transcripts, Investor Presentations) in this Notebook for **${normSymbol}**.`,
    `2. If connected to Oaktree MCP, optionally call \`get_fundamental_brief\`, \`get_bull_bear_debate\`, and \`get_dcf_model\` for \`${normSymbol}\` to cross-verify numbers.`,
    '3. Every claim, margin, growth rate, and valuation multiple MUST be grounded in real figures.',
    '',
    '## Step 2: Compile the Full 8-Section Thai Markdown Report',
    'Write the complete report in **Institutional-Grade Thai (ภาษาไทยระดับนักวิเคราะห์สถาบัน)** following this exact 8-section Markdown structure:',
    '',
    '```markdown',
    `# รายงานการวิเคราะห์การลงทุนเชิงลึก: ${normSymbol}`,
    '',
    '## 1. บทสรุปการวิเคราะห์เชิงรับ (Executive Summary)',
    '- **ระดับความเชื่อมั่น (Conviction Level)**: High / Medium / Low',
    '- **การถอดรหัสธุรกิจและเรื่องราวของหุ้น (Business Deconstruction & The Story)**: บริษัทขายอะไร ให้ใคร ทำไมลูกค้าถึงไม่ย้ายหนี และสรุปหน่วยเศรษฐกิจ (Unit Economics) ใน 2–3 ประโยคที่ชัดเจนไร้คำศัพท์โฆษณา',
    '- **มุมมองที่แตกต่างและประเด็นสำคัญสูงสุด (Core Thesis & Variant Perception)**: สิ่งที่ตลาดอาจมองข้ามและดุลยภาพความเสี่ยงต่อผลตอบแทน',
    '',
    '## 2. การจำแนกประเภทและเรื่องราวของหุ้น (Peter Lynch Framework)',
    '- **การจัดกลุ่มหุ้น (Stock Category)**: จำแนกเป็น 1 ใน 6 ประเภท (Slow Growers, Stalwarts, Fast Growers, Cyclicals, Turnarounds, Asset Plays) พร้อมเหตุผลเชิงตัวเลข',
    '- **การวิเคราะห์ PEG / PEGY และการเติบโต**: ประเมินความสมเหตุสมผลของ P/E และ P/FCF เทียบกับอัตราการเติบโตรายได้และกำไร',
    '- **จุดตรวจสอบเรื่องราว (Story Checkpoints)**: ตัวชี้วัดสำคัญที่ใช้ติดตามว่าเรื่องราวการเติบโตยังคงเป็นจริง',
    '',
    '## 3. ปราการทางยุทธศาสตร์และการแข่งขัน (Hamilton Helmer 7 Powers)',
    '- **7 Powers Audit (Statics)**: ประเมินความได้เปรียบใน 7 Powers (Scale Economies, Network Economies, Counter-Positioning, Switching Costs, Branding, Cornered Resource, Process Power) โดยระบุ **Benefit** (ผลบวกต่อกระแสเงินสด/อัตรากำไร) และ **Barrier** (ปราการป้องกันคู่แข่งเลียนแบบ) อย่างชัดเจน — *หากไม่มี Barrier ให้ระบุตรงไปตรงมาว่าเป็นเพียง Operational Excellence ไม่ใช่ Power*',
    '- **พลวัตของอำนาจ (Power Dynamics)**: ประเมินช่วงชีวิตของปราการ (Origination / Takeoff / Stability) ว่ากำลังก่อตัว ขยายตัว หรือเริ่มเสื่อมถอย',
    '',
    '## 4. คูเมืองและคุณภาพทางการเงินของกิจการ (Warren Buffett Framework)',
    '- **ขอบเขตความรู้และความทนทานของคูเมือง (Circle of Competence & Moat Durability)**: ประเมินความยั่งยืนของธุรกิจหากปิดตลาดหุ้นไป 10 ปี (Owner Mindset)',
    "- **คุณภาพงบการเงินและกำไรของเจ้าของ (Financial Quality & Owner's Earnings)**: วิเคราะห์ Gross/Operating/FCF Margin, ROIC/ROE, โครงสร้างหนี้สินและเงินสดสุทธิ รวมถึงความสม่ำเสมอของกระแสเงินสด (Predictability 1–5)",
    '',
    '## 5. การจำลองความคิดและการวิเคราะห์เชิงกลับ (Charlie Munger Framework)',
    '- **การคิดย้อนกลับ (Inversion — "Invert, always invert")**: อะไรที่จะฆ่าธุรกิจนี้ใน 5–10 ปี หรือทำให้เกิดการสูญเสียเงินต้นถาวร?',
    '- **การจำลองเหตุการณ์วิกฤต (2-Year Pre-Mortem)**: หากราคาหุ้นร่วงลง 50% ในอีก 2 ปีข้างหน้า สาเหตุหลักจะเกิดจากอะไร (เทคโนโลยีทดแทน, การจัดสรรเงินทุนผิดพลาด, หรือกฎระเบียบ)?',
    '- **โครงสร้างแรงจูงใจและแบบจำลองความคิด (Incentives & Latticework of Mental Models)**: วิเคราะห์ผลประโยชน์ของผู้บริหาร (Capital Allocation, SBC Dilution) และกลไกทางจิตวิทยา/เศรษฐศาสตร์ที่เกี่ยวข้อง',
    '',
    '## 6. การคิดขั้นที่สองและวัฏจักรตลาด (Howard Marks Framework)',
    '- **การคิดขั้นที่สอง (Second-Level Thinking)**: ตลาด (Consensus) คิดอย่างไร ราคาหุ้นสะท้อนความคาดหวังไปมากน้อยเพียงใด และเราจะผิดพลาดได้จากจุดไหน?',
    '- **ตำแหน่งในวัฏจักรและความไม่สมมาตรของผลตอบแทน (Cycle Position & Asymmetry)**: ประเมินจุดยืนในวัฏจักร (ต้น/กลาง/ปลายวัฏจักร) ความเสี่ยง Permanent Capital Loss และระดับ Margin of Safety',
    '',
    '## 7. คะแนนคุณภาพและความถูกของธุรกิจ (Joel Greenblatt Magic Formula)',
    '- **ผลตอบแทนต่อเงินทุน (Return on Capital — ROC)**: ประเมินประสิทธิภาพการสร้างกำไรจากเงินทุนดำเนินงาน',
    '- **ผลตอบแทนจากการดำเนินงาน (Earnings Yield — EY)**: ประเมินความถูกแพงผ่าน EV/EBIT, P/FCF หรือ FCF Yield',
    '- **การตรวจสอบกับดักมูลค่า (Value Trap Check)**: วิเคราะห์ว่าความถูกของหุ้นเป็นโอกาสจริงหรือเป็นกับดักมูลค่าเชิงโครงสร้าง',
    '',
    '## 8. ตารางคะแนนรวมและบทสรุปเพื่อการตัดสินใจ (Meta-Synthesis & Verdict)',
    '| กรอบการวิเคราะห์ (Framework) | คะแนน (เต็ม 10) | สรุปเหตุผลสำคัญ (Key Rationale) |',
    '| :--- | :---: | :--- |',
    '| **1. Peter Lynch (Category, Story & PEG)** | X/10 | ... |',
    '| **2. Hamilton Helmer (7 Powers Statics & Dynamics)** | X/10 | ... |',
    "| **3. Warren Buffett (Moat & Owner's Earnings)** | X/10 | ... |",
    '| **4. Charlie Munger (Inversion & Incentives)** | X/10 | ... |',
    '| **5. Howard Marks (Second-Level & Cycle Risk)** | X/10 | ... |',
    '| **6. Joel Greenblatt (Magic Formula ROC & EY)** | X/10 | ... |',
    '| **คะแนนเฉลี่ยรวม (Overall Score)** | **X.X/10** | **ระดับความเชื่อมั่น: High / Medium / Low** |',
    '',
    '- **จุดแข็งสำคัญ (Key Strengths)**: สรุป 3–4 ข้อพร้อมตัวเลขสนับสนุน',
    '- **ความเสี่ยงหลักที่ต้องเฝ้าระวัง (Key Risks)**: สรุป 3–4 ข้อพร้อมตัวชี้วัดเตือนภัย',
    '- **คำแนะนำและบทสรุปสุดท้าย (Final Verdict)**: สรุปอย่างตรงไปตรงมา คมคาย และมีวินัยด้านราคา',
    '```',
    '',
    '## Step 3: Save Report to Oaktree via MCP (`save_value_investing_report`)',
    'Invoke the MCP tool `save_value_investing_report` **once** with the complete Markdown report:',
    '```json',
    '{',
    `  "symbol": "${normSymbol}",`,
    `  "summary": "# รายงานการวิเคราะห์การลงทุนเชิงลึก: ${normSymbol}\\n\\n## 1. บทสรุปการวิเคราะห์เชิงรับ...",`,
    '  "conviction_level": "High",',
    '  "source": "gemini_app"',
    '}',
    '```',
    '*(Note: `conviction_level` must be strictly `"High"`, `"Medium"`, or `"Low"`.)*'
  ].join('\n');
}

export const ValueInvestingSkillModal: React.FC<ValueInvestingSkillModalProps> = ({
  open,
  onClose,
  symbol = 'TICKER',
  disablePortal,
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  const normSymbol = useMemo(() => (symbol || '').trim().toUpperCase() || 'TICKER', [symbol]);
  const promptText = useMemo(() => generateGeminiValueReportPrompt(normSymbol), [normSymbol]);

  const currentContent = activeTab === 0 ? promptText : PORTABLE_VALUE_INVESTING_SKILL_MD;

  useEffect(() => {
    if (open) {
      setCopied(false);
    }
  }, [open, normSymbol, activeTab]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(currentContent);
        setCopied(true);
        return;
      }
      throw new Error('Clipboard API unavailable');
    } catch {
      try {
        if (typeof document !== 'undefined') {
          const textArea = document.createElement('textarea');
          textArea.value = currentContent;
          textArea.style.position = 'fixed';
          textArea.style.top = '-9999px';
          textArea.style.left = '-9999px';
          textArea.setAttribute('readonly', '');
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const success = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (success) {
            setCopied(true);
          }
        }
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
    }
  }, [currentContent]);

  const handleDownloadSkill = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const blob = new Blob([PORTABLE_VALUE_INVESTING_SKILL_MD], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SKILL.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      disablePortal={disablePortal ?? (typeof window === 'undefined')}
    >
      <ModalDialog
        role="dialog"
        aria-labelledby="value-investing-skill-modal-title"
        sx={{
          ...glassStyle,
          maxWidth: 720,
          width: { xs: '94%', sm: '88%', md: 720 },
          maxHeight: '90vh',
          borderRadius: '20px',
          p: 3,
          boxShadow: 'lg',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <ModalClose />
        <DialogTitle
          id="value-investing-skill-modal-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            fontWeight: 800,
            fontSize: '1.2rem',
            letterSpacing: '-0.02em',
            mb: 0.5,
          }}
        >
          <Sparkles size={22} color="var(--joy-palette-primary-500)" />
          {`6-Guru Deep Value Skill & Prompt: ${normSymbol}`}
        </DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', mt: 1 }}>
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab((val as number) || 0)}
            sx={{ bgcolor: 'transparent' }}
          >
            <TabList
              variant="soft"
              size="sm"
              sx={{
                p: 0.5,
                borderRadius: '12px',
                bgcolor: 'background.level1',
                border: '1px solid',
                borderColor: 'neutral.outlinedBorder',
                width: 'fit-content',
              }}
            >
              <Tab disableIndicator sx={{ borderRadius: '8px', fontWeight: 700, gap: 1 }}>
                <FileText size={15} />
                {`Gemini Prompt (${normSymbol})`}
              </Tab>
              <Tab disableIndicator sx={{ borderRadius: '8px', fontWeight: 700, gap: 1 }}>
                <BookOpen size={15} />
                Portable Skill (SKILL.md)
              </Tab>
            </TabList>
          </Tabs>

          <Sheet
            variant="soft"
            color="primary"
            sx={{
              p: 2,
              borderRadius: '12px',
              border: '1px solid',
              borderColor: 'primary.outlinedBorder',
            }}
          >
            {activeTab === 0 ? (
              <>
                <Typography level="title-sm" sx={{ fontWeight: 700, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FileText size={16} /> วิธีสั่งวิเคราะห์เชิงลึกผ่าน Google Gemini App / Spark
                </Typography>
                <Typography level="body-xs" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  1. เปิด Google Gemini App หรือ Notebook ที่เชื่อมต่อ <strong>Oaktree MCP</strong> และมีเอกสารของหุ้น <strong>{normSymbol}</strong><br />
                  2. คลิกปุ่ม <strong>Copy Gemini Prompt</strong> ด้านล่างแล้วนำไปวางในแชท Gemini<br />
                  3. Gemini จะวิเคราะห์ผ่านกรอบคิด 6 นักลงทุนระดับตำนาน (7 Powers, Marks, Munger, Buffett, Lynch, Greenblatt) และบันทึกกลับเข้า Oaktree อัตโนมัติผ่าน <code>save_value_investing_report</code><br />
                  4. กลับมาที่หน้านี้แล้วกดปุ่ม <strong>ซิงค์ข้อมูลล่าสุด</strong> เพื่อดูรายงานทันที
                </Typography>
              </>
            ) : (
              <>
                <Typography level="title-sm" sx={{ fontWeight: 700, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BookOpen size={16} /> Portable Skill สำหรับติดตั้งใน AI Agent หรือ Custom Gem
                </Typography>
                <Typography level="body-xs" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                  ไฟล์ <code>SKILL.md</code> นี้รวมกรอบคิด <strong>Value Investing Brainstormer (7 Powers + Marks + Munger + Buffett + Lynch + Greenblatt)</strong> รองรับทั้งโหมดระดมสมองโต้ตอบ (Brainstorming & Stress-Testing) และโหมดบันทึกเข้าระบบ Oaktree ผ่าน MCP สามารถกด <strong>Download SKILL.md</strong> เพื่อนำไปใช้ใน Agent อื่นๆ ได้ทันที
                </Typography>
              </>
            )}
          </Sheet>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography level="body-xs" sx={{ fontWeight: 600, color: 'text.tertiary' }}>
              {activeTab === 0 ? `Gemini Deep Value Prompt (${normSymbol}):` : 'SKILL.md (value-investing-brainstormer):'}
            </Typography>
            <Textarea
              minRows={10}
              maxRows={14}
              value={currentContent}
              readOnly
              variant="soft"
              aria-label="Skill or Prompt Content"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                lineHeight: 1.5,
                bgcolor: 'background.level1',
                borderRadius: '12px',
                border: '1px solid',
                borderColor: 'neutral.outlinedBorder',
                '& textarea': {
                  userSelect: 'all',
                },
              }}
            />
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
            spacing={1.5}
            sx={{ pt: 1 }}
          >
            <Button
              variant="outlined"
              color="neutral"
              startDecorator={<Download size={16} />}
              onClick={handleDownloadSkill}
              sx={{ borderRadius: '10px', fontWeight: 700 }}
            >
              Download SKILL.md
            </Button>

            <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
              <Button variant="plain" color="neutral" onClick={onClose} sx={{ borderRadius: '10px' }}>
                Close
              </Button>
              <Button
                variant="solid"
                color={copied ? 'success' : 'primary'}
                startDecorator={copied ? <Check size={16} /> : <Copy size={16} />}
                onClick={handleCopy}
                sx={{
                  borderRadius: '10px',
                  fontWeight: 700,
                  minWidth: 190,
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                {copied
                  ? 'Copied to Clipboard!'
                  : activeTab === 0
                  ? 'Copy Gemini Prompt'
                  : 'Copy SKILL.md'}
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
      </ModalDialog>
    </Modal>
  );
};

export default ValueInvestingSkillModal;
