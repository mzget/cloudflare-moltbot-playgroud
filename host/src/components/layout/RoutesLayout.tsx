import * as React from 'react';
import { Box, Typography, Divider, Drawer, Stack, Button, CircularProgress, Sheet } from '@mui/joy';
import { useSearch, useNavigate, useLocation } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from '@mui/joy/styles';
import { LogOut, User, Layers, ArrowRight } from 'lucide-react';
import Header from './Header';
import Sidebar from './Sidebar';
import { glassStyle } from '../../styles/glass';
import { API_BASE_URL } from '../../config';
import OaktreeIcon from '../common/OaktreeIcon';
import { AuthContext } from '../common/AuthContext';
import { useSettingsStore } from '../../store/settingsStore';
import RemoteFinanceContainer from '../federation/remotes/finance/RemoteFinanceContainer';
import type { FinanceTab } from '../../router/schemas';

export interface OaktreeFeatureViews {
  dashboard?: React.ComponentType<any>;
  market?: React.ComponentType<any>;
  marketSidebar?: React.ComponentType<{ inSidebar?: boolean }>;
  watchlist?: React.ComponentType<any>;
  agent?: React.ComponentType<any>;
  analysis?: React.ComponentType<{ symbol: string; subTab?: string; hospitality?: any }>;
  dbAgent?: React.ComponentType<any>;
  commandCenter?: React.ComponentType<any>;
}

export interface HostShellContextValue {
  views?: OaktreeFeatureViews;
  reportsCount?: number;
}

export const HostShellContext = React.createContext<HostShellContextValue>({});

const LoadingFallback = (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
    <CircularProgress size="md" variant="soft" />
  </Box>
);

export default function RoutesLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const activeTab = location.pathname.replace(/^\/|\/$/g, '') || 'dashboard';
  const search = useSearch({ strict: false }) as any;
  const { symbol, tab: subTab } = search || {};
  const navigate = useNavigate();

  const { views = {}, reportsCount = 0 } = React.useContext(HostShellContext);

  // Finance search parameters with safe fallback defaults
  const validFinanceTabs: readonly FinanceTab[] = ['dashboard', 'transactions', 'budgets', 'wallets'] as const;
  const financeTab: FinanceTab = (search?.tab && validFinanceTabs.includes(search.tab))
    ? (search.tab as FinanceTab)
    : 'dashboard';
  const financeWallet: string = (typeof search?.wallet === 'string' && search.wallet.trim().length > 0)
    ? search.wallet.trim()
    : 'all';

  // Commanded-Transition Guards to eliminate bidirectional echo loops
  const lastCommandedTabRef = React.useRef<FinanceTab | null>(null);
  const lastCommandedWalletRef = React.useRef<string | null>(null);

  // Clear transition lock once URL search parameters have synchronized
  React.useEffect(() => {
    if (lastCommandedTabRef.current === financeTab) {
      lastCommandedTabRef.current = null;
    }
  }, [financeTab]);

  React.useEffect(() => {
    if (lastCommandedWalletRef.current === financeWallet) {
      lastCommandedWalletRef.current = null;
    }
  }, [financeWallet]);

  const handleFinanceTabChange = React.useCallback(
    (newTab: FinanceTab) => {
      if (newTab === financeTab) return;
      if (lastCommandedTabRef.current !== null && newTab !== lastCommandedTabRef.current) {
        return;
      }
      lastCommandedTabRef.current = newTab;
      navigate({
        search: ((old: any) => ({
          ...old,
          tab: newTab,
        })) as any,
      });
    },
    [financeTab, navigate]
  );

  const handleFinanceWalletChange = React.useCallback(
    (newWalletId: string) => {
      const normalizedWallet = newWalletId?.trim() || 'all';
      if (normalizedWallet === financeWallet) return;
      if (lastCommandedWalletRef.current !== null && normalizedWallet !== lastCommandedWalletRef.current) {
        return;
      }
      lastCommandedWalletRef.current = normalizedWallet;
      navigate({
        search: ((old: any) => ({
          ...old,
          wallet: normalizedWallet,
        })) as any,
      });
    },
    [financeWallet, navigate]
  );

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { user, logout } = React.useContext(AuthContext);
  const theme = useSettingsStore((state) => state.theme);
  const { mode, setMode } = useColorScheme();

  React.useEffect(() => {
    if (theme && theme !== mode) {
      setMode(theme);
    }
  }, [theme, mode, setMode]);

  const setActiveTab = (tab: string) => {
    if (tab === 'analysis') {
      navigate({
        to: '/analysis',
        search: { symbol, tab: 'dossier' },
      } as any);
    } else if (tab === 'finance') {
      navigate({
        to: '/finance',
        search: { tab: 'dashboard', wallet: 'all' },
      } as any);
    } else {
      navigate({
        to: `/${tab}`,
        search: {},
      } as any);
    }
  };

  React.useEffect(() => {
    // Intercept Google OAuth callback
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      if (code) {
        const newUrl = window.location.origin + '/command-center';
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
  }, []);

  const DashboardView = views.dashboard;
  const MarketView = views.market;
  const MarketSidebarView = views.marketSidebar;
  const WatchlistView = views.watchlist;
  const AgentView = views.agent;
  const AnalysisView = views.analysis;
  const DbAgentView = views.dbAgent;
  const CommandCenterView = views.commandCenter;

  const renderOaktreeTabContent = () => {
    if (activeTab === 'dashboard') {
      return DashboardView ? <DashboardView /> : renderStandaloneInspector('Dashboard', 'Stock Portfolio & Holdings');
    }
    if (activeTab === 'market') {
      return MarketView ? <MarketView /> : renderStandaloneInspector('Market Intelligence', 'Daily News & Synthesis');
    }
    if (activeTab === 'watchlist') {
      return WatchlistView ? <WatchlistView /> : renderStandaloneInspector('Watchlist', 'Monitored Assets');
    }
    if (activeTab === 'agent') {
      return AgentView ? <AgentView /> : renderStandaloneInspector('Agent Chat', 'Howard Marks AI Advisor');
    }
    if (activeTab === 'analysis') {
      if (!symbol) {
        return (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography level="h3">กรุณาระบุสัญลักษณ์หุ้นที่ต้องการวิเคราะห์</Typography>
          </Box>
        );
      }
      return AnalysisView ? <AnalysisView symbol={symbol} subTab={subTab} /> : renderStandaloneInspector('Analysis', `Stock Dossier: ${symbol}`);
    }
    if (activeTab === 'db-agent') {
      return DbAgentView ? <DbAgentView /> : renderStandaloneInspector('Database Agent', 'D1 Natural Language Chat');
    }
    if (activeTab === 'command-center') {
      return CommandCenterView ? <CommandCenterView /> : renderStandaloneInspector('Command Center', 'Sources & Ingestion');
    }
    return null;
  };

  const renderStandaloneInspector = (title: string, subtitle: string) => (
    <Sheet
      sx={{
        ...glassStyle,
        p: { xs: 3, md: 5 },
        borderRadius: '20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        maxWidth: 600,
        mx: 'auto',
        my: 4,
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '16px',
          bgcolor: 'rgba(16, 185, 129, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#10b981',
        }}
      >
        <Layers size={28} />
      </Box>
      <Typography level="h3" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      <Typography level="body-sm" sx={{ opacity: 0.7 }}>
        {subtitle}
      </Typography>
      <Divider sx={{ my: 1, width: '100%', opacity: 0.1 }} />
      <Typography level="body-xs" sx={{ opacity: 0.6, maxWidth: 440, lineHeight: 1.6 }}>
        You are currently running in <b>Standalone Host Mode</b> (<code>npm run dev:host</code>).
        The Header UI, Auth, and Module Federation bridge are fully functional.
      </Typography>
      <Button
        variant="solid"
        color="primary"
        endDecorator={<ArrowRight size={16} />}
        onClick={() => {
          navigate({
            to: '/finance',
            search: { tab: 'dashboard', wallet: 'all' },
          } as any);
        }}
        sx={{ borderRadius: '12px', mt: 1, fontWeight: 700 }}
      >
        Open 💳 Simplicity Finance
      </Button>
    </Sheet>
  );

  return (
    <Box sx={{ px: { xs: 1.5, sm: 2.5, md: 3.5, lg: 4 }, py: { xs: 1.5, md: 2.5 }, width: '100%', minHeight: '100vh', boxSizing: 'border-box' }}>
      <Header 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeFinanceTab={financeTab}
        onFinanceTabChange={handleFinanceTabChange}
        selectedWalletId={financeWallet}
        onFinanceWalletChange={handleFinanceWalletChange}
        reportsCount={reportsCount}
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
            reportsCount={reportsCount}
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

      <Box sx={{ display: 'flex', gap: { xs: 0, lg: 3 }, width: '100%' }}>
        {/* Main Content Area */}
        <Box sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
          <React.Suspense fallback={LoadingFallback}>
            {activeTab === 'finance' && (
              <RemoteFinanceContainer
                activeTab={financeTab}
                selectedWalletId={financeWallet}
                onTabChange={handleFinanceTabChange}
                onWalletChange={handleFinanceWalletChange}
              />
            )}
            {activeTab === 'about' && (
              <Sheet sx={{ ...glassStyle, p: 4, borderRadius: '18px' }}>
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
            {activeTab !== 'finance' && activeTab !== 'about' && renderOaktreeTabContent()}
          </React.Suspense>
        </Box>

        {/* Right Sidebar Container */}
        {activeTab === 'market' && MarketSidebarView && (
          <Box 
            sx={{ 
              width: { lg: '340px', xl: '380px' },
              flexShrink: 0,
              display: { xs: 'none', lg: 'block' }
            }}
          >
            <Box sx={{ position: 'sticky', top: 72 }}>
              <React.Suspense fallback={LoadingFallback}>
                <MarketSidebarView inSidebar />
              </React.Suspense>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

