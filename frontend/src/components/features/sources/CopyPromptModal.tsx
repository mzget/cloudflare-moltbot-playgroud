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
    `# Fundamental Research Extraction Prompt: ${normSymbol}`,
    '',
    'You are a Senior Equity Research Assistant analyzing the uploaded quarterly reports, earnings transcripts, and thesis slides for this company.',
    '',
    `Please extract the qualitative fundamental profile for **${normSymbol}** and invoke the MCP tool \`save_fundamental_brief\` with the following JSON schema:`,
    '',
    '```json',
    '{',
    `  "symbol": "${normSymbol}",`,
    '  "business_model": "Summarize revenue drivers, customer segment, and monetization mechanism in 2-3 clear sentences.",',
    '  "moat": "Analyze economic moat source (Network Effects, Switching Costs, Cost Advantages, Intangibles/Patents).",',
    '  "competitors": ["Competitor A", "Competitor B"],',
    '  "guidance": {',
    '    "revenue_target": "Stated forward revenue growth or target in $ or %",',
    '    "margin_target": "Stated gross margin or operating margin target",',
    '    "timeframe": "Filing target timeframe (e.g. FY27 or next quarter)",',
    '    "key_assumptions": "Underlying assumptions disclosed by management"',
    '  },',
    '  "key_risks": [',
    '    "Primary strategic or technological risk",',
    '    "Customer concentration, regulatory, or macroeconomic risk"',
    '  ],',
    '  "thesis_kpis": [',
    '    "Specific quantitative KPI tracking thesis success (e.g. ASP, unit adoption %, ARR)",',
    '    "Secondary metric (e.g. churn rate, gross retention %)"',
    '  ],',
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
