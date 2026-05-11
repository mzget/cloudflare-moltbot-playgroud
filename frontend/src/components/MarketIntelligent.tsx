import * as React from 'react';
import { CssVarsProvider, extendTheme, CssBaseline } from '@mui/joy';
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
        background: {
          body: 'transparent',
          surface: 'rgba(255, 255, 255, 0.7)',
        },
      },
    },
    dark: {
      palette: {
        background: {
          body: 'transparent',
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
    <CssVarsProvider theme={theme} defaultMode="light">
      <CssBaseline />
      <RouterProvider router={router} />
    </CssVarsProvider>
  );
}
