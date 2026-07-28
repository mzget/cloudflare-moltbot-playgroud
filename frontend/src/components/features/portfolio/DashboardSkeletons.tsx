import React from 'react';
import { Box, Sheet, Skeleton, Stack, Grid, Table } from '@mui/joy';
import { glassStyle } from '../../../styles/glass';

/**
 * Glassmorphic Skeleton for the Summary Tab inside /dashboard
 */
export function SummaryTabSkeleton() {
  return (
    <Stack spacing={3} className="tab-pane-active">
      {/* Top Metrics Cards Grid Skeleton */}
      <Grid container spacing={2}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Grid key={index} xs={12} sm={6} md={3}>
            <Sheet
              sx={{
                ...glassStyle,
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              <Skeleton variant="text" level="body-xs" width="50%" height={16} />
              <Skeleton variant="text" level="h3" width="80%" height={32} />
              <Skeleton variant="text" level="body-xs" width="65%" height={16} />
            </Sheet>
          </Grid>
        ))}
      </Grid>

      {/* Main Charts & Overview Skeleton Grid */}
      <Grid container spacing={3}>
        <Grid xs={12} lg={8}>
          <Sheet sx={{ ...glassStyle, p: 3, minHeight: 340, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Skeleton variant="text" level="title-md" width="35%" height={24} />
              <Skeleton variant="rectangular" width={120} height={32} sx={{ borderRadius: '8px' }} />
            </Stack>
            <Skeleton variant="rectangular" height={240} sx={{ borderRadius: '16px', opacity: 0.6 }} />
          </Sheet>
        </Grid>
        <Grid xs={12} lg={4}>
          <Sheet sx={{ ...glassStyle, p: 3, minHeight: 340, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Skeleton variant="text" level="title-md" width="50%" height={24} />
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 2 }}>
              <Skeleton variant="circular" width={180} height={180} />
            </Box>
            <Stack spacing={1}>
              <Skeleton variant="text" level="body-xs" width="100%" height={16} />
              <Skeleton variant="text" level="body-xs" width="80%" height={16} />
            </Stack>
          </Sheet>
        </Grid>
      </Grid>

      {/* Custom Accounts / Breakdown Table Skeleton */}
      <Sheet sx={{ ...glassStyle, p: 3 }}>
        <Skeleton variant="text" level="title-md" width="30%" height={24} sx={{ mb: 2 }} />
        <Stack spacing={1.5}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={44} sx={{ borderRadius: '10px' }} />
          ))}
        </Stack>
      </Sheet>
    </Stack>
  );
}

/**
 * Glassmorphic Skeleton for Holdings Tab
 */
export function HoldingsTabSkeleton() {
  return (
    <Sheet sx={{ ...glassStyle, p: { xs: 2, md: 3 }, overflow: 'hidden' }} className="tab-pane-active">
      {/* Search & Actions Toolbar Skeleton */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Skeleton variant="rectangular" width={{ xs: '100%', sm: 260 }} height={40} sx={{ borderRadius: '12px' }} />
        <Stack direction="row" spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <Skeleton variant="rectangular" width={110} height={40} sx={{ borderRadius: '12px' }} />
          <Skeleton variant="rectangular" width={110} height={40} sx={{ borderRadius: '12px' }} />
        </Stack>
      </Stack>

      {/* Table Skeleton */}
      <Stack spacing={1.5}>
        <Skeleton variant="rectangular" height={40} sx={{ borderRadius: '8px', opacity: 0.8 }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: '10px' }} />
        ))}
      </Stack>
    </Sheet>
  );
}

/**
 * Glassmorphic Skeleton for Fundamentals Dashboard Tab
 */
export function FundamentalsTabSkeleton() {
  return (
    <Box className="tab-pane-active">
      {/* Header Skeleton */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
          <Skeleton variant="circular" width={28} height={28} />
          <Skeleton variant="text" level="h2" width={240} height={32} />
        </Stack>
        <Skeleton variant="text" level="body-md" width={180} height={20} sx={{ pl: 0.5 }} />
      </Box>

      {/* Table Card Skeleton */}
      <Sheet sx={{ ...glassStyle, p: { xs: 2, md: 3 }, overflow: 'hidden' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Skeleton variant="rectangular" width={180} height={36} sx={{ borderRadius: '10px' }} />
          <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: '10px' }} />
        </Stack>

        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <Skeleton variant="rectangular" height={40} sx={{ borderRadius: '8px', opacity: 0.8 }} />
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={46} sx={{ borderRadius: '10px' }} />
          ))}
        </Stack>
      </Sheet>
    </Box>
  );
}
