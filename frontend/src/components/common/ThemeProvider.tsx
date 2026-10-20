import * as React from 'react';
import { CssVarsProvider, extendTheme, CssBaseline, StyledEngineProvider, GlobalStyles } from '@mui/joy';

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
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          solidBg: '#059669',
          solidColor: '#ffffff',
          solidHoverBg: '#10b981',
          plainColor: '#34d399',
        },
        background: {
          body: '#080c14',
          surface: 'rgba(17, 24, 39, 0.85)',
          level1: 'rgba(30, 41, 59, 0.7)',
          level2: 'rgba(51, 65, 85, 0.6)',
          level3: 'rgba(71, 85, 105, 0.6)',
          popup: '#111827',
        },
        neutral: {
          outlinedBorder: 'rgba(255, 255, 255, 0.15)',
          softBg: 'rgba(255, 255, 255, 0.06)',
          plainColor: '#f1f5f9',
        },
        text: {
          primary: '#f8fafc',
          secondary: '#94a3b8',
          tertiary: '#cbd5e1',
        },
      },
    },
  },
  fontFamily: {
    body: 'Inter, var(--joy-fontFamily-fallback)',
    display: 'Outfit, var(--joy-fontFamily-fallback)',
  },
  components: {
    JoyTable: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& th': {
            color: theme.vars.palette.text.secondary,
            fontWeight: 700,
            fontSize: '0.75rem',
            letterSpacing: '0.04em',
            backgroundColor: 'transparent',
          },
          '& td': {
            color: theme.vars.palette.text.primary,
          },
        }),
      },
    },
    JoyInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.vars.palette.background.level1,
          borderColor: theme.vars.palette.neutral.outlinedBorder,
          color: theme.vars.palette.text.primary,
        }),
      },
    },
    JoySelect: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.vars.palette.background.level1,
          borderColor: theme.vars.palette.neutral.outlinedBorder,
          color: theme.vars.palette.text.primary,
        }),
      },
    },
    JoyGrid: {
      defaultProps: {
        spacing: 2,
      },
    },
    JoyTabList: {
      styleOverrides: {
        root: ({ ownerState, theme }) => ({
          ...(ownerState.variant === 'soft' && {
            padding: '4px',
            gap: '8px',
            borderRadius: '12px',
            backgroundColor: theme.vars.palette.background.level1,
            width: 'fit-content',
          }),
        }),
      },
    },
    JoyTab: {
      styleOverrides: {
        root: ({ ownerState, theme }) => ({
          fontWeight: 600,
          borderRadius: '8px',
          backgroundColor: 'transparent',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          fontSize: '0.875rem',
          [theme.breakpoints.down('sm')]: {
            fontSize: '0.8rem',
            paddingLeft: '12px',
            paddingRight: '12px',
          },
          '&:hover:not(.Mui-selected)': {
            color: theme.vars.palette.text.primary,
            backgroundColor: theme.vars.palette.background.level2,
          },
          '&.Mui-selected': {
            color: theme.vars.palette.primary.plainColor,
            backgroundColor: theme.vars.palette.background.surface,
            boxShadow: theme.shadow.sm,
          },
        }),
      },
    },
  },
});

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
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
              backgroundColor: '#080c14',
              backgroundImage:
                'radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.05) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(124, 58, 237, 0.04) 0px, transparent 50%)',
            },
            'html[data-joy-color-scheme="light"] body': {
              backgroundImage:
                'radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.06) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(16, 185, 129, 0.06) 0px, transparent 50%)',
            },
          }}
        />
        {children}
      </CssVarsProvider>
    </StyledEngineProvider>
  );
}
