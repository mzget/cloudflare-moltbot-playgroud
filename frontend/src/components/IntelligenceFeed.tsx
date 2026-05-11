import * as React from 'react';
import { Box, Typography, Sheet, Card, CardContent, Chip, Stack } from '@mui/joy';
import { TrendingUp, TrendingDown, Minus, Quote } from 'lucide-react';

import { glassStyle } from '../styles/glass';

export function DailyReportCard({ report }: { report: any }) {
  const takeaways = JSON.parse(report.key_takeaways || '[]');

  return (
    <Card sx={{ ...glassStyle, p: 1 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
          <Box>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
              <Typography level="h3" sx={{ fontWeight: 800 }}>{report.symbol}</Typography>
              <Chip
                variant="soft"
                color={report.sentiment_score > 0.3 ? 'success' : report.sentiment_score < -0.3 ? 'danger' : 'warning'}
                size="md"
                startDecorator={report.sentiment_score > 0.3 ? <TrendingUp size={16} /> : report.sentiment_score < -0.3 ? <TrendingDown size={16} /> : <Minus size={16} />}
              >
                {report.sentiment_score > 0.3 ? 'Bullish Sentiment' : report.sentiment_score < -0.3 ? 'Bearish Sentiment' : 'Neutral Stance'}
              </Chip>
            </Stack>
            <Typography level="body-xs" sx={{ opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Reported on {new Date(report.report_date).toLocaleDateString()}
            </Typography>
          </Box>
          <Quote size={40} color="rgba(46, 204, 113, 0.1)" />
        </Stack>

        <Typography level="body-lg" sx={{ opacity: 0.9, fontStyle: 'italic', mb: 4, lineHeight: 1.7, borderLeft: '4px solid #2ecc71', pl: 3 }}>
          {report.summary}
        </Typography>

        <Box sx={{ bgcolor: 'rgba(0,0,0,0.02)', borderRadius: '16px', p: 3 }}>
          <Typography level="title-md" sx={{ mb: 2, fontWeight: 700 }}>Core Takeaways</Typography>
          <Stack spacing={1.5}>
            {takeaways.map((point: string, i: number) => (
              <Stack key={i} direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ width: 6, height: 6, bgcolor: '#2ecc71', borderRadius: '50%', mt: 1, boxShadow: '0 0 6px #2ecc71' }} />
                <Typography level="body-md" sx={{ color: 'text.secondary' }}>{point}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function IntelligenceFeed({ reports, loading }: { reports: any[], loading: boolean }) {
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      <Typography sx={{ opacity: 0.6 }}>Analyzing market signals...</Typography>
    </Box>
  );

  if (reports.length === 0) return (
    <Sheet sx={{ ...glassStyle, p: 4, textAlign: 'center' }}>
      <Typography level="h3" sx={{ mb: 1 }}>Quiet on the Horizon</Typography>
      <Typography sx={{ color: 'text.secondary' }}>
        No intelligence reports generated yet. Add stocks to your watchlist or news sources to start the analysis.
      </Typography>
    </Sheet>
  );

  return (
    <Stack spacing={4}>
      <Box sx={{ mb: 2 }}>
        <Typography level="h2" sx={{ fontWeight: 800, mb: 1 }}>Market Intelligence Dashboard</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Synthesis of recent market movements and narrative shifts.
        </Typography>
      </Box>
      {reports.map((report) => (
        <DailyReportCard key={report.id} report={report} />
      ))}
    </Stack>
  );
}
