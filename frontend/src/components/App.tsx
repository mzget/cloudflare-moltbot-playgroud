import * as React from 'react';
import { CssVarsProvider, extendTheme, CssBaseline, StyledEngineProvider, GlobalStyles } from '@mui/joy';
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { z } from 'zod';
import DashboardLayout from './DashboardLayout';

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
  component: DashboardLayout,
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
        <RouterProvider router={router} />
      </CssVarsProvider>
    </StyledEngineProvider>
  );
}
