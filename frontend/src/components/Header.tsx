import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Stack, Sheet, IconButton, Tooltip, Button } from '@mui/joy';
import { Newspaper, Bell, Settings, User, Menu, Moon, Sun } from 'lucide-react';
import { useColorScheme } from '@mui/joy/styles';
import gsap from 'gsap';
import { API_BASE_URL } from '../config';

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

  interface Notification {
    id: number;
    symbol: string;
    message: string;
    is_read: number;
    created_at: string | number;
  }

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const bellContainerRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
        );
      }
    } catch (e) {
      console.error("Failed to mark notification as read", e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      }
    } catch (e) {
      console.error("Failed to mark all notifications as read", e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellContainerRef.current && !bellContainerRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  useEffect(() => {
    if (showNotifications && notificationsRef.current) {
      gsap.fromTo(notificationsRef.current,
        { opacity: 0, y: -15, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'back.out(1.2)' }
      );
    }
  }, [showNotifications]);

  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  const formatRelativeTime = (timeVal: string | number) => {
    try {
      let date: Date;
      if (typeof timeVal === 'number') {
        date = new Date(timeVal * 1000);
      } else if (!isNaN(Number(timeVal))) {
        date = new Date(Number(timeVal) * 1000);
      } else {
        const utcStr = timeVal.replace(' ', 'T') + 'Z';
        date = new Date(utcStr);
      }
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch (e) {
      return String(timeVal);
    }
  };

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
        position: 'relative',
        zIndex: 1100,
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
          {/* Notifications Panel */}
          <Box ref={bellContainerRef} sx={{ position: 'relative' }}>
            <Tooltip title="Notifications" placement="bottom">
              <IconButton 
                variant="plain" 
                color="neutral"
                onClick={() => setShowNotifications(!showNotifications)}
                sx={{ 
                  borderRadius: '12px',
                  bgcolor: showNotifications ? 'rgba(0,0,0,0.06)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', transform: 'scale(1.05)' },
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <Box 
                    sx={{ 
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 8,
                      height: 8,
                      bgcolor: '#f43f5e',
                      borderRadius: '50%',
                      boxShadow: '0 0 0 2px var(--joy-palette-background-surface, #fff), 0 0 6px #f43f5e',
                    }} 
                  />
                )}
              </IconButton>
            </Tooltip>

            {showNotifications && (
              <Sheet
                ref={notificationsRef}
                sx={{
                  ...glassStyle,
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  mt: 1.5,
                  width: 360,
                  maxHeight: 480,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '16px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  zIndex: 1000,
                  overflow: 'hidden'
                }}
              >
                {/* Header */}
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography level="title-md" sx={{ fontWeight: 700 }}>Notifications</Typography>
                  {unreadCount > 0 && (
                    <Button 
                      size="sm" 
                      variant="plain" 
                      color="primary" 
                      onClick={handleMarkAllAsRead}
                      sx={{ fontSize: '0.75rem', fontWeight: 600, p: 0.5, minHeight: 0 }}
                    >
                      Mark all as read
                    </Button>
                  )}
                </Box>

                {/* List */}
                <Box sx={{ flex: 1, overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {notifications.length === 0 ? (
                    <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                      <Bell size={32} style={{ opacity: 0.3 }} />
                      <Typography level="body-sm" sx={{ color: 'text.tertiary', fontWeight: 500 }}>No notifications yet</Typography>
                    </Box>
                  ) : (
                    notifications.map((n) => (
                      <Box
                        key={n.id}
                        onClick={() => handleMarkAsRead(n.id)}
                        sx={{
                          p: 1.5,
                          borderRadius: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          bgcolor: n.is_read ? 'transparent' : 'rgba(16, 185, 129, 0.04)',
                          borderLeft: '4px solid',
                          borderLeftColor: n.is_read ? 'transparent' : '#10b981',
                          '&:hover': {
                            bgcolor: 'background.level1',
                            transform: 'translateX(2px)'
                          }
                        }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                          <Box sx={{ 
                            width: 28, 
                            height: 28, 
                            bgcolor: n.is_read ? 'background.level2' : 'rgba(16, 185, 129, 0.1)', 
                            borderRadius: '8px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            flexShrink: 0,
                            mt: 0.25
                          }}>
                            <Typography level="body-xs" sx={{ fontWeight: 800, color: n.is_read ? 'text.secondary' : '#10b981' }}>
                              {n.symbol}
                            </Typography>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography level="body-sm" sx={{ color: 'text.primary', fontWeight: n.is_read ? 400 : 600, lineHeight: 1.3 }}>
                              {n.message}
                            </Typography>
                            <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 0.5 }}>
                              {formatRelativeTime(n.created_at)}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    ))
                  )}
                </Box>
              </Sheet>
            )}
          </Box>
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
