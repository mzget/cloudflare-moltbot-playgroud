import * as React from 'react';
import { Box, Grid, Sheet, Typography, Divider, Drawer, Stack, Button, CircularProgress } from '@mui/joy';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { useColorScheme } from '@mui/joy/styles';
import Header from './Header';
import Sidebar from './Sidebar';
import { glassStyle } from '../../styles/glass';
import { API_BASE_URL } from '../../config';

const SourceManager = React.lazy(() => import('../features/sources/SourceManager'));
const Watchlist = React.lazy(() => import('../features/watchlist/Watchlist'));
const YahooPortfolio = React.lazy(() => import('../features/portfolio/YahooPortfolio'));
const KnowledgeChat = React.lazy(() => import('../features/agent/KnowledgeChat'));
const DatabaseChat = React.lazy(() => import('../features/agent/DatabaseChat'));
const AnalysisReport = React.lazy(() => import('../features/agent/AnalysisReport'));
const IntelligenceFeed = React.lazy(() => import('../features/market/IntelligenceFeed'));
const MarketEventsTimeline = React.lazy(() => import('../features/market/MarketEventsTimeline'));

const LoadingFallback = (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
    <CircularProgress size="md" variant="soft" />
  </Box>
);
import OaktreeIcon from '../common/OaktreeIcon';
import { LogOut, User } from 'lucide-react';
import { AuthContext } from '../common/AuthContext';
import { useSettingsStore } from '../../store/settingsStore';

export default function RoutesLayout() {
  const { t } = useTranslation();
  const { tab: activeTab, symbol } = useSearch({ from: '/' });
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(true);
  const [sidebarHidden, setSidebarHidden] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { user, logout } = React.useContext(AuthContext);
  const theme = useSettingsStore(state => state.theme);
  const { mode, setMode } = useColorScheme();

  React.useEffect(() => {
    if (theme && theme !== mode) {
      setMode(theme);
    }
  }, [theme, mode, setMode]);

  const setActiveTab = (tab: string) => {
    navigate({
      to: '/',
      search: { tab: tab as any },
    });
  };

  const [reports, setReports] = React.useState<any[]>([]);
  const [digests, setDigests] = React.useState<any[]>([]);
  const [notebookArticles, setNotebookArticles] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchReports = async () => {
    try {
      const [reportsRes, digestsRes, articlesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/reports`),
        fetch(`${API_BASE_URL}/api/email-digests`),
        fetch(`${API_BASE_URL}/api/notebook-articles`)
      ]);
      
      if (reportsRes.ok) {
        const reportsData = (await reportsRes.json()) as any;
        setReports(reportsData);
      }
      if (digestsRes.ok) {
        const digestsData = (await digestsRes.json()) as any;
        setDigests(digestsData);
      }
      if (articlesRes.ok) {
        const articlesData = (await articlesRes.json()) as any;
        setNotebookArticles(articlesData);
      }
    } catch (e) {
      console.error("Failed to fetch reports, digests or articles", e);
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
        const newUrl = window.location.pathname + '?tab=command-center';
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
    }, 180000); // Poll every 3 minutes instead of 30s

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

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: { xs: '1600px', xl: '100%' }, margin: '0 auto', minHeight: '100vh' }}>
      <Header 
        onToggleSidebar={() => {
          if (sidebarHidden) {
            setSidebarHidden(false);
          } else {
            setSidebarCollapsed(!sidebarCollapsed);
          }
        }} 
        sidebarCollapsed={sidebarCollapsed} 
        sidebarHidden={sidebarHidden}
        onOpenSidebar={() => setMobileOpen(true)}
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
              console.log("Sign Out Button clicked in mobile Drawer, calling logout...", logout);
              setMobileOpen(false);
              logout();
            }}
            sx={{ borderRadius: '12px', fontWeight: 600 }}
          >
            {t('header.sign_out')}
          </Button>
        </Box>
      </Drawer>

      <Box sx={{ 
        display: 'flex', 
        gap: sidebarHidden ? 0 : 4,
        transition: 'gap 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* Sidebar Container */}
        <Box 
          sx={{ 
            width: sidebarHidden ? '0px' : (sidebarCollapsed ? '80px' : { md: '280px', lg: '320px' }),
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease, visibility 0.4s ease',
            flexShrink: 0,
            opacity: sidebarHidden ? 0 : 1,
            visibility: sidebarHidden ? 'hidden' : 'visible',
            display: { xs: 'none', md: 'block' }
          }}
        >
          <Sheet sx={{ 
            ...glassStyle, 
            p: sidebarHidden ? 0 : 2, 
            borderWidth: sidebarHidden ? 0 : '1px',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
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
              onHide={() => setSidebarHidden(true)}
            />
          </Sheet>
        </Box>

        {/* Main Content Container */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <React.Suspense fallback={LoadingFallback}>
            {activeTab === 'dashboard' && <YahooPortfolio />}
          {activeTab === 'market' && (
            <IntelligenceFeed 
              reports={reports} 
              digests={digests} 
              notebookArticles={notebookArticles}
              loading={loading} 
              onDigestRead={async (id) => {
                // Optimistic UI update
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
              onDigestQueueFacebook={async (id) => {
                // Optimistic UI update
                setDigests(prev => prev.map(d => d.id === id ? { ...d, facebook_status: 'pending' } : d));
                try {
                  const res = await fetch(`${API_BASE_URL}/api/facebook/queue`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ source_type: 'email_digest', source_id: id })
                  });
                  if (!res.ok) {
                    throw new Error(await res.text());
                  }
                  await fetchReports();
                } catch (e) {
                  console.error("Failed to queue Facebook post:", e);
                  await fetchReports();
                }
              }}
              onReportRead={async (id) => {
                // Optimistic UI: mark as read locally
                setReports(prev => prev.map(r => r.id === id ? { ...r, is_readed: 1 } : r));
                try {
                  const res = await fetch(`${API_BASE_URL}/api/reports/mark-read`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                  });
                  if (!res.ok) {
                    throw new Error(await res.text());
                  }
                } catch (e) {
                  console.error("Failed to mark report as read:", e);
                  await fetchReports();
                }
              }}
            />
          )}

          {activeTab === 'watchlist' && <Watchlist />}
          {activeTab === 'agent' && <KnowledgeChat />}
          {activeTab === 'analysis' && symbol && <AnalysisReport symbol={symbol} />}
          {activeTab === 'analysis' && !symbol && <Box sx={{ py: 4, textAlign: 'center' }}><Typography level="h3">กรุณาระบุสัญลักษณ์หุ้นที่ต้องการวิเคราะห์</Typography></Box>}
          {activeTab === 'db-agent' && <DatabaseChat />}
          {activeTab === 'command-center' && <SourceManager />}
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
          </React.Suspense>
        </Box>

        {/* Right Sidebar Container */}
        {activeTab === 'market' && (
          <Box 
            sx={{ 
              width: { lg: '340px', xl: '380px' },
              flexShrink: 0,
              display: { xs: 'none', lg: 'block' }
            }}
          >
            <Box sx={{ position: 'sticky', top: 24 }}>
              <React.Suspense fallback={LoadingFallback}>
                <MarketEventsTimeline inSidebar />
              </React.Suspense>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
