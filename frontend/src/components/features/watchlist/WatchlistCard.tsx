import React from 'react';
import { Box, Typography, Card, CardContent, Divider, Switch, CardActions, Avatar, Stack, IconButton, Badge, Button } from '@mui/joy';
import { Pencil, Bell, FileText } from 'lucide-react';
import type { WatchlistItem } from './hooks/useWatchlist';
import { glassStyle } from '../../../styles/glass';

interface WatchlistCardProps {
  item: WatchlistItem;
  onEdit: (item: WatchlistItem) => void;
  onAlertsClick: (symbol: string) => void;
  onViewAnalysis: (symbol: string) => void;
  onToggleActive: (symbol: string, currentStatus: number) => Promise<void>;
  onTogglePortfolio: (symbol: string, currentPortfolioStatus: number) => Promise<void>;
}

export const WatchlistCard: React.FC<WatchlistCardProps> = ({
  item,
  onEdit,
  onAlertsClick,
  onViewAnalysis,
  onToggleActive,
  onTogglePortfolio,
}) => {
  return (
    <Card 
      sx={{ 
        ...glassStyle, 
        border: item.in_portfolio ? '1.5px solid rgba(46, 204, 113, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: item.in_portfolio 
          ? '0 0 12px rgba(46, 204, 113, 0.15), 0 4px 20px rgba(0,0,0,0.08)' 
          : '0 2px 8px rgba(0,0,0,0.04)',
        transition: 'all 0.3s ease-in-out',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
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
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography level="title-lg" sx={{ fontWeight: '700', letterSpacing: '0.5px', lineHeight: 1.2 }}>{item.symbol}</Typography>
                <Box
                  sx={{
                    fontSize: '9px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    px: 1,
                    py: 0.25,
                    borderRadius: '4px',
                    backgroundColor: item.type === 'etf' ? 'rgba(54, 162, 235, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                    color: item.type === 'etf' ? '#36a2eb' : '#10b981',
                    border: item.type === 'etf' ? '1px solid rgba(54, 162, 235, 0.3)' : '1px solid rgba(16, 185, 129, 0.2)',
                    lineHeight: 1.2,
                  }}
                >
                  {item.type || 'stock'}
                </Box>
              </Stack>
              <Typography level="body-sm" sx={{ opacity: 0.7, fontWeight: '500' }}>{item.name}</Typography>
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
                '&:hover': { opacity: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#10b981' } 
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
                  boxShadow: '0 0 8px rgba(245, 158, 11, 0.4)',
                }
              }}
            >
              <IconButton 
                color={item.active_alerts_count ? "warning" : "neutral"} 
                variant="plain" 
                onClick={() => onAlertsClick(item.symbol)}
                sx={{ 
                  opacity: item.active_alerts_count ? 1 : 0.8,
                  transition: 'all 0.2s', 
                  '&:hover': { opacity: 1, backgroundColor: 'rgba(0,0,0,0.05)', color: '#10b981' } 
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

        <Divider sx={{ my: 1.5, opacity: 0.15 }} />

        <CardActions sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0, mt: 1.5 }}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography level="body-xs" sx={{ fontWeight: '600', opacity: 0.7 }}>Active</Typography>
              <Switch 
                checked={!!item.is_active} 
                onChange={() => onToggleActive(item.symbol, item.is_active)} 
                color={item.is_active ? 'success' : 'neutral'}
                size="sm"
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography level="body-xs" sx={{ fontWeight: '600', opacity: 0.7 }}>Portfolio</Typography>
              <Switch 
                checked={!!item.in_portfolio} 
                onChange={() => onTogglePortfolio(item.symbol, item.in_portfolio)} 
                color={item.in_portfolio ? 'success' : 'neutral'}
                size="sm"
              />
            </Box>
          </Box>
        </CardActions>
      </CardContent>
    </Card>
  );
};
