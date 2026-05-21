import React, { useEffect, useRef } from 'react';
import { Box, Typography, Stack, Sheet, IconButton, Tooltip } from '@mui/joy';
import { Newspaper, Bell, Settings, User, Menu, Moon, Sun } from 'lucide-react';
import { useColorScheme } from '@mui/joy/styles';
import gsap from 'gsap';

import { glassStyle } from '../styles/glass';

interface HeaderProps {
  onOpenSidebar?: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

export default function Header({ onOpenSidebar, onToggleSidebar, sidebarCollapsed }: HeaderProps) {
  const { mode, setMode } = useColorScheme();
  const [mounted, setMounted] = React.useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Entrance animation
      gsap.from(headerRef.current, {
        y: -40,
        opacity: 0,
        duration: 1,
        ease: 'power4.out',
      });

      // Subtle logo float
      gsap.to(logoRef.current, {
        y: -3,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      // Pulse animation for status dot
      gsap.to('.status-dot', {
        scale: 1.5,
        opacity: 0.4,
        duration: 1.5,
        repeat: -1,
        ease: 'sine.inOut',
      });
    }, headerRef);

    return () => ctx.revert();
  }, []);

  return (
    <Sheet
      ref={headerRef}
      sx={{
        ...glassStyle,
        mb: 4,
        px: 4,
        py: 2.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'all 0.3s ease-out',
        '&:hover': {
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.08)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Stack direction="row" spacing={3} alignItems="center">
        {onOpenSidebar && (
          <Tooltip title="Menu" placement="bottom">
            <IconButton
              variant="soft"
              color="neutral"
              onClick={onOpenSidebar}
              sx={{ display: { xs: 'flex', md: 'none' }, borderRadius: '12px' }}
            >
              <Menu />
            </IconButton>
          </Tooltip>
        )}
        
        <Stack direction="row" spacing={2.5} alignItems="center">
          <Tooltip title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"} placement="bottom">
            <IconButton
              variant="plain"
              color="neutral"
              onClick={onToggleSidebar}
              sx={{ 
                display: { xs: 'none', md: 'flex' },
                borderRadius: '12px',
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' }
              }}
            >
              <Menu size={20} />
            </IconButton>
          </Tooltip>

          <Box 
            ref={logoRef}
            sx={{ 
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
              p: 1.5, 
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)',
              transform: 'perspective(1000px) rotateY(-10deg)',
            }}
          >
            <Newspaper color="white" size={28} />
          </Box>
          <Box>
            <Typography 
              level="h2" 
              sx={{ 
                fontSize: '1.5rem',
                fontWeight: 800, 
                letterSpacing: '-0.03em',
                color: 'text.primary',
              }}
            >
              Oaktree Agent
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5 }}>
              <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box 
                  className="status-dot"
                  sx={{ 
                    position: 'absolute',
                    width: 10, 
                    height: 10, 
                    bgcolor: '#10b981', 
                    borderRadius: '50%',
                  }} 
                />
                <Box 
                  sx={{ 
                    width: 8, 
                    height: 8, 
                    bgcolor: '#10b981', 
                    borderRadius: '50%', 
                    zIndex: 1,
                    boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
                  }} 
                />
              </Box>
              <Typography 
                level="body-xs" 
                sx={{ 
                  fontWeight: 600,
                  color: '#059669',
                  textTransform: 'uppercase', 
                  letterSpacing: '0.15em',
                  opacity: 0.8
                }}
              >
                Intelligence Active
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1.5, alignItems: 'center' }}>
          <Tooltip title="Notifications" placement="bottom">
            <IconButton 
              variant="plain" 
              color="neutral"
              sx={{ 
                borderRadius: '12px',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', transform: 'scale(1.05)' },
                transition: 'all 0.2s'
              }}
            >
              <Bell size={22} />
            </IconButton>
          </Tooltip>
          <Tooltip title={mounted && mode === 'dark' ? "Light Mode" : "Dark Mode"} placement="bottom">
            <IconButton 
              variant="plain" 
              color="neutral"
              onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              sx={{ 
                borderRadius: '12px',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', transform: 'scale(1.05)' },
                transition: 'all 0.2s'
              }}
            >
              {mounted && mode === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings" placement="bottom">
            <IconButton 
              variant="plain" 
              color="neutral"
              sx={{ 
                borderRadius: '12px',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', transform: 'scale(1.05)' },
                transition: 'all 0.2s'
              }}
            >
              <Settings size={22} />
            </IconButton>
          </Tooltip>
          
          <Box sx={{ width: '1px', height: '28px', bgcolor: 'divider', mx: 1 }} />
          
          <Sheet 
            sx={{ 
              ...glassStyle, 
              display: 'flex', 
              alignItems: 'center', 
              px: 2, 
              py: 0.75, 
              gap: 2, 
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': { 
                bgcolor: 'background.level1',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                transform: 'translateY(-1px)'
              } 
            }}
          >
            <Box sx={{ 
              width: 32, 
              height: 32, 
              bgcolor: 'rgba(16, 185, 129, 0.1)', 
              borderRadius: '10px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              border: '1px solid rgba(16, 185, 129, 0.2)' 
            }}>
              <User size={18} color="#10b981" />
            </Box>
            <Box>
              <Typography level="body-sm" sx={{ fontWeight: 700, color: 'text.primary' }}>Operator</Typography>
              <Typography level="body-xs" sx={{ opacity: 0.5, fontWeight: 500 }}>Pro Account</Typography>
            </Box>
          </Sheet>
        </Box>
      </Stack>
    </Sheet>
  );
}
