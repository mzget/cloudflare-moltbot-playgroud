import * as React from 'react';
import { CircularProgress, Box, Typography } from '@mui/joy';
import * as TanStackRouter from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import '../i18n';
import RoutesLayout, { HostShellContext, type OaktreeFeatureViews } from './layout/RoutesLayout';
import NotFoundPage from './features/error/NotFoundPage';
import LoginScreen from './features/auth/LoginScreen';
import { API_BASE_URL, MCP_WORKER_URL } from '../config';
import { AuthContext, type User } from './common/AuthContext';
import { ThemeProvider } from './common/ThemeProvider';
import { useSettingsStore } from '../store/settingsStore';
import {
  analysisSearchSchema,
  financeSearchSchema,
  generalSearchSchema,
} from '../router/schemas';

// Idempotent Global Fetch Interceptor to inject JWT token
declare global {
  interface Window {
    __oaktreeFetchIntercepted?: boolean;
  }
}

export function installAuthFetchInterceptor() {
  if (typeof window === 'undefined' || window.__oaktreeFetchIntercepted) {
    return;
  }
  window.__oaktreeFetchIntercepted = true;
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string'
      ? input
      : (input instanceof URL ? input.toString() : (input as Request).url);

    const isBackend = url.startsWith(API_BASE_URL) ||
      url.startsWith('http://localhost:8787') ||
      url.startsWith('http://127.0.0.1:8787') ||
      url.startsWith('/api/');

    const isMcpWorker = url.startsWith(MCP_WORKER_URL) ||
      url.startsWith('http://localhost:8789') ||
      url.startsWith('http://127.0.0.1:8789');

    const token = localStorage.getItem('auth_token');
    if (token && (isBackend || isMcpWorker)) {
      init = init || {};
      const headers = new Headers(init.headers);
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      init.headers = headers;
    }

    const response = await originalFetch(input, init);

    if (response.status === 401 && isBackend && !url.includes('/api/auth/user/')) {
      fetch(`${API_BASE_URL}/api/auth/user/me`).then(res => {
        if (res.status === 401) {
          console.warn("Session expired or invalid (confirmed by /api/auth/user/me). Logging out.");
          localStorage.removeItem('auth_token');
          window.dispatchEvent(new CustomEvent('auth-expired'));
        } else {
          console.log("Ignored transient 401 error. Session is still valid.");
        }
      }).catch(err => {
        console.error('Failed to verify session status after 401:', err);
      });
    }

    return response;
  };
}

installAuthFetchInterceptor();

/**
 * Creates an isolated browser history for TanStack Router that prevents infinite
 * pushState/popstate re-render loops when federated micro-frontends (such as Simplicity)
 * mount mobile full-screen modal views.
 */
export function createIsolatedBrowserHistory() {
  if (typeof window === 'undefined') return undefined;

  const createBrowserHistory = (TanStackRouter as any).createBrowserHistory;
  if (typeof createBrowserHistory !== 'function') return undefined;

  const baseHistory = createBrowserHistory();
  let lastHref = window.location.pathname + window.location.search + window.location.hash;
  let hadInternalModal = false;

  // Intercept window.history.pushState to avoid duplicate consecutive simplicityView states
  const anyWindow = window as any;
  if (!anyWindow.__oaktreeHistoryIntercepted) {
    anyWindow.__oaktreeHistoryIntercepted = true;
    const rawPushState = window.history.pushState;
    window.history.pushState = function (state: any, title: string, url?: string | URL | null) {
      if (state?.simplicityView && window.history.state?.simplicityView === state.simplicityView) {
        return;
      }
      return rawPushState.apply(this, [state, title, url] as any);
    };
  }

  const origSubscribe = baseHistory.subscribe.bind(baseHistory);
  baseHistory.subscribe = (cb: (event: any) => void) => {
    return origSubscribe((event: any) => {
      const nextHref = window.location.pathname + window.location.search + window.location.hash;
      const isSameHref = nextHref === lastHref;
      const isInternalModal = Boolean(
        event.location?.state?.simplicityView ||
        (window.history.state && (window.history.state as any).simplicityView)
      );

      if (isSameHref && isInternalModal) {
        hadInternalModal = true;
        return;
      }

      if (isSameHref && hadInternalModal) {
        hadInternalModal = false;
        return;
      }

      hadInternalModal = isInternalModal;
      lastHref = nextHref;
      cb(event);
    });
  };

  return baseHistory;
}

// 1. Define the Route Tree
export function createHostRouter() {
  const createRootRoute = TanStackRouter.createRootRoute;
  const createRoute = TanStackRouter.createRoute;
  const createRouter = TanStackRouter.createRouter;
  if (typeof createRootRoute !== 'function' || typeof createRoute !== 'function' || typeof createRouter !== 'function') {
    return null as any;
  }

  const rootRoute = createRootRoute();

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    beforeLoad: ({ navigate }: any) => {
      throw (navigate as any)({ to: '/dashboard', replace: true });
    },
  });

  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/dashboard',
    validateSearch: generalSearchSchema,
    component: RoutesLayout,
  });

  const portfolioRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/portfolio',
    validateSearch: generalSearchSchema,
    beforeLoad: ({ navigate, search }: any) => {
      throw (navigate as any)({ to: '/dashboard', search, replace: true });
    },
  });

  const marketRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/market',
    validateSearch: generalSearchSchema,
    component: RoutesLayout,
  });

  const watchlistRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/watchlist',
    validateSearch: generalSearchSchema,
    component: RoutesLayout,
  });

  const agentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/agent',
    validateSearch: generalSearchSchema,
    component: RoutesLayout,
  });

  const dbAgentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/db-agent',
    validateSearch: generalSearchSchema,
    component: RoutesLayout,
  });

  const commandCenterRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/command-center',
    validateSearch: generalSearchSchema,
    component: RoutesLayout,
  });

  const aboutRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/about',
    validateSearch: generalSearchSchema,
    component: RoutesLayout,
  });

  const analysisRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/analysis',
    validateSearch: analysisSearchSchema,
    component: RoutesLayout,
  });

  const financeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/finance',
    validateSearch: financeSearchSchema,
    component: RoutesLayout,
  });

  const routeTree = rootRoute.addChildren([
    indexRoute,
    dashboardRoute,
    portfolioRoute,
    marketRoute,
    watchlistRoute,
    agentRoute,
    dbAgentRoute,
    commandCenterRoute,
    aboutRoute,
    analysisRoute,
    financeRoute,
  ]);

  return createRouter({
    routeTree,
    history: createIsolatedBrowserHistory(),
    defaultPreload: 'intent',
    trailingSlash: 'never',
    defaultNotFoundComponent: NotFoundPage,
  });
}

let cachedRouter: any = null;
export function getHostRouter() {
  if (!cachedRouter) {
    try {
      if (typeof (TanStackRouter as any).createRootRoute === 'function') {
        cachedRouter = createHostRouter();
      }
    } catch {
      // In partial mock environments (e.g. Vitest vi.mock('@tanstack/react-router')), createRootRoute may not be defined
      cachedRouter = null;
    }
  }
  return cachedRouter;
}

export const router = new Proxy({} as any, {
  get(_target, prop) {
    const r = getHostRouter();
    return r ? (r as any)[prop] : undefined;
  },
});

export interface HostAppShellProps {
  views?: OaktreeFeatureViews;
  reportsCount?: number;
}

export function HostAppShell({ views = {}, reportsCount = 0 }: HostAppShellProps) {
  const { t } = useTranslation();
  const [user, setUser] = React.useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = React.useState(true);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [exchangingCode, setExchangingCode] = React.useState(false);

  const logout = React.useCallback(() => {
    console.log("logout function called in HostAppShell - clearing auth_token");
    localStorage.removeItem('auth_token');
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = window.location.origin + '/';
    }
  }, []);

  React.useEffect(() => {
    const isLocalhost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const shouldMockUser = isLocalhost && import.meta.env.PUBLIC_CONNECT_TO_PROD !== 'true';

    if (shouldMockUser) {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      if (code && state !== 'user-login') {
        const newUrl = window.location.origin + '/command-center';
        window.history.replaceState({}, document.title, newUrl);
        fetch(`${API_BASE_URL}/api/auth/google/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            redirect_uri: window.location.origin + '/'
          })
        }).then(res => {
          if (res.ok) {
            window.dispatchEvent(new CustomEvent('gmail-connected'));
          }
        }).catch(console.error);
      }
      setUser({
        email: 'local@example.com',
        name: 'Local User',
        picture: ''
      });
      setCheckingAuth(false);
      useSettingsStore.getState().fetchPreferences().catch(console.error);
      return;
    }

    const checkCurrentSession = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setCheckingAuth(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/user/me`);
        if (res.ok) {
          const data = (await res.json()) as any;
          setUser(data.user);
          useSettingsStore.getState().fetchPreferences().catch(console.error);
        } else {
          localStorage.removeItem('auth_token');
        }
      } catch (e) {
        console.error('Failed to verify session:', e);
      } finally {
        setCheckingAuth(false);
      }
    };

    const handleOAuthCallback = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      if (code && state === 'user-login') {
        setExchangingCode(true);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/user/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              redirect_uri: window.location.origin + '/'
            })
          });

          if (res.ok) {
            const data = (await res.json()) as any;
            localStorage.setItem('auth_token', data.token);
            setUser(data.user);
            setAuthError(null);
            useSettingsStore.getState().fetchPreferences().catch(console.error);
          } else {
            const errText = await res.text();
            setAuthError(errText || 'Failed to authenticate with Google');
          }
        } catch (e) {
          console.error('OAuth exchange error:', e);
          setAuthError('Connection failed when authenticating');
        } finally {
          setExchangingCode(false);
          setCheckingAuth(false);
        }
      } else {
      if (code && state !== 'user-login') {
        setExchangingCode(true);
        const newUrl = window.location.origin + '/command-center';
        window.history.replaceState({}, document.title, newUrl);

        try {
          await checkCurrentSession();
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
        } finally {
          setExchangingCode(false);
          setCheckingAuth(false);
          if (cachedRouter?.navigate) {
            try {
              cachedRouter.navigate({ to: '/command-center', replace: true });
            } catch {
              // ignore
            }
          }
        }
        return;
      }
      checkCurrentSession();
      }
    };

    const handleAuthExpired = () => {
      setUser(null);
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    handleOAuthCallback();

    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, []);

  const handleLoginClick = async () => {
    setCheckingAuth(true);
    try {
      const redirectUri = window.location.origin + '/';
      const res = await fetch(`${API_BASE_URL}/api/auth/user/login-url?redirect_uri=${encodeURIComponent(redirectUri)}`);
      if (res.ok) {
        const data = (await res.json()) as any;
        window.location.href = data.url;
      } else {
        const errText = await res.text();
        setAuthError(errText || 'Failed to initiate login');
        setCheckingAuth(false);
      }
    } catch (e) {
      console.error('Login redirect error:', e);
      setAuthError('Failed to connect to authentication server');
      setCheckingAuth(false);
    }
  };

  const renderContent = () => {
    if (checkingAuth || exchangingCode) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2 }}>
          <CircularProgress color="primary" variant="soft" size="lg" />
          <Typography level="body-sm" sx={{ opacity: 0.7 }}>
            {exchangingCode ? t('app.exchanging_token') : t('app.verifying_session')}
          </Typography>
        </Box>
      );
    }

    if (!user) {
      return (
        <LoginScreen
          onLoginClick={handleLoginClick}
          loading={checkingAuth || exchangingCode}
          error={authError}
        />
      );
    }

    const activeRouter = getHostRouter();
    let RouterProvider: any = null;
    try {
      RouterProvider = (TanStackRouter as any).RouterProvider;
    } catch {
      RouterProvider = null;
    }
    return (
      <AuthContext.Provider value={{ user, logout }}>
        <HostShellContext.Provider value={{ views, reportsCount }}>
          {activeRouter && RouterProvider ? <RouterProvider router={activeRouter} /> : null}
        </HostShellContext.Provider>
      </AuthContext.Provider>
    );
  };

  return (
    <ThemeProvider>
      {renderContent()}
    </ThemeProvider>
  );
}

export default HostAppShell;

