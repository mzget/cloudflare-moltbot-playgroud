import * as React from 'react';
import { Box, Button, Typography, Sheet, CircularProgress, Divider, Stack, Tabs, TabList, Tab } from '@mui/joy';
import { ArrowLeft, RotateCw, CheckCircle, AlertTriangle, Play, FileText, Calculator } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';
import MarkdownRenderer from '../../common/MarkdownRenderer';
import DCFModel from './DCFModel';

interface AnalysisReportProps {
  symbol: string;
  onBack?: () => void;
  subTab?: string;
  hospitality?: any; // Keep signature extensible if needed
}

export default function AnalysisReport({ symbol, onBack, subTab }: AnalysisReportProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [report, setReport] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const activeToolTab = subTab === 'dcf-model' ? 1 : 0;

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/results?symbol=${symbol}`);
      if (res.status === 404) {
        setReport(null);
      } else if (!res.ok) {
        throw new Error('\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e14\u0e36\u0e07\u0e1c\u0e25\u0e01\u0e32\u0e23\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e44\u0e14\u0e49');
      } else {
        const data = await res.json();
        setReport(data);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchReport();
  }, [symbol]);

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as any;
        throw new Error(err.error || '\u0e01\u0e32\u0e23\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e25\u0e49\u0e21\u0e40\u0e2b\u0e25\u0e27');
      }
      const data = await res.json();
      setReport(data);
      navigate({
        to: '/analysis',
        search: { symbol, tab: 'report' }
      }); // Switch to report tab after analysis completes
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Render the report content (for the Report tab)
  const renderReportContent = () => {
    if (loading) {
      return (
        <Sheet sx={{ ...glassStyle, p: 4, minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <CircularProgress size="md" color="success" />
          <Typography level="body-md" sx={{ color: 'text.secondary' }}>{'\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14\u0e1c\u0e25\u0e01\u0e32\u0e23\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e02\u0e2d\u0e07'} {symbol}...</Typography>
        </Sheet>
      );
    }

    if (analyzing) {
      return (
        <Sheet sx={{ ...glassStyle, p: 4, minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <CircularProgress size="lg" color="success" />
          <Box sx={{ textAlign: 'center' }}>
            <Typography level="h3" sx={{ mb: 1 }}>{'\u0e01\u0e33\u0e25\u0e31\u0e07\u0e23\u0e31\u0e19\u0e01\u0e32\u0e23\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e40\u0e0a\u0e34\u0e07\u0e25\u0e36\u0e01'} Value Investing</Typography>
            <Typography level="body-md" sx={{ color: 'text.secondary', maxWidth: '500px' }}>
              {'\u0e23\u0e30\u0e1a\u0e1a\u0e01\u0e33\u0e25\u0e31\u0e07\u0e43\u0e0a\u0e49'} AI {'\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e2b\u0e38\u0e49\u0e19'} {symbol} {'\u0e1c\u0e48\u0e32\u0e19\u0e01\u0e23\u0e2d\u0e1a\u0e04\u0e34\u0e14\u0e02\u0e2d\u0e07'} 6 {'\u0e19\u0e31\u0e01\u0e25\u0e07\u0e17\u0e38\u0e19'} (Howard Marks, Hamilton Helmer, Warren Buffett, Charlie Munger, Peter Lynch, Joel Greenblatt) {'\u0e42\u0e1b\u0e23\u0e14\u0e23\u0e2d\u0e2a\u0e31\u0e01\u0e04\u0e23\u0e39\u0e48'} ({'\u0e1b\u0e23\u0e30\u0e21\u0e32\u0e13'} 30-45 {'\u0e27\u0e34\u0e19\u0e32\u0e17\u0e35'})...
            </Typography>
          </Box>
        </Sheet>
      );
    }

    if (error) {
      return (
        <Sheet sx={{ ...glassStyle, p: 4, minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <AlertTriangle size={48} color="#e11d48" />
          <Typography level="h4">{'\u0e40\u0e01\u0e34\u0e14\u0e02\u0e49\u0e2d\u0e1c\u0e34\u0e14\u0e1e\u0e25\u0e32\u0e14\u0e43\u0e19\u0e01\u0e32\u0e23\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25'}</Typography>
          <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>{error}</Typography>
          <Button variant="solid" color="primary" onClick={fetchReport}>{'\u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48\u0e2d\u0e35\u0e01\u0e04\u0e23\u0e31\u0e49\u0e07'}</Button>
        </Sheet>
      );
    }

    if (!report) {
      return (
        <Sheet sx={{ ...glassStyle, p: 4, minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textAlign: 'center' }}>
          <Typography level="h3">{'\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e1c\u0e25\u0e01\u0e32\u0e23\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e40\u0e0a\u0e34\u0e07\u0e25\u0e36\u0e01\u0e02\u0e2d\u0e07'} {symbol}</Typography>
          <Typography level="body-md" sx={{ color: 'text.secondary', mb: 3, maxWidth: '600px' }}>
            {'\u0e04\u0e25\u0e34\u0e01\u0e1b\u0e38\u0e48\u0e21\u0e14\u0e49\u0e32\u0e19\u0e25\u0e48\u0e32\u0e07\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e40\u0e23\u0e34\u0e48\u0e21\u0e01\u0e32\u0e23\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e40\u0e0a\u0e34\u0e07\u0e25\u0e36\u0e01\u0e14\u0e49\u0e27\u0e22'} Value Investing {'\u0e41\u0e1a\u0e1a\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34'}
          </Typography>
          <Button size="lg" color="success" startDecorator={<Play size={18} />} onClick={handleRunAnalysis}>
            {'\u0e40\u0e23\u0e34\u0e48\u0e21\u0e01\u0e32\u0e23\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e40\u0e0a\u0e34\u0e07\u0e25\u0e36\u0e01'}
          </Button>
        </Sheet>
      );
    }

    const convictionColor = report.conviction_level === 'High' ? '#10b981' : report.conviction_level === 'Medium' ? '#eab308' : '#ef4444';

    return (
      <Sheet sx={{ ...glassStyle, p: 4 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography level="h1" sx={{ fontSize: '2rem', fontWeight: 900 }}>
              🌳 {symbol} Deep Value Analysis
            </Typography>
            <Typography level="body-xs" sx={{ opacity: 0.5, mt: 0.5 }}>
              {'\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e25\u0e48\u0e32\u0e2a\u0e38\u0e14\u0e40\u0e21\u0e37\u0e48\u0e2d'}: {report.created_at}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ px: 2, py: 1, borderRadius: '8px', border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography level="body-sm" sx={{ opacity: 0.7 }}>{'\u0e23\u0e30\u0e14\u0e31\u0e1a\u0e04\u0e27\u0e32\u0e21\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e31\u0e48\u0e19'}:</Typography>
              <Typography level="title-sm" sx={{ color: convictionColor, fontWeight: 800 }}>{report.conviction_level}</Typography>
            </Box>
            <Button size="sm" variant="soft" color="neutral" startDecorator={<RotateCw size={14} />} onClick={handleRunAnalysis}>
              {'\u0e23\u0e31\u0e19\u0e27\u0e34\u0e40\u0e04\u0e23\u0e32\u0e30\u0e2b\u0e4c\u0e43\u0e2b\u0e21\u0e48'}
            </Button>
          </Stack>
        </Stack>
        <Divider sx={{ mb: 4, opacity: 0.1 }} />
        <Box className="markdown-body">
          <MarkdownRenderer text={report.summary} />
        </Box>
      </Sheet>
    );
  };

  return (
    <Box>
      {/* Tool Tabs */}
      <Tabs
        value={activeToolTab}
        onChange={(_, val) => {
          navigate({
            to: '/analysis',
            search: { symbol, tab: val === 1 ? 'dcf-model' : 'report' },
          });
        }}
        sx={{ mb: 3, bgcolor: 'transparent' }}
      >
        <TabList
          variant="soft"
          size="sm"
          sx={{
            p: 0.5,
            borderRadius: '14px',
            bgcolor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
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
            <FileText size={15} />
            Report
          </Tab>
          <Tab disableIndicator>
            <Calculator size={15} />
            DCF Model
          </Tab>
        </TabList>
      </Tabs>

      {/* Tab Content */}
      {activeToolTab === 0 && renderReportContent()}
      {activeToolTab === 1 && <DCFModel symbol={symbol} />}
    </Box>
  );
}
