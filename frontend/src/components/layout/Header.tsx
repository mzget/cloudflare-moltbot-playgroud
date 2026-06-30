import React, { useEffect, useRef, useState, useContext } from 'react';
import { Box, Typography, Stack, Sheet, IconButton, Tooltip, Button, Dropdown, Menu as JoyMenu, MenuButton, MenuItem, Divider, Input } from '@mui/joy';
import { Newspaper, Bell, Settings, User, Menu, Moon, Sun, LogOut, Check } from 'lucide-react';
import { useColorScheme } from '@mui/joy/styles';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { API_BASE_URL } from '../../config';
import { glassStyle } from '../../styles/glass';
import { AuthContext } from '../common/AuthContext';
import OaktreeIcon from '../common/OaktreeIcon';
import { useSettingsStore, type DensityMode } from '../../store/settingsStore';

interface HeaderProps {
  onOpenSidebar?: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
  sidebarHidden?: boolean;
}

export default function Header({ onOpenSidebar, onToggleSidebar, sidebarCollapsed, sidebarHidden }: HeaderProps) {
  const { t } = useTranslation();
  const { user, logout } = useContext(AuthContext);
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
  const isFirstFetchRef = useRef(true);
  const notifiedIdsRef = useRef<Set<number>>(new Set());

  const { theme, setTheme, density, setDensity, usdThbRate, setUsdThbRate } = useSettingsStore();
  const [rateInput, setRateInput] = useState(usdThbRate.toString());

  useEffect(() => {
    setRateInput(usdThbRate.toString());
  }, [usdThbRate]);

  const handleDensitySelect = (newDensity: DensityMode) => {
    setDensity(newDensity);
  };

  const handleThemeToggle = () => {
    setTheme(mode === 'dark' ? 'light' : 'dark');
  };

  const handleRateUpdate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rate = parseFloat(rateInput);
    if (!isNaN(rate) && rate > 0) {
      setUsdThbRate(rate);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/triggered-alerts`);
      if (res.ok) {
        const data: Notification[] = await res.json();
        
        if (isFirstFetchRef.current) {
          isFirstFetchRef.current = false;
          data.forEach(n => notifiedIdsRef.current.add(n.id));
        } else {
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            data.forEach(n => {
              if (n.is_read === 0 && !notifiedIdsRef.current.has(n.id)) {
                try {
                  const notification = new Notification(`Oaktree: ${n.symbol}`, {
                    body: n.message,
                    icon: '/favicon.svg',
                  });
                  notification.onclick = () => {
                    window.focus();
                    setShowNotifications(true);
                  };
                } catch (err) {
                  console.error("Failed to trigger browser notification:", err);
                }
                notifiedIdsRef.current.add(n.id);
              }
            });
          }
        }

        setNotifications(data);
      }
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/triggered-alerts`, {
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
      const res = await fetch(`${API_BASE_URL}/api/triggered-alerts`, {
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

  const handleClearRead = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/triggered-alerts`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.is_read === 0));
      }
    } catch (e) {
      console.error("Failed to clear read notifications", e);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
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
      if (diffMins < 1) return t('header.just_now');
      if (diffMins < 60) return t('header.mins_ago', { count: diffMins });
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return t('header.hours_ago', { count: diffHours });
      const diffDays = Math.floor(diffHours / 24);
      return t('header.days_ago', { count: diffDays });
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
    });
  }, []);

  // Adaptive polling: pauses when tab is hidden, slows when panel open or all read
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const getInterval = () => {
      if (showNotifications) return 5 * 60 * 1000; // 5 min � user is viewing panel
      if (unreadCount === 0) return 2 * 60 * 1000;  // 2 min � nothing unread
      return 30_000;                                  // 30 s  � has unread items
    };

    const start = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(fetchNotifications, getInterval());
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalId) clearInterval(intervalId);
        intervalId = null;
      } else {
        fetchNotifications(); // catch up immediately when tab becomes visible
        start();
      }
    };

    fetchNotifications();
    start();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showNotifications, unreadCount]);
  return (
    <Sheet
      ref={headerRef}
      sx={{
        ...glassStyle,
        mb: 4,
        px: { xs: 1.5, sm: 3, md: 4 },
        py: { xs: 1.5, md: 2.5 },
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
      <Stack direction="row" spacing={{ xs: 1.5, md: 3 }} alignItems="center">
        {onOpenSidebar && (
          <Tooltip title={t('header.menu')} placement="bottom">
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
        
        <Stack direction="row" spacing={{ xs: 1.5, md: 2.5 }} alignItems="center">
          <Tooltip 
            title={
              sidebarHidden 
                ? t('header.show_sidebar', 'Show Sidebar') 
                : (sidebarCollapsed ? t('header.expand_sidebar') : t('header.collapse_sidebar'))
            } 
            placement="bottom"
          >
            <IconButton
              variant="plain"
              color="neutral"
              onClick={onToggleSidebar}
              sx={{ 
                display: { xs: 'none', md: 'flex' },
                borderRadius: '12px',
                transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: (sidebarHidden || sidebarCollapsed) ? 'rotate(180deg)' : 'rotate(0deg)',
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
              p: { xs: 1, md: 1.5 }, 
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)',
              transform: 'perspective(1000px) rotateY(-10deg)',
            }}
          >
            <OaktreeIcon color="white" size={28} />
          </Box>
          <Box>
            <Typography 
              level="h2" 
              sx={{ 
                fontSize: { xs: '1.2rem', md: '1.5rem' },
                fontWeight: 800, 
                letterSpacing: '-0.03em',
                color: 'text.primary',
              }}
            >
              {t('app.title')}
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: { xs: 0.25, md: 0.5 } }}>
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
                {t('header.intelligence_active')}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </Stack>

      <Stack direction="row" spacing={{ xs: 1, md: 2 }} alignItems="center">
        <Box sx={{ display: 'flex', gap: { xs: 1, md: 1.5 }, alignItems: 'center' }}>
          {/* Notifications Panel */}
          <Box ref={bellContainerRef} sx={{ position: 'relative' }}>
            <Tooltip title={t('header.notifications')} placement="bottom">
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
                  background: mode === 'dark' ? 'rgba(15, 20, 28, 0.88)' : 'rgba(255, 255, 255, 0.92)',
                  border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
                  backdropFilter: 'blur(20px) saturate(190%)',
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  mt: 1.5,
                  width: { xs: 280, sm: 360 },
                  maxHeight: 480,
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '16px',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                  zIndex: 1000,
                  overflow: 'hidden'
                }}
              >
                {/* Header */}
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography level="title-md" sx={{ fontWeight: 700 }}>{t('header.notifications')}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {unreadCount > 0 && (
                      <Button 
                        size="sm" 
                        variant="plain" 
                        color="primary" 
                        onClick={handleMarkAllAsRead}
                        sx={{ fontSize: '0.75rem', fontWeight: 600, p: 0.5, minHeight: 0 }}
                      >
                        {t('header.mark_all_read')}
                      </Button>
                    )}
                    {notifications.length > unreadCount && (
                      <Button 
                        size="sm" 
                        variant="plain" 
                        color="neutral" 
                        onClick={handleClearRead}
                        sx={{ fontSize: '0.75rem', fontWeight: 600, p: 0.5, minHeight: 0 }}
                      >
                        {t('header.clear_read')}
                      </Button>
                    )}
                  </Stack>
                </Box>

                {/* List */}
                <Box sx={{ flex: 1, overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {notifications.length === 0 ? (
                    <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
                      <Bell size={32} style={{ opacity: 0.3 }} />
                      <Typography level="body-sm" sx={{ color: 'text.tertiary', fontWeight: 500 }}>{t('header.no_notifications')}</Typography>
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
          <Tooltip title={mounted && mode === 'dark' ? t('header.light_mode') : t('header.dark_mode')} placement="bottom">
            <IconButton 
              variant="plain" 
              color="neutral"
              onClick={handleThemeToggle}
              sx={{ 
                borderRadius: '12px',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', transform: 'scale(1.05)' },
                transition: 'all 0.2s'
              }}
            >
              {mounted && mode === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
            </IconButton>
          </Tooltip>
          <Dropdown>
            <Tooltip title={t('header.settings')} placement="bottom">
              <MenuButton 
                slots={{ root: IconButton }}
                slotProps={{
                  root: {
                    variant: 'plain',
                    color: 'neutral',
                    sx: {
                      display: 'inline-flex',
                      borderRadius: '12px',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.04)', transform: 'scale(1.05)' },
                      transition: 'all 0.2s'
                    }
                  }
                }}
              >
                <Settings size={22} />
              </MenuButton>
            </Tooltip>
            <JoyMenu
              placement="bottom-end"
              sx={{
                ...glassStyle,
                background: mode === 'dark' ? 'rgba(15, 20, 28, 0.88)' : 'rgba(255, 255, 255, 0.92)',
                border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
                backdropFilter: 'blur(20px) saturate(190%)',
                mt: 1,
                minWidth: 180,
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                zIndex: 1200,
                p: 1.5,
                borderRadius: '16px',
              }}
            >
              <Typography level="body-xs" sx={{ px: 1, py: 0.5, fontWeight: 700, color: 'text.tertiary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Table Density
              </Typography>
              <Divider sx={{ my: 1, opacity: 0.15 }} />
              {([ 'compact', 'cozy', 'comfort' ] as const).map((d) => (
                <MenuItem
                  key={d}
                  selected={density === d}
                  onClick={() => handleDensitySelect(d)}
                  sx={{
                    borderRadius: '10px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    textTransform: 'capitalize',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 1,
                    my: 0.25,
                    bgcolor: density === d ? 'var(--joy-palette-primary-softBg)' : 'transparent',
                    color: density === d ? 'primary.plainColor' : 'text.primary',
                    '&:hover': {
                      bgcolor: density === d ? 'var(--joy-palette-primary-softBg)' : 'background.level1',
                    }
                  }}
                >
                  {d}
                  {density === d && <Check size={16} />}
                </MenuItem>
              ))}
              <Divider sx={{ my: 1.5, opacity: 0.15 }} />
              <Typography level="body-xs" sx={{ px: 1, py: 0.5, fontWeight: 700, color: 'text.tertiary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                USD/THB Rate
              </Typography>
              <Box 
                onClick={(e) => e.stopPropagation()} 
                sx={{ px: 1, pb: 0.5, display: 'flex', gap: 1, alignItems: 'center' }}
              >
                <Input
                  size="sm"
                  type="number"
                  placeholder="36.5"
                  value={rateInput}
                  onChange={e => setRateInput(e.target.value)}
                  startDecorator={<Typography level="body-xs" sx={{ fontWeight: 700 }}>฿</Typography>}
                  sx={{ borderRadius: '8px', width: '90px' }}
                />
                <Button 
                  size="sm" 
                  variant="solid" 
                  color="primary" 
                  onClick={handleRateUpdate} 
                  sx={{ borderRadius: '8px', px: 1.5, fontWeight: 700 }}
                >
                  Save
                </Button>
              </Box>
            </JoyMenu>
          </Dropdown>
          
          <Box sx={{ display: { xs: 'none', md: 'block' }, width: '1px', height: '28px', bgcolor: 'divider', mx: 1 }} />
          
          <Dropdown>
            <MenuButton
              variant="plain"
              sx={{
                ...glassStyle,
                display: { xs: 'none', md: 'flex' },
                alignItems: 'center',
                px: { xs: 1, sm: 2 },
                py: 0.75,
                gap: { xs: 0, sm: 2 },
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: '1px solid var(--joy-palette-neutral-outlinedBorder)',
                borderRadius: '16px',
                '&:hover': {
                  bgcolor: 'background.level1',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  transform: 'translateY(-1px)'
                }
              }}
            >
              {user?.picture ? (
                <Box
                  component="img"
                  src={user.picture}
                  alt={user.name}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '10px',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    display: 'block'
                  }}
                />
              ) : (
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
              )}
              <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left' }}>
                <Typography level="body-sm" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {user?.name || t('header.operator')}
                </Typography>
                <Typography level="body-xs" sx={{ opacity: 0.5, fontWeight: 500 }}>
                  {user?.email || t('header.pro_account')}
                </Typography>
              </Box>
            </MenuButton>
            <JoyMenu
              placement="bottom-end"
              sx={{
                ...glassStyle,
                background: mode === 'dark' ? 'rgba(15, 20, 28, 0.88)' : 'rgba(255, 255, 255, 0.92)',
                border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
                backdropFilter: 'blur(20px) saturate(190%)',
                mt: 1,
                minWidth: 160,
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                zIndex: 1200,
                p: 1,
                borderRadius: '16px',
              }}
            >
              <MenuItem
                onClick={() => {
                  console.log("Sign Out MenuItem clicked in Header.tsx, calling logout from context...", logout);
                  logout();
                }}
                sx={{
                  borderRadius: '10px',
                  color: 'danger.plainColor',
                  fontWeight: 600,
                  gap: 1.5,
                  py: 1,
                  '&:hover': {
                    bgcolor: 'danger.softHoverBg',
                  }
                }}
              >
                <LogOut size={16} />
                {t('header.sign_out')}
              </MenuItem>
            </JoyMenu>
          </Dropdown>
        </Box>
      </Stack>
    </Sheet>
  );
}
