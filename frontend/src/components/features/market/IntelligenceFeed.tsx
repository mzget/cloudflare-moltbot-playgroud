import * as React from 'react';
import { Box, Typography, Sheet, Stack, Button, ButtonGroup, Badge } from '@mui/joy';
import DailyReportCard from './DailyReportCard';
import EmailDigestCard from './EmailDigestCard';
import { glassStyle } from '../../../styles/glass';
import MarketEventsTimeline from './MarketEventsTimeline';

export default function IntelligenceFeed({
  reports,
  digests = [],
  loading,
  onDigestRead,
  onReportRead
}: {
  reports: any[];
  digests?: any[];
  loading: boolean;
  onDigestRead?: (id: number) => void;
  onReportRead?: (id: number) => void;
}) {
  const [filter, setFilter] = React.useState<'all' | 'reports' | 'digests'>('all');

  const unreadCount = React.useMemo(() => {
    return digests.filter(d => d.is_readed !== 1).length;
  }, [digests]);

  const getReportTime = (item: any) => {
    if (item.symbol) {
      // Symbol report (created_at is a string "YYYY-MM-DD HH:MM:SS" in UTC)
      const utcStr = item.created_at ? item.created_at.replace(' ', 'T') + 'Z' : '';
      return utcStr ? new Date(utcStr).getTime() : 0;
    } else {
      // Email digest (created_at is a timestamp in seconds)
      return item.created_at ? item.created_at * 1000 : 0;
    }
  };

  // Combine and sort: unread first (newest), then read items last
  const combinedFeed = React.useMemo(() => {
    const items = [...reports, ...digests];
    return items.sort((a, b) => {
      const aRead = (a.is_readed === 1) ? 1 : 0;
      const bRead = (b.is_readed === 1) ? 1 : 0;
      if (aRead !== bRead) return aRead - bRead; // unread first
      return getReportTime(b) - getReportTime(a); // then newest first
    });
  }, [reports, digests]);

  // Filter items
  const filteredFeed = React.useMemo(() => {
    return combinedFeed.filter(item => {
      if (filter === 'reports') return !!item.symbol;
      if (filter === 'digests') return !!item.category;
      return true;
    });
  }, [combinedFeed, filter]);

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
            Synthesis of recent market movements, news signals, and email newsletter digests.
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ display: { xs: 'block', lg: 'none' } }}>
        <MarketEventsTimeline />
      </Box>

      {/* Premium Tab Filter Group */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1.5, sm: 2 }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        sx={{ mt: 1, gap: { xs: 1, sm: 0 } }}
      >
        <Typography level="h3" sx={{ fontWeight: 800 }}>Howard's Take & Analysis</Typography>
        
        <Box
          sx={{
            width: { xs: '100%', sm: 'auto' },
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            '&::-webkit-scrollbar': { display: 'none' },
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
            py: 0.5,
            px: 0.5,
            m: -0.5,
          }}
        >
          <ButtonGroup
            variant="soft"
            color="neutral"
            size="sm"
            sx={{
              p: 0.5,
              borderRadius: '12px',
              bgcolor: 'background.level1',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
              '--ButtonGroup-radius': '8px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              width: { xs: '100%', sm: 'auto' },
              minWidth: 'max-content'
            }}
          >
            <Button
              onClick={() => setFilter('all')}
              sx={{
                fontWeight: 600,
                flex: { xs: 1, sm: 'initial' },
                whiteSpace: 'nowrap',
                bgcolor: filter === 'all' ? 'background.surface' : 'transparent',
                color: filter === 'all' ? 'primary.plainColor' : 'text.secondary',
                boxShadow: filter === 'all' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                '&:hover': { bgcolor: filter === 'all' ? 'background.surface' : 'background.level2' }
              }}
            >
              All
            </Button>
            <Button
              onClick={() => setFilter('reports')}
              sx={{
                fontWeight: 600,
                flex: { xs: 1, sm: 'initial' },
                whiteSpace: 'nowrap',
                bgcolor: filter === 'reports' ? 'background.surface' : 'transparent',
                color: filter === 'reports' ? 'primary.plainColor' : 'text.secondary',
                boxShadow: filter === 'reports' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                '&:hover': { bgcolor: filter === 'reports' ? 'background.surface' : 'background.level2' }
              }}
            >
              Symbol Reports
            </Button>
            <Button
              onClick={() => setFilter('digests')}
              sx={{
                fontWeight: 600,
                flex: { xs: 1, sm: 'initial' },
                whiteSpace: 'nowrap',
                bgcolor: filter === 'digests' ? 'background.surface' : 'transparent',
                color: filter === 'digests' ? 'primary.plainColor' : 'text.secondary',
                boxShadow: filter === 'digests' ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                '&:hover': { bgcolor: filter === 'digests' ? 'background.surface' : 'background.level2' }
              }}
            >
              <Badge
                badgeContent={unreadCount}
                color="danger"
                variant="solid"
                size="sm"
                invisible={unreadCount === 0}
                sx={{
                  '& .MuiBadge-badge': {
                    right: -15,
                    top: -2,
                    boxShadow: '0 0 8px rgba(225, 29, 72, 0.5)',
                  }
                }}
              >
                Email Digests
              </Badge>
            </Button>
          </ButtonGroup>
        </Box>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <Typography sx={{ opacity: 0.6 }}>Analyzing market signals & newsletters...</Typography>
        </Box>
      ) : filteredFeed.length === 0 ? (
        <Sheet sx={{ ...glassStyle, p: 4, textAlign: 'center' }}>
          <Typography level="h4" sx={{ mb: 1 }}>Quiet on the Horizon</Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            {filter === 'reports'
              ? 'No symbol reports generated yet.'
              : filter === 'digests'
              ? 'No email digests generated yet. Make sure your Gmail is connected.'
              : 'No intelligence reports or email digests generated yet.'}
          </Typography>
        </Sheet>
      ) : (
        <Stack spacing={4}>
          {filteredFeed.map((item) => {
            if (item.symbol) {
              return <DailyReportCard key={`report-${item.id}`} report={item} onMarkAsRead={onReportRead} />;
            } else {
              return <EmailDigestCard key={`digest-${item.id}`} digest={item} onMarkAsRead={onDigestRead} />;
            }
          })}
        </Stack>
      )}
    </Stack>
  );
}
