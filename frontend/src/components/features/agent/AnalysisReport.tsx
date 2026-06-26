import * as React from 'react';
import { Box, Button, Typography, Sheet, CircularProgress, Divider, Stack } from '@mui/joy';
import { ArrowLeft, RotateCw, CheckCircle, AlertTriangle, Play } from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';
import MarkdownRenderer from '../../common/MarkdownRenderer';

interface AnalysisReportProps {
  symbol: string;
  onBack?: () => void;
}

export default function AnalysisReport({ symbol, onBack }: AnalysisReportProps) {
  const [loading, setLoading] = React.useState(true);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [report, setReport] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/results?symbol=${symbol}`);
      if (res.status === 404) {
        setReport(null);
      } else if (!res.ok) {
        throw new Error('ไม่สามารถดึงข้อมูลรายงานได้');
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
        throw new Error(err.error || 'การวิเคราะห์ขัดข้อง');
      }
      const data = await res.json();
      setReport(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };



  if (loading) {
    return (
      <Sheet sx={{ ...glassStyle, p: 4, minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <CircularProgress size="md" color="success" />
        <Typography level="body-md" sx={{ color: 'text.secondary' }}>กำลังโหลดรายงานวิเคราะห์ของ {symbol}...</Typography>
      </Sheet>
    );
  }

  if (analyzing) {
    return (
      <Sheet sx={{ ...glassStyle, p: 4, minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <CircularProgress size="lg" color="success" />
        <Box sx={{ textAlign: 'center' }}>
          <Typography level="h3" sx={{ mb: 1 }}>กำลังดำเนินการวิเคราะห์เชิงลึกสไตล์ Value Investing</Typography>
          <Typography level="body-md" sx={{ color: 'text.secondary', maxWidth: '500px' }}>
            ระบบกำลังเรียก AI เพื่อประเมินหุ้น {symbol} ผ่านกรอบความคิด 6 ปรมาจารย์ (Howard Marks, Hamilton Helmer, Warren Buffett, Charlie Munger, Peter Lynch, Joel Greenblatt) ทีละขั้นตอน กรุณารอสักครู่ (ประมาณ 30-45 วินาที)...
          </Typography>
        </Box>
      </Sheet>
    );
  }

  if (error) {
    return (
      <Sheet sx={{ ...glassStyle, p: 4, minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <AlertTriangle size={48} color="#e11d48" />
        <Typography level="h4">เกิดข้อผิดพลาดในการโหลดข้อมูล</Typography>
        <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>{error}</Typography>
        <Button variant="solid" color="primary" onClick={fetchReport}>ลองใหม่อีกครั้ง</Button>
      </Sheet>
    );
  }

  if (!report) {
    return (
      <Sheet sx={{ ...glassStyle, p: 4, minHeight: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textAlign: 'center' }}>
        <Typography level="h3">ยังไม่มีข้อมูลรายงานวิเคราะห์เชิงลึกของ {symbol}</Typography>
        <Typography level="body-md" sx={{ color: 'text.secondary', mb: 3, maxWidth: '600px' }}>
          หุ้นตัวนี้ยังไม่เคยได้รับการวิเคราะห์เชิงลึกตามแนวคิด Value Investing มาก่อน คุณสามารถกดปุ่มด้านล่างเพื่อเริ่มการประเมินวิเคราะห์เชิงลึกสไตล์ปรมาจารย์ทั้ง 6 ท่านได้ทันที
        </Typography>
        <Button size="lg" color="success" startDecorator={<Play size={18} />} onClick={handleRunAnalysis}>
          🌳 เริ่มรันวิเคราะห์เชิงลึก
        </Button>
      </Sheet>
    );
  }

  const convictionColor = report.conviction_level === 'High' ? '#10b981' : report.conviction_level === 'Medium' ? '#eab308' : '#ef4444';

  return (
    <Box>
      <Sheet sx={{ ...glassStyle, p: 4, mb: 4 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography level="h1" sx={{ fontSize: '2rem', fontWeight: 900 }}>
              🌳 {symbol} Deep Value Analysis
            </Typography>
            <Typography level="body-xs" sx={{ opacity: 0.5, mt: 0.5 }}>
              วิเคราะห์ล่าสุดเมื่อ: {report.created_at}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ px: 2, py: 1, borderRadius: '8px', border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography level="body-sm" sx={{ opacity: 0.7 }}>ระดับความเชื่อมั่น:</Typography>
              <Typography level="title-sm" sx={{ color: convictionColor, fontWeight: 800 }}>{report.conviction_level}</Typography>
            </Box>
            <Button size="sm" variant="soft" color="neutral" startDecorator={<RotateCw size={14} />} onClick={handleRunAnalysis}>
              รันวิเคราะห์ใหม่
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
}
