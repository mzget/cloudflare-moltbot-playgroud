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
  components: {
    JoyGrid: {
      defaultProps: {
        spacing: 2,
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
              backgroundImage:
                'radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.03) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(16, 185, 129, 0.03) 0px, transparent 50%)',
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
