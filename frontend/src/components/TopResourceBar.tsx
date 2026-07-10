import React, { useEffect, useRef, useState, useContext } from 'react';
import {
  Box,
  Typography,
  Stack,
  IconButton,
  Tooltip,
  Sheet,
  Button,
  Dropdown,
  Menu as JoyMenu,
  MenuButton,
  MenuItem,
} from '@mui/joy';
import { Menu, Bell, Sun, Moon, Gamepad2, Monitor, LogOut, User } from 'lucide-react';
import { useColorScheme } from '@mui/joy/styles';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { API_BASE_URL } from '../config';
import { glassStyle } from '../styles/glass';
import { dotaColors, dotaStoneStyle } from '../styles/dotaTheme';
import { AuthContext } from './AuthContext';
import OaktreeIcon from './OaktreeIcon';

interface TopResourceBarProps {
  activeHero: string;
  onOpenMobileMenu?: () => void;
  gameMode: boolean;
  onToggleGameMode: () => void;
}

/** Check if US stock market is currently open (Mon-Fri 9:30 AM – 4:00 PM ET). */
function isMarketOpen(): boolean {
  const now = new Date();
  // Convert to ET
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const hours = et.getHours();
  const mins = et.getMinutes();
  const totalMins = hours * 60 + mins;
  return totalMins >= 570 && totalMins < 960; // 9:30 = 570, 16:00 = 960
}

export default function TopResourceBar({
  activeHero,
  onOpenMobileMenu,
  gameMode,
  onToggleGameMode,
}: TopResourceBarProps) {
  const { t } = useTranslation();
  const { user, logout } = useContext(AuthContext);
  const { mode, setMode } = useColorScheme();
  const [mounted, setMounted] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  // ── Notifications (reused from Header.tsx) ──────────────────────────
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
      console.error('Failed to fetch notifications', e);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
      }
    } catch (e) {
      console.error('Failed to mark notification as read', e);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      }
    } catch (e) {
      console.error('Failed to mark all notifications as read', e);
    }
  };

  const unreadCount = notifications.filter((n) => n.is_read === 0).length;

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
    } catch {
      return String(timeVal);
    }
  };

  // ── Market status ───────────────────────────────────────────────────
  const [marketOpen, setMarketOpen] = useState(isMarketOpen());

  // ── Effects ─────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Refresh market status every minute
  useEffect(() => {
    const interval = setInterval(() => setMarketOpen(isMarketOpen()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Close notification panel on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellContainerRef.current && !bellContainerRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  // Notification panel entrance animation
  useEffect(() => {
    if (showNotifications && notificationsRef.current) {
      gsap.fromTo(
        notificationsRef.current,
        { opacity: 0, y: -15, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'back.out(1.2)' },
      );
    }
  }, [showNotifications]);

  // Bar entrance animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(barRef.current, {
        y: -56,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
      });

      // Subtle logo float
      gsap.to(logoRef.current, {
        y: -2,
        duration: 2.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      // Status dot pulse
      gsap.to('.dota-status-dot', {
        scale: 1.6,
        opacity: 0.3,
        duration: 1.5,
        repeat: -1,
        ease: 'sine.inOut',
      });
    }, barRef);

    return () => ctx.revert();
  }, []);

  // ── Shared icon-button styling ──────────────────────────────────────
  const iconBtnSx = {
    borderRadius: '6px',
    color: dotaColors.goldMuted,
    '&:hover': {
      bgcolor: 'rgba(255, 215, 0, 0.08)',
      color: dotaColors.gold,
      transform: 'scale(1.1)',
    },
    transition: 'all 0.2s',
  };

  return (
    <Box
      ref={barRef}
      sx={{
        ...dotaStoneStyle,
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: { xs: 1.5, md: 3 },
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: `2px solid ${dotaColors.borderGold}`,
        borderRadius: 0,
        position: 'relative',
        zIndex: 1200,
        boxShadow: `0 2px 12px rgba(0,0,0,0.5), 0 1px 0 ${dotaColors.goldGlow}`,
        // Stone noise overlay
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.01) 2px, rgba(255,255,255,0.01) 4px)',
          pointerEvents: 'none',
        },
      }}
    >
      {/* ─── Left Section ────────────────────────────────────── */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
        {/* Mobile menu button */}
        {onOpenMobileMenu && (
          <Tooltip title={t('header.menu')} placement="bottom">
            <IconButton
              variant="plain"
              onClick={onOpenMobileMenu}
              sx={{
                ...iconBtnSx,
                display: { xs: 'flex', md: 'none' },
              }}
            >
              <Menu size={20} />
            </IconButton>
          </Tooltip>
        )}

        {/* Logo */}
        <Box
          ref={logoRef}
          sx={{
            background: `linear-gradient(135deg, ${dotaColors.goldDark} 0%, ${dotaColors.gold} 50%, ${dotaColors.goldDark} 100%)`,
            p: 0.75,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 12px ${dotaColors.goldGlow}`,
          }}
        >
          <OaktreeIcon color="#1a1a2e" size={22} />
        </Box>

        {/* Title */}
        <Typography
          sx={{
            fontFamily: '"Cinzel", serif',
            fontSize: { xs: '0.85rem', md: '1rem' },
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: dotaColors.gold,
            textShadow: `0 0 8px ${dotaColors.goldGlow}`,
            display: { xs: 'none', sm: 'block' },
            userSelect: 'none',
          }}
        >
          OAKTREE
        </Typography>

        {/* Status indicator */}
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ display: { xs: 'none', md: 'flex' }, ml: 1 }}
        >
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box
              className="dota-status-dot"
              sx={{
                position: 'absolute',
                width: 8,
                height: 8,
                bgcolor: dotaColors.active,
                borderRadius: '50%',
              }}
            />
            <Box
              sx={{
                width: 6,
                height: 6,
                bgcolor: dotaColors.active,
                borderRadius: '50%',
                zIndex: 1,
                boxShadow: `0 0 6px ${dotaColors.active}`,
              }}
            />
          </Box>
          <Typography
            level="body-xs"
            sx={{
              fontWeight: 700,
              color: dotaColors.active,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontSize: '0.6rem',
            }}
          >
            {t('header.intelligence_active')}
          </Typography>
        </Stack>
      </Stack>

      {/* ─── Center Section: Market Status ─────────────────── */}
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 0.5,
          borderRadius: '4px',
          border: `1px solid ${marketOpen ? 'rgba(16,185,129,0.3)' : 'rgba(139,115,85,0.3)'}`,
          bgcolor: marketOpen ? 'rgba(16,185,129,0.06)' : 'rgba(139,115,85,0.06)',
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: marketOpen ? dotaColors.active : dotaColors.textMuted,
            boxShadow: marketOpen ? `0 0 6px ${dotaColors.active}` : 'none',
          }}
        />
        <Typography
          level="body-xs"
          sx={{
            fontWeight: 700,
            fontSize: '0.65rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: marketOpen ? dotaColors.active : dotaColors.textMuted,
          }}
        >
          {marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
        </Typography>
      </Box>

      {/* ─── Right Section ───────────────────────────────────── */}
      <Stack direction="row" spacing={0.5} alignItems="center">
        {/* Game / Classic mode toggle */}
        <Tooltip title={gameMode ? 'Classic Mode' : 'Game Mode'} placement="bottom">
          <IconButton variant="plain" onClick={onToggleGameMode} sx={iconBtnSx}>
            {gameMode ? <Monitor size={18} /> : <Gamepad2 size={18} />}
          </IconButton>
        </Tooltip>

        {/* Theme toggle */}
        <Tooltip
          title={mounted && mode === 'dark' ? t('header.light_mode') : t('header.dark_mode')}
          placement="bottom"
        >
          <IconButton
            variant="plain"
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
            sx={iconBtnSx}
          >
            {mounted && mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </IconButton>
        </Tooltip>

        {/* Notifications */}
        <Box ref={bellContainerRef} sx={{ position: 'relative' }}>
          <Tooltip title={t('header.notifications')} placement="bottom">
            <IconButton
              variant="plain"
              onClick={() => setShowNotifications(!showNotifications)}
              sx={{
                ...iconBtnSx,
                bgcolor: showNotifications ? 'rgba(255,215,0,0.08)' : 'transparent',
                position: 'relative',
              }}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    minWidth: 14,
                    height: 14,
                    bgcolor: dotaColors.danger,
                    borderRadius: '7px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 6px ${dotaColors.danger}`,
                    px: 0.4,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.55rem',
                      fontWeight: 800,
                      color: '#fff',
                      lineHeight: 1,
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Typography>
                </Box>
              )}
            </IconButton>
          </Tooltip>

          {/* Notifications dropdown */}
          {showNotifications && (
            <Sheet
              ref={notificationsRef}
              sx={{
                ...glassStyle,
                position: 'absolute',
                top: '100%',
                right: 0,
                mt: 1,
                width: 340,
                maxHeight: 420,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '8px',
                boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px ${dotaColors.borderGold}`,
                border: `1px solid ${dotaColors.borderGold}`,
                bgcolor: dotaColors.hudBg,
                zIndex: 1300,
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  p: 1.5,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: `1px solid ${dotaColors.borderDark}`,
                }}
              >
                <Typography
                  level="title-sm"
                  sx={{ fontWeight: 700, color: dotaColors.goldMuted }}
                >
                  {t('header.notifications')}
                </Typography>
                {unreadCount > 0 && (
                  <Button
                    size="sm"
                    variant="plain"
                    onClick={handleMarkAllAsRead}
                    sx={{
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      p: 0.5,
                      minHeight: 0,
                      color: dotaColors.goldMuted,
                      '&:hover': { color: dotaColors.gold },
                    }}
                  >
                    {t('header.mark_all_read')}
                  </Button>
                )}
              </Box>

              {/* List */}
              <Box
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  p: 0.75,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.25,
                }}
              >
                {notifications.length === 0 ? (
                  <Box
                    sx={{
                      py: 5,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Bell size={28} style={{ opacity: 0.2, color: dotaColors.textMuted }} />
                    <Typography level="body-xs" sx={{ color: dotaColors.textMuted }}>
                      {t('header.no_notifications')}
                    </Typography>
                  </Box>
                ) : (
                  notifications.map((n) => (
                    <Box
                      key={n.id}
                      onClick={() => handleMarkAsRead(n.id)}
                      sx={{
                        p: 1.25,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        bgcolor: n.is_read ? 'transparent' : 'rgba(255, 215, 0, 0.03)',
                        borderLeft: '3px solid',
                        borderLeftColor: n.is_read ? 'transparent' : dotaColors.goldMuted,
                        '&:hover': {
                          bgcolor: 'rgba(255,215,0,0.06)',
                          transform: 'translateX(2px)',
                        },
                      }}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="flex-start">
                        <Box
                          sx={{
                            width: 26,
                            height: 26,
                            bgcolor: n.is_read
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(255, 215, 0, 0.1)',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            mt: 0.25,
                          }}
                        >
                          <Typography
                            level="body-xs"
                            sx={{
                              fontWeight: 800,
                              fontSize: '0.6rem',
                              color: n.is_read ? dotaColors.textMuted : dotaColors.gold,
                            }}
                          >
                            {n.symbol}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            level="body-xs"
                            sx={{
                              color: dotaColors.textLight,
                              fontWeight: n.is_read ? 400 : 600,
                              lineHeight: 1.3,
                            }}
                          >
                            {n.message}
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{ color: dotaColors.textDim, mt: 0.25, fontSize: '0.6rem' }}
                          >
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

        {/* Divider */}
        <Box
          sx={{
            display: { xs: 'none', sm: 'block' },
            width: '1px',
            height: 24,
            bgcolor: dotaColors.borderDark,
            mx: 0.5,
          }}
        />

        {/* User avatar & menu */}
        <Dropdown>
          <MenuButton
            variant="plain"
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: { xs: 0.5, sm: 1.5 },
              py: 0.5,
              gap: { xs: 0, sm: 1.5 },
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: `1px solid ${dotaColors.borderDark}`,
              borderRadius: '6px',
              '&:hover': {
                borderColor: dotaColors.borderGold,
                bgcolor: 'rgba(255,215,0,0.04)',
              },
            }}
          >
            {user?.picture ? (
              <Box
                component="img"
                src={user.picture}
                alt={user.name}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '4px',
                  border: `1px solid ${dotaColors.borderGold}`,
                  display: 'block',
                }}
              />
            ) : (
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  bgcolor: 'rgba(255,215,0,0.1)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${dotaColors.borderGold}`,
                }}
              >
                <User size={14} color={dotaColors.goldMuted} />
              </Box>
            )}
            <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'left' }}>
              <Typography
                level="body-xs"
                sx={{ fontWeight: 700, color: dotaColors.textLight, fontSize: '0.7rem' }}
              >
                {user?.name || t('header.operator')}
              </Typography>
              <Typography
                level="body-xs"
                sx={{ color: dotaColors.textDim, fontSize: '0.6rem' }}
              >
                {user?.email || t('header.pro_account')}
              </Typography>
            </Box>
          </MenuButton>
          <JoyMenu
            placement="bottom-end"
            sx={{
              bgcolor: dotaColors.hudBg,
              mt: 0.5,
              minWidth: 150,
              boxShadow: `0 8px 24px rgba(0,0,0,0.6), 0 0 0 1px ${dotaColors.borderGold}`,
              border: `1px solid ${dotaColors.borderGold}`,
              zIndex: 1300,
              p: 0.75,
              borderRadius: '6px',
            }}
          >
            <MenuItem
              onClick={() => {
                logout();
              }}
              sx={{
                borderRadius: '4px',
                color: dotaColors.danger,
                fontWeight: 600,
                gap: 1.5,
                py: 0.75,
                fontSize: '0.8rem',
                '&:hover': {
                  bgcolor: 'rgba(244, 63, 94, 0.1)',
                },
              }}
            >
              <LogOut size={14} />
              {t('header.sign_out')}
            </MenuItem>
          </JoyMenu>
        </Dropdown>
      </Stack>
    </Box>
  );
}
