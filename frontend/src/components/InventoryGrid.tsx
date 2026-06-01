import React from 'react';
import { Box, Typography, Tooltip, IconButton } from '@mui/joy';
import { dotaColors } from '../styles/dotaTheme';
import { Sun, Moon, Globe, RefreshCw, Calendar, Bell, Settings } from 'lucide-react';
import { useColorScheme } from '@mui/joy/styles';

interface InventoryGridProps {
  onAction?: (action: string) => void;
}

interface InventoryItem {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  hotkey: string;
  action: () => void;
}

export default function InventoryGrid({ onAction }: InventoryGridProps) {
  const { mode, setMode } = useColorScheme();

  const items: InventoryItem[] = [
    {
      id: 'theme',
      name: 'Theme Toggle',
      description: 'Switch dark/light mode',
      icon: mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />,
      hotkey: 'Z',
      action: () => setMode(mode === 'dark' ? 'light' : 'dark'),
    },
    {
      id: 'language',
      name: 'Language',
      description: 'Switch language',
      icon: <Globe size={18} />,
      hotkey: 'X',
      action: () => onAction?.('language'),
    },
    {
      id: 'refresh',
      name: 'Force Refresh',
      description: 'Refresh all data',
      icon: <RefreshCw size={18} />,
      hotkey: 'C',
      action: () => onAction?.('refresh'),
    },
    {
      id: 'events',
      name: 'Market Events',
      description: 'View upcoming events',
      icon: <Calendar size={18} />,
      hotkey: 'V',
      action: () => onAction?.('events'),
    },
    {
      id: 'notifications',
      name: 'Notifications',
      description: 'View all notifications',
      icon: <Bell size={18} />,
      hotkey: 'B',
      action: () => onAction?.('notifications'),
    },
    {
      id: 'settings',
      name: 'Settings',
      description: 'Open settings',
      icon: <Settings size={18} />,
      hotkey: 'N',
      action: () => onAction?.('settings'),
    },
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(2, 1fr)',
        gap: '3px',
        p: 0.5,
        height: '100%',
        alignContent: 'center',
      }}
    >
      {items.map((item) => (
        <Tooltip
          key={item.id}
          title={
            <Box>
              <Typography level="title-sm" sx={{ color: dotaColors.textGold, fontFamily: 'Cinzel, serif' }}>
                [{item.hotkey}] {item.name}
              </Typography>
              <Typography level="body-xs" sx={{ color: dotaColors.textMuted }}>
                {item.description}
              </Typography>
            </Box>
          }
          placement="top"
          arrow
        >
          <Box
            onClick={item.action}
            sx={{
              width: '100%',
              aspectRatio: '1',
              maxHeight: 52,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              borderRadius: '2px',
              bgcolor: 'rgba(10, 14, 20, 0.85)',
              border: `1px solid ${dotaColors.borderDark}`,
              color: dotaColors.textMuted,
              position: 'relative',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: dotaColors.borderGoldBright,
                color: dotaColors.textGold,
                boxShadow: `0 0 6px ${dotaColors.goldGlow}`,
              },
            }}
          >
            {item.icon}
            <Typography
              sx={{
                position: 'absolute',
                bottom: 1,
                right: 3,
                fontSize: '8px',
                fontWeight: 700,
                color: dotaColors.textDim,
                fontFamily: 'Cinzel, serif',
              }}
            >
              {item.hotkey}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}
