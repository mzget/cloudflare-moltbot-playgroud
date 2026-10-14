import * as React from 'react';
import {
  Box,
  Sheet,
  Typography,
  Stack,
  Grid,
  Chip,
  Button,
  Divider,
  LinearProgress,
  IconButton,
  Alert
} from '@mui/joy';
import {
  Scale,
  TrendingUp,
  AlertTriangle,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Target,
  CheckCircle2,
  ShieldAlert,
  Zap
} from 'lucide-react';
import { glassStyle } from '../../../styles/glass';
import { API_BASE_URL } from '../../../config';

export interface KeyTension {
  topic: string;
  bull_argument: string;
  bear_argument: string;
  decisive_factor: string;
}

export interface DialecticalDebateData {
  symbol: string;
  round1: {
    bull: {
      bull_thesis: string;
      growth_catalysts: string[];
      competitive_advantages: string[];
      valuation_upside: string;
    };
    bear: {
      bear_thesis: string;
      downside_risks: string[];
      structural_headwinds: string[];
      valuation_stretch: string;
    };
  };
  round2_rebuttal: {
    bull_rebuttal: {
      rebuttal_arguments: string[];
      mitigating_factors: string[];
    };
    bear_rebuttal: {
      rebuttal_arguments: string[];
      skeptical_counters: string[];
    };
  };
  synthesis: {
    key_tensions: KeyTension[];
    consensus_points: string[];
    conviction_score: number;
    conviction_label: string;
    verdict_summary: string;
  };
  model_used?: string;
  created_at?: string;
}

interface DebateCardProps {
  symbol: string;
  initialDebate?: DialecticalDebateData | null;
  onDebateUpdated?: (updated: DialecticalDebateData) => void;
}

export default function DebateCard({ symbol, initialDebate, onDebateUpdated }: DebateCardProps) {
  const [debate, setDebate] = React.useState<DialecticalDebateData | null>(initialDebate ?? null);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [showRebuttal, setShowRebuttal] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (initialDebate) {
      setDebate(initialDebate);
      return;
    }

    let isMounted = true;
    const fetchDebate = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/analysis/debate?symbol=${symbol}`);
        if (res.ok) {
          const data = (await res.json()) as DialecticalDebateData;
          if (isMounted) setDebate(data);
        } else if (res.status !== 404) {
          const errData = (await res.json().catch(() => ({}))) as any;
          if (isMounted) setError(errData.error || 'ไม่สามารถดึงข้อมูล Debate ได้');
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDebate();
    return () => {
      isMounted = false;
    };
  }, [symbol, initialDebate]);

  const handleRefreshDebate = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis/debate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as any;
        throw new Error(errData.error || 'การรัน Debate ล้มเหลว');
      }
      const data = (await res.json()) as DialecticalDebateData;
      setDebate(data);
      if (onDebateUpdated) onDebateUpdated(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Sheet sx={{ ...glassStyle, p: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Scale size={20} className="animate-spin text-primary" />
          <Typography level="body-sm" sx={{ opacity: 0.8 }}>
            กำลังโหลดข้อมูล Bull vs. Bear Dialectical Debate...
          </Typography>
        </Stack>
      </Sheet>
    );
  }

  if (!debate) {
    return (
      <Sheet
        sx={{
          ...glassStyle,
          p: 3,
          mb: 3,
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed var(--joy-palette-neutral-outlinedBorder)'
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography level="title-md" startDecorator={<Scale size={18} />}>
              🐂 vs 🐻 Bull vs. Bear Dialectical Debate
            </Typography>
            <Typography level="body-xs" sx={{ opacity: 0.6, mt: 0.5 }}>
              ยังไม่มีข้อมูลการโต้วาทีสองขั้วสำหรับหุ้น {symbol} สามารถกดปุ่มเพื่อเริ่มประมวลผลทันที
            </Typography>
          </Box>
          <Button
            size="sm"
            variant="solid"
            color="primary"
            startDecorator={<RotateCw size={14} />}
            loading={refreshing}
            onClick={handleRefreshDebate}
          >
            รัน Bull vs Bear Debate
          </Button>
        </Stack>
        {error && (
          <Alert color="danger" size="sm" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Sheet>
    );
  }

  const score = debate.synthesis.conviction_score;
  const normalizedScorePct = Math.round(((score + 10) / 20) * 100);

  const getConvictionColor = (val: number): 'success' | 'warning' | 'danger' | 'neutral' => {
    if (val >= 2) return 'success';
    if (val <= -2) return 'danger';
    return 'warning';
  };

  const convictionColor = getConvictionColor(score);

  return (
    <Sheet
      sx={{
        ...glassStyle,
        p: 3,
        mb: 3,
        border: '1px solid var(--joy-palette-neutral-outlinedBorder)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Top Header Bar */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Scale size={22} color="var(--joy-palette-primary-500)" />
            <Typography level="title-lg" sx={{ fontWeight: 800 }}>
              Dialectical Market Debate: Bull vs. Bear
            </Typography>
            <Chip size="sm" variant="soft" color={convictionColor} sx={{ fontWeight: 700 }}>
              {debate.synthesis.conviction_label} ({score > 0 ? `+${score}` : score})
            </Chip>
          </Stack>
          <Typography level="body-xs" sx={{ opacity: 0.6, mt: 0.5 }}>
            การประลองวิทยานิพนธ์ 2 ขั้วตรงข้ามตามกรอบ TradingAgents เพื่อกำจัด Confirmation Bias
          </Typography>
        </Box>

        <Stack direction="row" alignItems="center" spacing={1}>
          <Button
            size="sm"
            variant="soft"
            color="neutral"
            startDecorator={<RotateCw size={13} />}
            loading={refreshing}
            onClick={handleRefreshDebate}
            sx={{ fontWeight: 600 }}
          >
            รีเฟรชการโต้วาที
          </Button>
        </Stack>
      </Stack>

      {/* Conviction Balance Meter */}
      <Box sx={{ mb: 3, p: 2, borderRadius: '14px', bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography level="body-xs" sx={{ color: '#ef4444', fontWeight: 700 }}>
            🐻 Extreme Bear (-10)
          </Typography>
          <Typography level="body-xs" sx={{ fontWeight: 700 }}>
            ดุลยภาพความเชื่อมั่น: {score > 0 ? `+${score}` : score} / 10
          </Typography>
          <Typography level="body-xs" sx={{ color: '#10b981', fontWeight: 700 }}>
            🐂 Extreme Bull (+10)
          </Typography>
        </Stack>
        <LinearProgress
          determinate
          value={normalizedScorePct}
          color={convictionColor}
          thickness={8}
          sx={{
            borderRadius: '4px',
            bgcolor: 'rgba(255, 255, 255, 0.08)',
            '--LinearProgress-radius': '4px'
          }}
        />
      </Box>

      {error && (
        <Alert color="danger" size="sm" sx={{ mb: 2.5 }}>
          {error}
        </Alert>
      )}

      {/* Side-by-Side Dual Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Bull Column */}
        <Grid xs={12} md={6}>
          <Sheet
            sx={{
              ...glassStyle,
              p: 2.5,
              height: '100%',
              bgcolor: 'rgba(16, 185, 129, 0.04)',
              borderColor: 'rgba(16, 185, 129, 0.25)',
              borderWidth: '1px',
              borderRadius: '16px'
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <TrendingUp size={18} color="#10b981" />
              <Typography level="title-md" sx={{ color: '#10b981', fontWeight: 800 }}>
                🐂 Bullish Researcher (Upside Thesis)
              </Typography>
            </Stack>

            <Typography level="body-sm" sx={{ mb: 2, lineHeight: 1.6 }}>
              {debate.round1.bull.bull_thesis}
            </Typography>

            <Typography level="title-sm" sx={{ color: '#10b981', fontWeight: 700, mb: 1 }}>
              ⚡ ปัจจัยเร่งการเติบโต (Growth Catalysts):
            </Typography>
            <Stack spacing={1} sx={{ mb: 2 }}>
              {debate.round1.bull.growth_catalysts.map((cat, idx) => (
                <Box
                  key={idx}
                  sx={{
                    p: 1.25,
                    borderRadius: '8px',
                    bgcolor: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.15)'
                  }}
                >
                  <Typography level="body-xs" sx={{ fontWeight: 600 }}>
                    {idx + 1}. {cat}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Typography level="title-sm" sx={{ color: '#10b981', fontWeight: 700, mb: 1 }}>
              🛡️ ความได้เปรียบ & Moat:
            </Typography>
            <Stack spacing={0.75} sx={{ mb: 2 }}>
              {debate.round1.bull.competitive_advantages.map((adv, idx) => (
                <Typography key={idx} level="body-xs" sx={{ opacity: 0.9 }}>
                  • {adv}
                </Typography>
              ))}
            </Stack>

            <Box sx={{ p: 1.25, borderRadius: '8px', bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
              <Typography level="body-xs" sx={{ fontWeight: 600, color: '#10b981' }}>
                Valuation Upside:
              </Typography>
              <Typography level="body-xs" sx={{ opacity: 0.85, mt: 0.25 }}>
                {debate.round1.bull.valuation_upside}
              </Typography>
            </Box>

            {/* Bull Rebuttal in Round 2 */}
            {showRebuttal && debate.round2_rebuttal?.bull_rebuttal && (
              <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px dashed rgba(16, 185, 129, 0.2)' }}>
                <Typography level="title-sm" sx={{ color: '#10b981', fontWeight: 700, mb: 1 }}>
                  🔄 Round 2: การแก้ต่างข้อโต้แย้งจากฝั่ง Bear:
                </Typography>
                <Stack spacing={1}>
                  {debate.round2_rebuttal.bull_rebuttal.rebuttal_arguments.map((reb, idx) => (
                    <Typography key={idx} level="body-xs" sx={{ opacity: 0.9 }}>
                      • {reb}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </Sheet>
        </Grid>

        {/* Bear Column */}
        <Grid xs={12} md={6}>
          <Sheet
            sx={{
              ...glassStyle,
              p: 2.5,
              height: '100%',
              bgcolor: 'rgba(239, 68, 68, 0.04)',
              borderColor: 'rgba(239, 68, 68, 0.25)',
              borderWidth: '1px',
              borderRadius: '16px'
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <AlertTriangle size={18} color="#ef4444" />
              <Typography level="title-md" sx={{ color: '#ef4444', fontWeight: 800 }}>
                🐻 Bearish Researcher (Downside Risks)
              </Typography>
            </Stack>

            <Typography level="body-sm" sx={{ mb: 2, lineHeight: 1.6 }}>
              {debate.round1.bear.bear_thesis}
            </Typography>

            <Typography level="title-sm" sx={{ color: '#ef4444', fontWeight: 700, mb: 1 }}>
              ⚠️ ความเสี่ยงและจุดเปราะบาง (Downside Risks):
            </Typography>
            <Stack spacing={1} sx={{ mb: 2 }}>
              {debate.round1.bear.downside_risks.map((risk, idx) => (
                <Box
                  key={idx}
                  sx={{
                    p: 1.25,
                    borderRadius: '8px',
                    bgcolor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.15)'
                  }}
                >
                  <Typography level="body-xs" sx={{ fontWeight: 600 }}>
                    {idx + 1}. {risk}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Typography level="title-sm" sx={{ color: '#ef4444', fontWeight: 700, mb: 1 }}>
              🌪️ อุปสรรคเชิงโครงสร้าง (Structural Headwinds):
            </Typography>
            <Stack spacing={0.75} sx={{ mb: 2 }}>
              {debate.round1.bear.structural_headwinds.map((hw, idx) => (
                <Typography key={idx} level="body-xs" sx={{ opacity: 0.9 }}>
                  • {hw}
                </Typography>
              ))}
            </Stack>

            <Box sx={{ p: 1.25, borderRadius: '8px', bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
              <Typography level="body-xs" sx={{ fontWeight: 600, color: '#ef4444' }}>
                Valuation Stretch:
              </Typography>
              <Typography level="body-xs" sx={{ opacity: 0.85, mt: 0.25 }}>
                {debate.round1.bear.valuation_stretch}
              </Typography>
            </Box>

            {/* Bear Rebuttal in Round 2 */}
            {showRebuttal && debate.round2_rebuttal?.bear_rebuttal && (
              <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px dashed rgba(239, 68, 68, 0.2)' }}>
                <Typography level="title-sm" sx={{ color: '#ef4444', fontWeight: 700, mb: 1 }}>
                  🔄 Round 2: การโจมตีจุดโหว่ของฝั่ง Bull:
                </Typography>
                <Stack spacing={1}>
                  {debate.round2_rebuttal.bear_rebuttal.rebuttal_arguments.map((reb, idx) => (
                    <Typography key={idx} level="body-xs" sx={{ opacity: 0.9 }}>
                      • {reb}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </Sheet>
        </Grid>
      </Grid>

      {/* Toggle Rebuttal Round Button */}
      <Stack direction="row" justifyContent="center" sx={{ mb: 3 }}>
        <Button
          size="sm"
          variant="plain"
          color="neutral"
          onClick={() => setShowRebuttal(!showRebuttal)}
          endDecorator={showRebuttal ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        >
          {showRebuttal ? 'ซ่อนการซักค้าน Round 2 (Cross-Examination)' : 'แสดงการซักค้าน Round 2 (Cross-Examination Rebuttals)'}
        </Button>
      </Stack>

      <Divider sx={{ mb: 3, opacity: 0.15 }} />

      {/* Key Tensions & Arbiter Synthesis */}
      <Box sx={{ mb: 2 }}>
        <Typography level="title-md" startDecorator={<Target size={18} color="var(--joy-palette-warning-500)" />} sx={{ fontWeight: 800, mb: 1.5 }}>
          🎯 Key Tensions (จุดชี้ขาดสำคัญที่ต้องจับตา)
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {debate.synthesis.key_tensions.map((item, idx) => (
            <Grid key={idx} xs={12} md={6}>
              <Sheet
                sx={{
                  ...glassStyle,
                  p: 2,
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                <Typography level="title-sm" sx={{ fontWeight: 700, mb: 1 }}>
                  {idx + 1}. {item.topic}
                </Typography>
                <Typography level="body-xs" sx={{ color: '#10b981', mb: 0.5 }}>
                  <strong>มุมมอง Bull:</strong> {item.bull_argument}
                </Typography>
                <Typography level="body-xs" sx={{ color: '#ef4444', mb: 1 }}>
                  <strong>มุมมอง Bear:</strong> {item.bear_argument}
                </Typography>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: '8px',
                    bgcolor: 'rgba(234, 179, 8, 0.08)',
                    border: '1px solid rgba(234, 179, 8, 0.2)'
                  }}
                >
                  <Typography level="body-xs" sx={{ color: '#eab308', fontWeight: 600 }}>
                    🔍 ตัวชี้วัดตัดสิน: {item.decisive_factor}
                  </Typography>
                </Box>
              </Sheet>
            </Grid>
          ))}
        </Grid>

        {/* Consensus & Verdict */}
        <Grid container spacing={2}>
          {debate.synthesis.consensus_points && debate.synthesis.consensus_points.length > 0 && (
            <Grid xs={12} md={5}>
              <Sheet
                sx={{
                  ...glassStyle,
                  p: 2,
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  height: '100%'
                }}
              >
                <Typography
                  level="title-sm"
                  startDecorator={<CheckCircle2 size={16} color="#10b981" />}
                  sx={{ fontWeight: 700, mb: 1 }}
                >
                  จุดเห็นพ้องต้องกัน (Consensus)
                </Typography>
                <Stack spacing={0.75}>
                  {debate.synthesis.consensus_points.map((point, idx) => (
                    <Typography key={idx} level="body-xs" sx={{ opacity: 0.85 }}>
                      ✓ {point}
                    </Typography>
                  ))}
                </Stack>
              </Sheet>
            </Grid>
          )}

          <Grid xs={12} md={debate.synthesis.consensus_points?.length ? 7 : 12}>
            <Sheet
              sx={{
                ...glassStyle,
                p: 2,
                bgcolor: 'rgba(59, 130, 246, 0.04)',
                borderColor: 'rgba(59, 130, 246, 0.2)',
                borderRadius: '12px',
                borderWidth: '1px',
                height: '100%'
              }}
            >
              <Typography
                level="title-sm"
                startDecorator={<Scale size={16} color="#3b82f6" />}
                sx={{ color: '#3b82f6', fontWeight: 700, mb: 1 }}
              >
                คำตัดสินของอนุญาโตตุลาการ (Arbiter Verdict)
              </Typography>
              <Typography level="body-sm" sx={{ lineHeight: 1.6, opacity: 0.9 }}>
                {debate.synthesis.verdict_summary}
              </Typography>
            </Sheet>
          </Grid>
        </Grid>
      </Box>
    </Sheet>
  );
}
