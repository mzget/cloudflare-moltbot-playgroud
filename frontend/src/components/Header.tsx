import React from 'react';
import { Box, Typography, Stack, Sheet, IconButton } from '@mui/joy';
import { Newspaper, Bell, Settings, User, Menu } from 'lucide-react';
import ManualTrigger from './ManualTrigger';

import { glassStyle } from '../styles/glass';

interface HeaderProps {
  onOpenSidebar?: () => void;
}

export default function Header({ onOpenSidebar }: HeaderProps) {
  return (
    <Sheet
      sx={{
        ...glassStyle,
        mb: 4,
        px: 3,
        py: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        {onOpenSidebar && (
          <IconButton
            variant="soft"
            color="neutral"
            onClick={onOpenSidebar}
            sx={{ display: { xs: 'flex', md: 'none' } }}
          >
            <Menu />
          </IconButton>
        )}
        <Box sx={{ 
          background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)', 
          p: 1.5, 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(46, 204, 113, 0.3)'
        }}>
          <Newspaper color="white" size={24} />
        </Box>
        <Box>
          <Typography level="h3" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            Oaktree Agent
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 8, height: 8, bgcolor: '#2ecc71', borderRadius: '50%', boxShadow: '0 0 8px #2ecc71' }} />
            <Typography level="body-xs" sx={{ opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Intelligence Active
            </Typography>
          </Stack>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        <ManualTrigger />
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
          <IconButton variant="plain" color="neutral">
            <Bell size={20} />
          </IconButton>
          <IconButton variant="plain" color="neutral">
            <Settings size={20} />
          </IconButton>
          <Box sx={{ width: '1px', height: '24px', bgcolor: 'rgba(0,0,0,0.1)', mx: 1 }} />
          <Sheet sx={{ ...glassStyle, display: 'flex', alignItems: 'center', px: 2, py: 0.5, gap: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' } }}>
            <Box sx={{ width: 28, height: 28, bgcolor: 'rgba(46, 204, 113, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(46, 204, 113, 0.3)' }}>
              <User size={16} color="#2ecc71" />
            </Box>
            <Typography level="body-sm" sx={{ fontWeight: 500 }}>Operator</Typography>
          </Sheet>
        </Box>
      </Stack>
    </Sheet>
  );
}
