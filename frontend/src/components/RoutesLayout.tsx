import * as React from 'react';
import { Box, Grid, Sheet, Typography, Divider, Drawer, Stack, Button } from '@mui/joy';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import Header from './Header';
import Sidebar from './Sidebar';
import DotaHUD from './DotaHUD';
import SourceManager from './SourceManager';
import Watchlist from './Watchlist';
import KnowledgeChat from './KnowledgeChat';
import FundametalDashboard from './FundamentalDashboard';
import IntelligenceFeed from './IntelligenceFeed';
import { glassStyle } from '../styles/glass';
import { API_BASE_URL } from '../config';
import MarketEventsTimeline from './MarketEventsTimeline';
import OaktreeIcon from './OaktreeIcon';
import { LogOut, User } from 'lucide-react';
import { AuthContext } from './AuthContext';

export default function RoutesLayout() {
  const { t } = useTranslation();
  const { tab: activeTab } = useSearch({ from: '/' });
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(true);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { user, logout } = React.useContext(AuthContext);

  // Game Mode state (persisted in localStorage)
  const [gameMode, setGameMode] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('oaktree_game_mode') !== 'false'; // default: true (game mode)
    }
    return true;
  });

  const toggleGameMode = React.useCallback(() => {
    setGameMode(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('oaktree_game_mode', String(next));
      }
      return next;
    });
  }, []);

  const setActiveTab = (tab: string) => {
    navigate({
      to: '/',
      search: { tab: tab as any },
    });
  };

  const [reports, setReports] = React.useState<any[]>([]);
  const [digests, setDigests] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchReports = async () => {
    try {
      const [reportsRes, digestsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/reports`),
        fetch(`${API_BASE_URL}/api/email-digests`)
      ]);
      
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData);
      }
      if (digestsRes.ok) {
        const digestsData = await digestsRes.json();
        setDigests(digestsData);
      }
    } catch (e) {
      console.error("Failed to fetch reports or digests", e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    // Intercept Google OAuth callback
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      if (code) {
        // Clear parameters immediately to avoid double execution on reload
        const newUrl = window.location.pathname + '?tab=sources';
        window.history.replaceState({}, document.title, newUrl);

        const exchangeOAuth = async () => {
          try {
            const res = await fetch(`${API_BASE_URL}/api/auth/google/callback`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                code,
                redirect_uri: window.location.origin + '/'
              })
            });
            if (res.ok) {
              window.dispatchEvent(new CustomEvent('gmail-connected'));
            } else {
              console.error('Failed to exchange Google OAuth code:', await res.text());
            }
          } catch (e) {
            console.error('Failed to exchange Google OAuth code', e);
          }
        };
        exchangeOAuth();
      }
    }

    fetchReports();

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchReports();
      }
    }, 180000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchReports();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

  // ═══ Shared content rendering ═══════════════════════════════════
  const renderContent = () => (
    <>
      {activeTab === 'dashboard' && <FundametalDashboard />}
      {activeTab === 'market' && (
        <IntelligenceFeed 
          reports={reports} 
          digests={digests} 
          loading={loading} 
          onDigestRead={async (id) => {
            setDigests(prev => prev.filter(d => d.id !== id));
            try {
              const res = await fetch(`${API_BASE_URL}/api/email-digests/mark-read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
              });
              if (!res.ok) {
                throw new Error(await res.text());
              }
              await fetchReports();
            } catch (e) {
              console.error("Failed to mark digest as read:", e);
              await fetchReports();
            }
          }}
        />
      )}
      {activeTab === 'watchlist' && <Watchlist />}
      {activeTab === 'agent' && <KnowledgeChat />}
      {activeTab === 'sources' && <SourceManager />}
      {activeTab === 'about' && (
        <Sheet sx={{ ...glassStyle, p: 4 }}>
          <Typography level="h2" sx={{ mb: 2 }}>{t('about.title')}</Typography>
          <Typography sx={{ mb: 2, lineHeight: 1.8 }}>
            {t('about.description')}
          </Typography>
          <Divider sx={{ my: 3, opacity: 0.1 }} />
          <Typography level="body-sm" sx={{ opacity: 0.5 }}>
            {t('about.footer')}
          </Typography>
        </Sheet>
      )}
    </>
  );

  // ═══ GAME MODE: DotA HUD Layout ═══════════════════════════════
  if (gameMode) {
    return (
      <DotaHUD
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        gameMode={gameMode}
        onToggleGameMode={toggleGameMode}
        reportsCount={reports.length + digests.length}
      >
        {renderContent()}
      </DotaHUD>
    );
  }

  // ═══ CLASSIC MODE: Original Layout ═════════════════════════════
  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: '1600px', margin: '0 auto', minHeight: '100vh' }}>
      <Header 
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} 
        sidebarCollapsed={sidebarCollapsed} 
        onOpenSidebar={() => setMobileOpen(true)}
        gameMode={gameMode}
        onToggleGameMode={toggleGameMode}
      />

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-content': {
            ...glassStyle,
            p: 3,
            width: 280,
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box 
              sx={{ 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                p: 1, 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)',
              }}
            >
              <OaktreeIcon color="white" size={20} />
            </Box>
            <Typography level="title-md" sx={{ fontWeight: 800 }}>{t('sidebar.oaktree_command')}</Typography>
          </Box>
          
          <Sidebar 
            activeTab={activeTab} 
            setActiveTab={(tab) => {
              setActiveTab(tab);
              setMobileOpen(false);
            }}
            reportsCount={reports.length + digests.length}
            collapsed={false}
          />
        </Box>

        <Box sx={{ mt: 'auto', pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            {user?.picture ? (
              <Box
                component="img"
                src={user.picture}
                alt={user.name}
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  border: '1px solid rgba(16, 185, 129, 0.2)'
                }}
              />
            ) : (
              <Box sx={{
                width: 36,
                height: 36,
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
            <Box sx={{ minWidth: 0 }}>
              <Typography level="title-sm" noWrap sx={{ fontWeight: 700 }}>
                {user?.name || t('header.operator')}
              </Typography>
              <Typography level="body-xs" noWrap sx={{ opacity: 0.5, fontWeight: 500 }}>
                {user?.email || t('header.pro_account')}
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="soft"
            color="danger"
            fullWidth
            startDecorator={<LogOut size={16} />}
            onClick={() => {
              setMobileOpen(false);
              logout();
            }}
            sx={{ borderRadius: '12px', fontWeight: 600 }}
          >
            {t('header.sign_out')}
          </Button>
        </Box>
      </Drawer>

      <Box sx={{ display: 'flex', gap: 4 }}>
        <Box 
          sx={{ 
            width: sidebarCollapsed ? '80px' : { md: '280px', lg: '320px' },
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0,
            display: { xs: 'none', md: 'block' }
          }}
        >
          <Sheet sx={{ 
            ...glassStyle, 
            p: 2, 
            position: 'sticky', 
            top: 24, 
            height: 'fit-content',
            overflow: 'hidden'
          }}>
            <Sidebar 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              reportsCount={reports.length + digests.length} 
              collapsed={sidebarCollapsed}
            />
          </Sheet>
        </Box>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          {renderContent()}
        </Box>

        {activeTab === 'market' && (
          <Box 
            sx={{ 
              width: { lg: '340px', xl: '380px' },
              flexShrink: 0,
              display: { xs: 'none', lg: 'block' }
            }}
          >
            <Box sx={{ position: 'sticky', top: 24 }}>
              <MarketEventsTimeline inSidebar />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
