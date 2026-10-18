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
} from '@mui/joy';
import { Copy, Check, Sparkles, FileText } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';

export interface CopyPromptModalProps {
  /** Controls modal open/close state */
  open: boolean;
  /** Modal close callback handler */
  onClose: () => void;
  /** Target stock ticker symbol (e.g. "ARM", "NVDA"). Defaults to "TICKER" if omitted */
  symbol?: string;
  /** Optional human-readable company name (e.g. "Arm Holdings plc") */
  companyName?: string;
  /** Optional existing as-of date for context */
  asOfDate?: string | null;
  /** Disable portal to render modal inline (useful for SSR and test environments) */
  disablePortal?: boolean;
}

export function generateGeminiExtractionPrompt(symbol?: string): string {
  const normSymbol = (symbol || 'TICKER').trim().toUpperCase();
  return [
    `# Fundamental Intelligence & Bull vs. Bear Debate Extraction: ${normSymbol}`,
    '',
    'You are a Senior Equity Research Analyst conducting a comprehensive fundamental deep-dive using all primary documents uploaded in this notebook (10-K, 10-Q, Earnings Call Transcripts, Investor Presentation Slides, and Thesis Notes).',
    '',
    '## Mandatory Instructions:',
    '1. **Language**: Write all qualitative explanations, arguments, and summaries in **Institutional-Grade Thai (ภาษาไทยระดับนักวิเคราะห์สถาบัน)**. Professional technical/financial terms may be transliterated in English where appropriate.',
    '2. **Evidence Grounding**: Every single claim, catalyst, risk, and rebuttal **MUST** cite real figures, growth percentages, margins, or KPIs disclosed in the notebook sources. Never generalize without numbers.',
    '3. **Dialectical Debate**: Conduct a rigorous 3-Round Bull vs. Bear debate (Opening Theses -> Cross-Examination Rebuttals -> Dialectical Arbiter Synthesis with conviction score from -10 to +10).',
    '4. **Single Atomic Tool Call**: Invoke the MCP tool `save_fundamental_brief` **once** with both the fundamental research profile and the full `debate` object:',
    '',
    '```json',
    '{',
    `  "symbol": "${normSymbol}",`,
    '  "business_model": "สรุปโครงสร้างรายได้ กลไกการสร้างมูลค่า และหน่วยเศรษฐกิจ (Unit Economics) 2-3 ประโยคในภาษาไทยระดับนักวิเคราะห์",',
    '  "moat": "วิเคราะห์ปราการทางเศรษฐกิจ (Network Effects, Switching Costs, Cost Advantages, Intangibles/IP) พร้อมตัวเลขและข้อเท็จจริงสนับสนุน",',
    '  "competitors": ["ชื่อคู่แข่ง/สถาปัตยกรรม A", "ชื่อคู่แข่ง B"],',
    '  "guidance": {',
    '    "revenue_target": "เป้าหมายการเติบโตของรายได้ (เช่น 20-25% YoY หรือ $1.2B ใน FY27)",',
    '    "margin_target": "เป้าหมายอัตรากำไรขั้นต้นหรืออัตรากำไรจากการดำเนินงาน",',
    '    "timeframe": "กรอบเวลาของ Guidance (เช่น FY27 หรือ Q2 FY27)",',
    '    "key_assumptions": "สมมติฐานหลักที่ผู้บริหารเปิดเผยในการประชุมผลประกอบการ"',
    '  },',
    '  "key_risks": [',
    '    "ความเสี่ยงเชิงโครงสร้างหรืออุปสรรคทางเทคโนโลยี พร้อมผลกระทบต่อผลการดำเนินงาน",',
    '    "ความเสี่ยงด้านการกระจุกตัวของลูกค้า หรือความไม่แน่นอนทางกฎระเบียบและเศรษฐกิจมหภาค"',
    '  ],',
    '  "thesis_kpis": [',
    '    "ตัวชี้วัดเชิงปริมาณหลักในการติดตามวิทยานิพนธ์การลงทุน (เช่น ASP, Penetration Rate %, Volume Adoption, ARR)",',
    '    "ตัวชี้วัดรอง (เช่น Gross Retention %, Net Expansion Rate)"',
    '  ],',
    '  "debate": {',
    '    "round1": {',
    '      "bull": {',
    '        "bull_thesis": "วิทยานิพนธ์ฝั่งกระทิง 2-3 ประโยค เน้นศักยภาพการเติบโตและการขยาย Moat",',
    '        "growth_catalysts": ["ปัจจัยเร่งการเติบโตข้อ 1 พร้อมตัวเลขจริงจากเอกสาร", "ปัจจัยเร่งข้อ 2"],',
    '        "competitive_advantages": ["ความได้เปรียบทางการแข่งขันเชิงโครงสร้างข้อ 1", "ข้อ 2"],',
    '        "valuation_upside": "การประเมินส่วนต่างราคาและโอกาสปรับเพิ่มประมาณการกำไร"',
    '      },',
    '      "bear": {',
    '        "bear_thesis": "วิทยานิพนธ์ฝั่งหมี 2-3 ประโยค เน้นจุดตาย ความเสี่ยงขาลง และ Inversion Thinking",',
    '        "downside_risks": ["ความเสี่ยงขาลงข้อ 1 พร้อมตัวเลขชี้วัดความเปราะบาง", "ความเสี่ยงข้อ 2"],',
    '        "structural_headwinds": ["อุปสรรคเชิงโครงสร้างและการแข่งขันที่รุนแรงขึ้น", "ข้อ 2"],',
    '        "valuation_stretch": "ความตึงตัวของ Valuation และความเสี่ยงในการถูก Multiple Compression"',
    '      }',
    '    },',
    '    "round2_rebuttal": {',
    '      "bull_rebuttal": {',
    '        "rebuttal_arguments": ["ข้อโต้แย้งหักล้างความเสี่ยงของฝั่ง Bear ด้วยหลักฐานและงบการเงิน"],',
    '        "mitigating_factors": ["ปัจจัยบรรเทาความเสี่ยงและสภาพคล่องรองรับ"]',
    '      },',
    '      "bear_rebuttal": {',
    '        "rebuttal_arguments": ["การชี้จุดบกพร่องในมุมมองฝั่ง Bull ว่ามองโลกในแง่ดีเกินจริง"],',
    '        "skeptical_counters": ["ข้อสังเกตและสมมติฐานที่ฝั่ง Bull มองข้าม"]',
    '      }',
    '    },',
    '    "synthesis": {',
    '      "key_tensions": [',
    '        {',
    '          "topic": "ประเด็นข้อถกเถียงชี้ขาด (เช่น อัตราการนำเทคโนโลยีไปใช้ vs. การถูกแทนที่)",',
    '          "bull_argument": "ข้ออ้างฝั่ง Bull พร้อมตัวเลขสนับสนุน",',
    '          "bear_argument": "ข้ออ้างฝั่ง Bear พร้อมตัวเลขความเสี่ยง",',
    '          "decisive_factor": "ตัวชี้วัดหรือรายงานที่จะเป็นจุดตัดสินในอนาคต"',
    '        }',
    '      ],',
    '      "consensus_points": ["จุดที่ทั้งฝ่าย Bull และ Bear เห็นพ้องตรงกัน"],',
    '      "conviction_score": 4,',
    '      "conviction_label": "Moderate Bull",',
    '      "verdict_summary": "บทสรุปดุลยภาพความเสี่ยงและผลตอบแทน 3-4 ประโยคเป็นภาษาไทยระดับนักวิเคราะห์"',
    '    }',
    '  },',
    '  "as_of_date": "YYYY-MM-DD (MUST be derived from the filing or earnings release date, e.g. 2026-07-29)"',
    '}',
    '```',
    '',
    '**Strict Requirement**: Derive `as_of_date` strictly from the document publication date. Do NOT invent dates.'
  ].join('\n');
}

export const CopyPromptModal: React.FC<CopyPromptModalProps> = ({
  open,
  onClose,
  symbol = 'TICKER',
  companyName,
  asOfDate,
  disablePortal,
}) => {
  const [copied, setCopied] = useState(false);
  const normSymbol = useMemo(() => (symbol || 'TICKER').trim().toUpperCase(), [symbol]);
  const promptText = useMemo(() => generateGeminiExtractionPrompt(normSymbol), [normSymbol]);

  // Reset copied state when modal opens or symbol changes
  useEffect(() => {
    if (open) {
      setCopied(false);
    }
  }, [open, normSymbol]);

  // Reset copied status after 2 seconds
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
        await navigator.clipboard.writeText(promptText);
        setCopied(true);
        return;
      }
      throw new Error('Clipboard API unavailable');
    } catch {
      // Fallback: off-screen textarea execCommand copy
      try {
        if (typeof document !== 'undefined') {
          const textArea = document.createElement('textarea');
          textArea.value = promptText;
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
  }, [promptText]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      disablePortal={disablePortal ?? (typeof window === 'undefined')}
    >
      <ModalDialog
        role="dialog"
        aria-labelledby="copy-prompt-title"
        sx={{
          ...glassStyle,
          maxWidth: 640,
          width: { xs: '92%', sm: '85%', md: 640 },
          maxHeight: '90vh',
          borderRadius: '20px',
          p: 3,
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <ModalClose />
        <DialogTitle
          id="copy-prompt-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            fontWeight: 800,
            fontSize: '1.25rem',
            letterSpacing: '-0.02em',
            mb: 0.5,
          }}
        >
          <Sparkles size={22} color="var(--joy-palette-primary-500)" />
          {`Gemini Extraction Prompt: ${normSymbol}`}
        </DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', mt: 1 }}>
          {/* Instructions Box */}
          <Sheet
            variant="soft"
            color="primary"
            sx={{
              p: 2,
              borderRadius: '12px',
              border: '1px solid rgba(52, 152, 219, 0.2)',
            }}
          >
            <Typography level="title-sm" sx={{ fontWeight: 700, mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <FileText size={16} /> Instructions for Gemini Notebooks
            </Typography>
            <Typography level="body-xs" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
              1. Open Google Gemini Notebook for <strong>{companyName ? `${companyName} (${normSymbol})` : normSymbol}</strong>.{asOfDate ? ` Current filing date: ${asOfDate}.` : ''}<br />
              2. Upload quarterly filings (10-Q/10-K), investor slides, or earnings call transcripts.<br />
              3. Click <strong>Copy Extraction Prompt</strong> below and paste it into Gemini.<br />
              4. Gemini will extract qualitative attributes and automatically invoke <code>save_fundamental_brief</code> via MCP.
            </Typography>
          </Sheet>

          {/* Prompt Preview Textarea */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography level="body-xs" sx={{ fontWeight: 600, color: 'text.tertiary' }}>
              Prompt Content (Read-only preview):
            </Typography>
            <Textarea
              minRows={9}
              maxRows={13}
              value={promptText}
              readOnly
              variant="soft"
              aria-label="Prompt Content"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                lineHeight: 1.5,
                bgcolor: 'background.level1',
                borderRadius: '12px',
                border: '1px solid var(--joy-palette-neutral-outlinedBorder)',
                '& textarea': {
                  userSelect: 'all',
                },
              }}
            />
          </Box>

          {/* Action Buttons */}
          <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ pt: 1 }}>
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
                minWidth: 200,
                transition: 'all 0.2s ease-in-out',
              }}
            >
              {copied ? 'Copied to Clipboard!' : 'Copy Extraction Prompt'}
            </Button>
          </Stack>
        </DialogContent>
      </ModalDialog>
    </Modal>
  );
};

export default CopyPromptModal;
