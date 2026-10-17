import React from 'react';
import { Box, Typography, Card, CardContent, Divider, Switch, CardActions, Avatar, Stack, IconButton, Badge, Button, Chip } from '@mui/joy';
import { Pencil, Bell, FileText, Copy, Layers } from 'lucide-react';
import type { WatchlistItem } from './hooks/useWatchlist';
import type { FundamentalStatusItem } from '../sources/FundamentalIntelligenceTab';
import { FundamentalFreshnessBadge } from '../sources/FundamentalFreshnessBadge';
import { glassStyle } from '../../../styles/glass';

interface WatchlistCardProps {
  item: WatchlistItem;
  todayEvents?: { id: string; symbol: string; event_type: string; title: string; description?: string }[];
  fundamental?: FundamentalStatusItem | null;
  onEdit: (item: WatchlistItem) => void;
  onAlertsClick: (symbol: string) => void;
  onViewAnalysis: (symbol: string) => void;
  onCopyPrompt?: (item: WatchlistItem) => void;
  onToggleActive: (symbol: string, currentStatus: number) => Promise<void>;
  onTogglePortfolio: (symbol: string, currentPortfolioStatus: number) => Promise<void>;
}

function areWatchlistCardPropsEqual(
  prevProps: WatchlistCardProps,
  nextProps: WatchlistCardProps
): boolean {
  if (
    prevProps.item === nextProps.item &&
    prevProps.todayEvents === nextProps.todayEvents &&
    prevProps.fundamental === nextProps.fundamental
  ) {
    return true;
  }

  const prevItem = prevProps.item;
  const nextItem = nextProps.item;

  if (
    prevItem.symbol !== nextItem.symbol ||
    prevItem.name !== nextItem.name ||
    prevItem.is_active !== nextItem.is_active ||
    prevItem.in_portfolio !== nextItem.in_portfolio ||
    prevItem.type !== nextItem.type ||
    prevItem.active_alerts_count !== nextItem.active_alerts_count ||
    prevItem.sector_label !== nextItem.sector_label ||
    prevItem.sector_label_color !== nextItem.sector_label_color
  ) {
    return false;
  }

  const prevFund = prevProps.fundamental;
  const nextFund = nextProps.fundamental;
  if (
    prevFund?.status !== nextFund?.status ||
    prevFund?.as_of_date !== nextFund?.as_of_date ||
    prevFund?.source_count !== nextFund?.source_count ||
    prevFund?.theme_tags?.length !== nextFund?.theme_tags?.length
  ) {
    return false;
  }

  const prevEvents = prevProps.todayEvents || [];
  const nextEvents = nextProps.todayEvents || [];

  if (prevEvents.length !== nextEvents.length) {
    return false;
  }

  for (let i = 0; i < prevEvents.length; i++) {
    if (
      prevEvents[i].id !== nextEvents[i].id ||
      prevEvents[i].event_type !== nextEvents[i].event_type
    ) {
      return false;
    }
  }

  return true;
}

export const WatchlistCard: React.FC<WatchlistCardProps> = React.memo(({
  item,
  todayEvents = [],
  fundamental,
  onEdit,
  onAlertsClick,
  onViewAnalysis,
  onCopyPrompt,
  onToggleActive,
  onTogglePortfolio,
}) => {
  return (
    <Card 
      sx={{ 
        ...glassStyle, 
        border: item.in_portfolio ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: item.in_portfolio 
          ? '0 0 12px rgba(16, 185, 129, 0.12), 0 4px 20px rgba(0,0,0,0.08)' 
          : '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'all 0.3s ease-in-out',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Top Header Row */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar 
              src={`https://images.financialmodelingprep.com/symbol/${item.symbol}.png`}
              alt={item.symbol}
              variant="outlined"
              size="md"
              sx={{ 
                bgcolor: 'background.surface',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                borderRadius: 'md',
                width: 40,
                height: 40,
                '--Avatar-size': '40px'
              }}
            >
              {item.symbol.substring(0, 2)}
            </Avatar>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography level="title-lg" sx={{ fontWeight: '700', letterSpacing: '0.5px', lineHeight: 1.2 }}>
                  {item.symbol}
                </Typography>
                <Chip
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  sx={{
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    px: 0.75,
                    py: 0.1,
                    borderRadius: '4px',
                    lineHeight: 1.2,
                  }}
                >
                  {item.type || 'stock'}
                </Chip>
                {todayEvents.length > 0 && (
                  <Chip
                    size="sm"
                    variant="soft"
                    color="warning"
                    sx={{
                      fontSize: '9px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      px: 0.75,
                      py: 0.1,
                      borderRadius: '4px',
                      lineHeight: 1.2,
                    }}
                  >
                    {todayEvents.map(e => e.event_type.toUpperCase()).join(' & ')} TODAY
                  </Chip>
                )}
              </Stack>
              <Typography
                level="body-sm"
                sx={{
                  opacity: 0.75,
                  fontWeight: 500,
                }}
              >
                {item.sector_label || item.name}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={0.5}>
            <IconButton 
              color="neutral" 
              variant="plain" 
              onClick={() => onEdit(item)}
              sx={{ 
                opacity: 0.6, 
                transition: 'opacity 0.2s', 
                '&:hover': { opacity: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'primary.plainColor' } 
              }}
            >
              <Pencil size={18} />
            </IconButton>
            <Badge
              badgeContent={item.active_alerts_count}
              invisible={!item.active_alerts_count}
              color="warning"
              size="sm"
              variant="solid"
              sx={{
                '& .MuiBadge-badge': {
                  right: 2,
                  top: 2,
                  boxShadow: '0 0 8px rgba(245, 158, 11, 0.3)',
                }
              }}
            >
              <IconButton 
                color={item.active_alerts_count ? "warning" : "neutral"} 
                variant="plain" 
                onClick={() => onAlertsClick(item.symbol)}
                sx={{ 
                  opacity: item.active_alerts_count ? 1 : 0.7,
                  transition: 'all 0.2s', 
                  '&:hover': { opacity: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'primary.plainColor' } 
                }}
              >
                <Bell 
                  size={18} 
                  className={item.active_alerts_count ? "animate-bell-ring" : ""}
                  fill={item.active_alerts_count ? "currentColor" : "none"}
                />
              </IconButton>
            </Badge>
          </Stack>
        </Stack>

        {/* Fundamental Intelligence Section */}
        <Box
          sx={{
            p: 1.25,
            my: 1,
            borderRadius: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <FundamentalFreshnessBadge
              status={fundamental?.status || 'missing'}
              asOfDate={fundamental?.as_of_date}
              size="sm"
              format="verbose"
            />
            <Stack direction="row" spacing={1} alignItems="center">
              {fundamental?.as_of_date && (
                <Typography level="body-xs" sx={{ fontFamily: 'monospace', opacity: 0.7 }}>
                  {fundamental.as_of_date}
                </Typography>
              )}
              <Chip size="sm" variant="soft" color="neutral" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                {`${fundamental?.source_count ?? 0} ${fundamental?.source_count === 1 ? 'src' : 'srcs'}`}
              </Chip>
            </Stack>
          </Stack>

          {/* Linked Themes */}
          {fundamental?.theme_tags && fundamental.theme_tags.length > 0 ? (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.25 }}>
              {fundamental.theme_tags.map((tag) => (
                <Chip
                  key={tag}
                  size="sm"
                  variant="outlined"
                  color="neutral"
                  startDecorator={<Layers size={11} />}
                  sx={{
                    fontSize: '0.68rem',
                    py: 0.2,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    '&:hover': { borderColor: 'rgba(16, 185, 129, 0.3)' },
                  }}
                >
                  {tag}
                </Chip>
              ))}
            </Stack>
          ) : (
            <Typography level="body-xs" sx={{ color: 'text.tertiary', fontSize: '0.72rem' }}>
              No linked research themes
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 1, opacity: 0.12 }} />

        {/* CardActions Zone */}
        <CardActions sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0, mt: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="sm"
              variant="outlined"
              color="neutral"
              startDecorator={<FileText size={14} />}
              onClick={() => onViewAnalysis(item.symbol)}
              sx={{ fontSize: '0.8rem', py: 0.5 }}
            >
              Analysis
            </Button>
            <Button
              size="sm"
              variant="soft"
              color="primary"
              startDecorator={<Copy size={13} />}
              onClick={() => onCopyPrompt?.(item)}
              sx={{ fontSize: '0.8rem', py: 0.5, borderRadius: '8px', fontWeight: 600 }}
            >
              Copy Prompt
            </Button>
          </Stack>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography level="body-xs" sx={{ fontWeight: '600', opacity: 0.7 }}>Active</Typography>
              <Switch 
                checked={!!item.is_active} 
                onChange={() => onToggleActive(item.symbol, item.is_active)} 
                color={item.is_active ? 'primary' : 'neutral'}
                size="sm"
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography level="body-xs" sx={{ fontWeight: '600', opacity: 0.7 }}>Portfolio</Typography>
              <Switch 
                checked={!!item.in_portfolio} 
                onChange={() => onTogglePortfolio(item.symbol, item.in_portfolio)} 
                color={item.in_portfolio ? 'primary' : 'neutral'}
                size="sm"
              />
            </Box>
          </Box>
        </CardActions>
      </CardContent>
    </Card>
  );
}, areWatchlistCardPropsEqual);
