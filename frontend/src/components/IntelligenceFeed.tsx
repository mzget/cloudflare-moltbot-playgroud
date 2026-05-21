import * as React from 'react';
import { Box, Typography, Sheet, Card, CardContent, Chip, Stack } from '@mui/joy';
import { TrendingUp, TrendingDown, Minus, Quote } from 'lucide-react';

import { glassStyle } from '../styles/glass';
import MarketEventsTimeline from './MarketEventsTimeline';

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
            <Typography level="body-xs" sx={{ color: 'text.tertiary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Reported on {new Date(report.report_date).toLocaleDateString()}
            </Typography>
          </Box>
          <Quote size={40} color="var(--joy-palette-success-plainColor)" style={{ opacity: 0.15 }} />
        </Stack>

        <Typography level="body-lg" sx={{ opacity: 0.9, fontStyle: 'italic', mb: 4, lineHeight: 1.7, borderLeft: '4px solid var(--joy-palette-primary-500)', pl: 3 }}>
          {report.summary}
        </Typography>

        <Box sx={{ bgcolor: 'background.level1', borderRadius: '16px', p: 3 }}>
          <Typography level="title-md" sx={{ mb: 2, fontWeight: 700 }}>Core Takeaways</Typography>
          <Stack spacing={1.5}>
            {takeaways.map((point: string, i: number) => (
              <Stack key={i} direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ width: 6, height: 6, bgcolor: 'primary.500', borderRadius: '50%', mt: 1, boxShadow: '0 0 6px var(--joy-palette-primary-500)' }} />
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
  return (
    <Stack spacing={4}>
      <Box sx={{ mb: 2 }}>
        <Typography level="h2" sx={{ fontWeight: 800, mb: 1 }}>Market Intelligence</Typography>
        <Typography sx={{ color: 'text.secondary' }}>
          Synthesis of recent market movements and narrative shifts.
        </Typography>
      </Box>

      <Box sx={{ display: { xs: 'block', lg: 'none' } }}>
        <MarketEventsTimeline />
      </Box>

      <Typography level="h3" sx={{ fontWeight: 800, mt: 2 }}>Howard's Take & Analysis</Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <Typography sx={{ opacity: 0.6 }}>Analyzing market signals...</Typography>
        </Box>
      ) : reports.length === 0 ? (
        <Sheet sx={{ ...glassStyle, p: 4, textAlign: 'center' }}>
          <Typography level="h4" sx={{ mb: 1 }}>Quiet on the Horizon</Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            No intelligence reports generated yet. Add stocks to your watchlist or news sources to start the analysis.
          </Typography>
        </Sheet>
      ) : (
        <Stack spacing={4}>
          {reports.map((report) => (
            <DailyReportCard key={report.id} report={report} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
