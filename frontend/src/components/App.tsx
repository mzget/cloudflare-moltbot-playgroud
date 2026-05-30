import * as React from 'react';
import { CssVarsProvider, extendTheme, CssBaseline, StyledEngineProvider, GlobalStyles, CircularProgress, Box, Typography } from '@mui/joy';
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { z } from 'zod';
import RoutesLayout from './RoutesLayout';
import LoginScreen from './LoginScreen';
import { API_BASE_URL } from '../config';
import { AuthContext } from './AuthContext';
import type { User } from './AuthContext';

// Global Fetch Interceptor to inject JWT token
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === 'string'
      ? input
      : (input instanceof URL ? input.toString() : (input as Request).url);

    const token = localStorage.getItem('auth_token');
    if (token && (url.startsWith(API_BASE_URL) || url.startsWith('/api/'))) {
      init = init || {};
      const headers = new Headers(init.headers);
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      init.headers = headers;
    }

    const response = await originalFetch(input, init);

    if (response.status === 401 && (url.startsWith(API_BASE_URL) || url.startsWith('/api/')) && !url.includes('/api/auth/user/')) {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new CustomEvent('auth-expired'));
    }

    return response;
  };
}



// 1. Define the Search Schema (Validation)
const dashboardSearchSchema = z.object({
  tab: z.enum(['dashboard', 'market', 'agent', 'watchlist', 'sources', 'about']).catch('dashboard'),
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

const theme = extendTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        background: {
          body: '#f8fafc',
          surface: 'rgba(255, 255, 255, 0.7)',
        },
      },
    },
    dark: {
      palette: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        background: {
          body: '#050505',
          surface: 'rgba(23, 23, 23, 0.6)',
        },
        neutral: {
          outlinedBorder: 'rgba(255, 255, 255, 0.08)',
        },
      },
    },
  },
  fontFamily: {
    body: 'Inter, var(--joy-fontFamily-fallback)',
    display: 'Outfit, var(--joy-fontFamily-fallback)',
  },
});

export default function Dashboard() {
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
            {exchangingCode ? 'Exchanging Google token...' : 'Verifying session...'}
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
    <StyledEngineProvider injectFirst>
      <CssVarsProvider theme={theme} defaultMode="dark">
        <CssBaseline />
        <GlobalStyles
          styles={{
            body: {
              transition: 'background-color 0.3s ease, color 0.3s ease',
              minHeight: '100vh',
            },
            'html[data-joy-color-scheme="dark"] body': {
              backgroundImage:
                'radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.03) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(16, 185, 129, 0.03) 0px, transparent 50%)',
            },
            'html[data-joy-color-scheme="light"] body': {
              backgroundImage:
                'radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.06) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(16, 185, 129, 0.06) 0px, transparent 50%)',
            },
          }}
        />
        {renderContent()}
      </CssVarsProvider>
    </StyledEngineProvider>
  );
}
