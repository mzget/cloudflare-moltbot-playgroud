import * as React from 'react';
import { Box, Typography, Card, CardContent, Chip, Stack, Button } from '@mui/joy';
import { TrendingUp, TrendingDown, Minus, Quote, Check } from 'lucide-react';

import { glassStyle } from '../../../styles/glass';

export function DailyReportCard({ report, onMarkAsRead }: { report: any; onMarkAsRead?: (id: number) => void }) {
  const takeaways = JSON.parse(report.key_takeaways || '[]');
  const isRead = report.is_readed === 1;

  return (
    <Card sx={{ ...glassStyle, p: 1, opacity: isRead ? 0.6 : 1, transition: 'opacity 0.3s ease' }}>
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
              {isRead && (
                <Chip variant="soft" color="neutral" size="sm" startDecorator={<Check size={12} />}>
                  Read
                </Chip>
              )}
            </Stack>
            <Typography level="body-xs" sx={{ color: 'text.tertiary', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Reported on {new Date(report.report_date).toLocaleDateString()}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {onMarkAsRead && !isRead && (
              <Button
                variant="outlined"
                color="neutral"
                size="sm"
                startDecorator={<Check size={14} />}
                onClick={() => onMarkAsRead(report.id)}
                sx={{
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'success.softBg',
                    color: 'success.softColor',
                    borderColor: 'success.softBorder',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.1)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                  }
                }}
              >
                Mark as Read
              </Button>
            )}
            <Quote size={40} color="var(--joy-palette-success-plainColor)" style={{ opacity: 0.15 }} />
          </Stack>
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

export default DailyReportCard;