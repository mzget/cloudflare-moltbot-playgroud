import * as React from 'react';
import { Box, Button, Typography, Sheet, CircularProgress, Divider, Stack, Tabs, TabList, Tab, Select, Option } from '@mui/joy';
import { RotateCw, AlertTriangle, Sparkles, FileText, Calculator, BookOpen, TrendingUp, BarChart3, LayoutDashboard } from 'lucide-react';
import StockOverview from './StockOverview';
import StockThesis from './StockThesis';
import StockDossierCockpit from './StockDossierCockpit';
import { useNavigate } from '@tanstack/react-router';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';
import MarkdownRenderer from '../../common/MarkdownRenderer';
import DCFModel from './DCFModel';
import DebateCard from './DebateCard';
import ValueInvestingSkillModal from './ValueInvestingSkillModal';

const TAB_KEYS = ['dossier', 'overview', 'report', 'dcf-model', 'stock-thesis'] as const;

interface AnalysisReportProps {
  symbol: string;
  onBack?: () => void;
  subTab?: string;
  hospitality?: any; // Keep signature extensible if needed
}

export default function AnalysisReport({ symbol, subTab }: AnalysisReportProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [skillModalOpen, setSkillModalOpen] = React.useState(false);
  const [report, setReport] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const activeToolTab =
    subTab === 'overview'
      ? 1
      : subTab === 'report'
      ? 2
      : subTab === 'dcf-model'
      ? 3
      : subTab === 'stock-thesis'
      ? 4
      : 0;

  const [symbolsList, setSymbolsList] = React.useState<string[]>(['MSFT', 'AAPL', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA']);

  React.useEffect(() => {
    let cancelled = false;
    const fetchWatchlist = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/watchlist`);
        if (res.ok) {
          const data = (await res.json()) as any[];
          const active = data
            .map((item: any) => item.symbol)
            .filter(Boolean);
          if (!cancelled && active.length > 0) {
            const combined = Array.from(new Set(['MSFT', 'AAPL', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', ...active, symbol])).sort();
            setSymbolsList(combined);
          }
        }
      } catch (e) {
        console.error('Failed to fetch watchlist symbols for selector:', e);
      }
    };
    fetchWatchlist();
    return () => { cancelled = true; };
  }, [symbol]);

  const fetchReport = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/results?symbol=${symbol}`);
      if (res.status === 404) {
        setReport(null);
      } else if (!res.ok) {
        throw new Error('ไม่สามารถดึงผลการวิเคราะห์ได้');
      } else {
        const data = await res.json();
        setReport(data);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    fetchReport(false);
  }, [symbol]);

  const handleRefreshReport = () => {
    fetchReport(true);
  };

  // Render the report content (for the Report tab)
  const renderReportContent = () => {
    if (loading) {
      return (
        <Sheet sx={{ ...glassStyle, p: 4, minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <CircularProgress size="md" color="success" />
          <Typography level="body-md" sx={{ color: 'text.secondary' }}>กำลังโหลดผลการวิเคราะห์ของ {symbol}...</Typography>
        </Sheet>
      );
    }

    if (error) {
      return (
        <Sheet sx={{ ...glassStyle, p: 4, minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <AlertTriangle size={48} color="#e11d48" />
          <Typography level="h4">เกิดข้อผิดพลาดในการดึงข้อมูล</Typography>
          <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>{error}</Typography>
          <Button variant="solid" color="primary" loading={refreshing} onClick={handleRefreshReport}>ลองใหม่อีกครั้ง</Button>
        </Sheet>
      );
    }

    let initialDebate = null;
    if (report?.debate) {
      initialDebate = report.debate;
    } else if (report?.framework_results) {
      try {
        const parsed = typeof report.framework_results === 'string' ? JSON.parse(report.framework_results) : report.framework_results;
        initialDebate = parsed?.debate || null;
      } catch {
        initialDebate = null;
      }
    }

    const handleDebateUpdated = (updatedDebate: any) => {
      setReport((prev: any) => {
        if (!prev) {
          return {
            symbol,
            summary: '',
            conviction_level: updatedDebate?.synthesis?.conviction_label || 'Medium',
            debate: updatedDebate,
            framework_results: JSON.stringify({ debate: updatedDebate })
          };
        }
        let fw = {};
        try {
          fw = typeof prev.framework_results === 'string' ? JSON.parse(prev.framework_results) : (prev.framework_results || {});
        } catch {}
        return {
          ...prev,
          debate: updatedDebate,
          framework_results: JSON.stringify({ ...fw, debate: updatedDebate })
        };
      });
    };

    if (!report || !report.summary || report.summary.trim() === '') {
      return (
        <Box>
          <DebateCard
            symbol={symbol}
            initialDebate={initialDebate}
            onDebateUpdated={handleDebateUpdated}
          />
          <Sheet sx={{ ...glassStyle, p: 4, minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textAlign: 'center' }}>
            <Typography level="h3">ยังไม่มีรายงานการวิเคราะห์เชิงลึกของ {symbol}</Typography>
            <Typography level="body-md" sx={{ color: 'text.secondary', mb: 2, maxWidth: '640px' }}>
              คัดลอก Gemini Prompt หรือดาวน์โหลด Portable Skill (6 Gurus: 7 Powers, Howard Marks, Charlie Munger, Warren Buffett, Peter Lynch, Joel Greenblatt) เพื่อสั่งวิเคราะห์ใน Google Gemini App / Spark แล้วบันทึกกลับเข้า Oaktree ผ่าน MCP (<code>save_value_investing_report</code>)
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
              <Button
                size="lg"
                variant="solid"
                color="primary"
                startDecorator={<Sparkles size={18} />}
                onClick={() => setSkillModalOpen(true)}
                sx={{ borderRadius: '12px', fontWeight: 700 }}
              >
                Skill & Gemini Prompt
              </Button>
              <Button
                size="lg"
                variant="soft"
                color="neutral"
                startDecorator={<RotateCw size={18} />}
                loading={refreshing}
                onClick={handleRefreshReport}
                sx={{ borderRadius: '12px', fontWeight: 700 }}
              >
                ซิงค์ข้อมูลล่าสุด
              </Button>
            </Stack>
          </Sheet>
        </Box>
      );
    }

    const convictionColor = report.conviction_level === 'High' ? '#10b981' : report.conviction_level === 'Medium' ? '#eab308' : '#ef4444';

    return (
      <Box>
        <DebateCard
          symbol={symbol}
          initialDebate={initialDebate}
          onDebateUpdated={handleDebateUpdated}
        />

        <Sheet sx={{ ...glassStyle, p: 4 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
            <Box>
              <Typography level="h1" sx={{ fontSize: '2rem', fontWeight: 900 }}>
                🌳 {symbol} Deep Value Analysis
              </Typography>
              <Typography level="body-xs" sx={{ opacity: 0.5, mt: 0.5 }}>
                วิเคราะห์ล่าสุดเมื่อ: {report.updated_at || report.created_at}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Box sx={{ px: 2, py: 1, borderRadius: '8px', border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography level="body-sm" sx={{ opacity: 0.7 }}>ระดับความเชื่อมั่น:</Typography>
                <Typography level="title-sm" sx={{ color: convictionColor, fontWeight: 800 }}>{report.conviction_level}</Typography>
              </Box>
              <Button
                size="sm"
                variant="outlined"
                color="primary"
                startDecorator={<Sparkles size={14} />}
                onClick={() => setSkillModalOpen(true)}
                sx={{ borderRadius: '8px', fontWeight: 700 }}
              >
                Skill & Gemini Prompt
              </Button>
              <Button
                size="sm"
                variant="soft"
                color="neutral"
                startDecorator={<RotateCw size={14} />}
                loading={refreshing}
                onClick={handleRefreshReport}
                sx={{ borderRadius: '8px', fontWeight: 700 }}
              >
                ซิงค์ข้อมูลล่าสุด
              </Button>
            </Stack>
          </Stack>
          <Divider sx={{ mb: 4, opacity: 0.1 }} />
          <Box className="markdown-body">
            <MarkdownRenderer text={report.summary} />
          </Box>
        </Sheet>
      </Box>
    );
  };

  return (
    <Box>
      {/* Header Bar: Tabs (Left) & Stock Selector Dropdown (Right) */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        {/* Tool Tabs */}
        <Tabs
          value={activeToolTab}
          onChange={(_, val) => {
            navigate({
              to: '/analysis',
              search: { symbol, tab: TAB_KEYS[val as number] || 'dossier' },
            });
          }}
          sx={{ bgcolor: 'transparent' }}
        >
          <TabList
            variant="soft"
            size="sm"
            sx={{
              p: 0.5,
              borderRadius: '14px',
              bgcolor: 'background.level1',
              border: '1px solid',
              borderColor: 'neutral.outlinedBorder',
              width: 'fit-content',
              '& .MuiTab-root': {
                fontWeight: 700,
                fontSize: '0.8rem',
                px: 2.5,
                py: 1,
                borderRadius: '10px',
                minHeight: '36px',
                color: 'text.secondary',
                bgcolor: 'transparent',
                gap: 1,
                transition: 'all 0.2s ease',
                '&.Mui-selected': {
                  color: 'primary.plainColor',
                  bgcolor: 'background.surface',
                  boxShadow: 'sm',
                },
              },
            }}
          >
            <Tab disableIndicator>
              <LayoutDashboard size={15} />
              Cockpit
            </Tab>
            <Tab disableIndicator>
              <BarChart3 size={15} />
              Overview
            </Tab>
            <Tab disableIndicator>
              <FileText size={15} />
              Report
            </Tab>
            <Tab disableIndicator>
              <Calculator size={15} />
              DCF Model
            </Tab>
            <Tab disableIndicator>
              <BookOpen size={15} />
              Stock Thesis
            </Tab>
          </TabList>
        </Tabs>

        {/* Global Stock Symbol Dropdown (Right-aligned) */}
        <Select
          size="sm"
          value={symbol}
          onChange={(_, val) => {
            if (val && val !== symbol) {
              const currentTabName: (typeof TAB_KEYS)[number] =
                TAB_KEYS.find((k) => k === subTab) || TAB_KEYS[activeToolTab] || 'dossier';
              navigate({
                to: '/analysis',
                search: { symbol: val, tab: currentTabName },
              });
            }
          }}
          startDecorator={<TrendingUp size={15} color="#60a5fa" />}
          sx={{
            minWidth: 130,
            fontWeight: 700,
            fontSize: '0.85rem',
            bgcolor: 'background.level1',
            borderColor: 'neutral.outlinedBorder',
            color: 'text.primary',
            borderRadius: '12px',
            px: 1.5,
            py: 0.8,
            boxShadow: 'sm',
            '&:hover': {
              bgcolor: 'background.level2',
              borderColor: 'primary.outlinedBorder',
            },
            '& .MuiSelect-indicator': {
              color: 'primary.300',
            },
          }}
        >
          {symbolsList.map((s) => (
            <Option key={s} value={s} sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              {s}
            </Option>
          ))}
        </Select>
      </Stack>

      {/* Tab Content */}
      {activeToolTab === 0 && (
        <StockDossierCockpit
          key={symbol}
          symbol={symbol}
          initialReport={report}
          onNavigateTab={(tab) => {
            navigate({
              to: '/analysis',
              search: { symbol, tab },
            });
          }}
        />
      )}
      {activeToolTab === 1 && <StockOverview symbol={symbol} />}
      {activeToolTab === 2 && renderReportContent()}
      {activeToolTab === 3 && <DCFModel symbol={symbol} />}
      {activeToolTab === 4 && <StockThesis symbol={symbol} />}

      <ValueInvestingSkillModal
        open={skillModalOpen}
        onClose={() => setSkillModalOpen(false)}
        symbol={symbol}
      />
    </Box>
  );
}
