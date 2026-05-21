import * as React from 'react';
import { Box, Typography, Sheet, Stack } from '@mui/joy';
import DailyReportCard from './DailyReportCard';
import ManualTrigger from './ManualTrigger';

import { glassStyle } from '../styles/glass';
import MarketEventsTimeline from './MarketEventsTimeline';

export default function IntelligenceFeed({ reports, loading }: { reports: any[], loading: boolean }) {
  return (
    <Stack spacing={4}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ mb: 2, gap: 2 }}
      >
        <Box>
          <Typography level="h2" sx={{ fontWeight: 800, mb: 1 }}>Market Intelligence</Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            Synthesis of recent market movements and narrative shifts.
          </Typography>
        </Box>
        <ManualTrigger />
      </Stack>

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
