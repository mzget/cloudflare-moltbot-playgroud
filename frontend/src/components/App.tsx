import * as React from 'react';
import { CircularProgress, Box, Typography } from '@mui/joy';
import { ThemeProvider } from './common/ThemeProvider';
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import '../i18n';
import RoutesLayout from './layout/RoutesLayout';
import LoginScreen from './features/auth/LoginScreen';
import { API_BASE_URL, MCP_WORKER_URL } from '../config';
import { AuthContext } from './common/AuthContext';
import type { User } from './common/AuthContext';
import { useSettingsStore } from '../store/settingsStore';

// Global Fetch Interceptor to inject JWT token
if (typeof window !== 'undefined') {
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
      // Instead of clearing token immediately (which causes logouts on transient/reload errors),
      // verify if the session is truly invalid by checking the auth status endpoint.
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



// 1. Define the Search Schema (Validation)
const dashboardSearchSchema = z.object({
  tab: z.enum(['dashboard', 'market', 'agent', 'db-agent', 'watchlist', 'command-center', 'about', 'analysis']).catch('dashboard'),
  symbol: z.string().optional(),
});

// 2. Define the Route Tree
const rootRoute = createRootRoute();

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: dashboardSearchSchema,
  component: RoutesLayout,
});

const routeTree = rootRoute.addChildren([indexRoute]);

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}



export default function App() {
  const { t } = useTranslation();
  const [user, setUser] = React.useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = React.useState(true);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [exchangingCode, setExchangingCode] = React.useState(false);

  const logout = React.useCallback(() => {
    console.log("logout function called in App.tsx - clearing auth_token");
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
      setUser({
        email: 'local@example.com',
        name: 'Local User',
        picture: ''
      });
      setCheckingAuth(false);
      // Fetch user preferences
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
          const data = await res.json();
          setUser(data.user);
          // Fetch user preferences
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
        // Clear query parameters
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
            const data = await res.json();
            localStorage.setItem('auth_token', data.token);
            setUser(data.user);
            setAuthError(null);
            // Fetch user preferences
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
        const data = await res.json();
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

    return (
      <AuthContext.Provider value={{ user, logout }}>
        <RouterProvider router={router} />
      </AuthContext.Provider>
    );
  };

  return (
    <ThemeProvider>
      {renderContent()}
    </ThemeProvider>
  );
}

