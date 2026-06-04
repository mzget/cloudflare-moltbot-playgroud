import * as React from 'react';
import { Box, Button, Typography, Sheet, Stack, Alert } from '@mui/joy';
import { ShieldAlert, Info, Newspaper } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { glassStyle } from '../../../styles/glass';
import OaktreeIcon from '../../common/OaktreeIcon';

interface LoginScreenProps {
  onLoginClick: () => void;
  loading: boolean;
  error: string | null;
}

export default function LoginScreen({ onLoginClick, loading, error }: LoginScreenProps) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        p: 3,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Decorative Gradients */}
      <Box
        sx={{
          position: 'absolute',
          top: '20%',
          left: '10%',
          width: { xs: '200px', md: '400px' },
          height: { xs: '200px', md: '400px' },
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '15%',
          right: '10%',
          width: { xs: '250px', md: '500px' },
          height: { xs: '250px', md: '500px' },
          background: 'radial-gradient(circle, rgba(5, 150, 105, 0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <Sheet
        sx={{
          ...glassStyle,
          p: { xs: 4, md: 6 },
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3.5,
          zIndex: 1,
          backdropFilter: 'blur(30px) saturate(180%)',
          transition: 'all 0.3s ease',
          '&:hover': {
            borderColor: 'rgba(16, 185, 129, 0.2)',
            boxShadow: '0 32px 80px rgba(16, 185, 129, 0.05)',
          },
        }}
      >
        {/* App Logo */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            p: 0.5,
            borderRadius: '24px',
            display: 'inline-flex',
            boxShadow: '0 12px 30px rgba(16, 185, 129, 0.3)',
            mb: 1,
          }}
        >
          <OaktreeIcon color="white" size={56} />
        </Box>

        {/* Title & Branding */}
        <Stack spacing={1} sx={{ width: '100%' }}>
          <Typography
            level="h1"
            sx={{
              fontSize: '2rem',
              fontWeight: 800,
              fontFamily: 'Outfit, sans-serif',
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, var(--joy-palette-text-primary) 30%, rgba(255,255,255,0.7) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {t('app.title')}
          </Typography>

          <Typography
            level="title-sm"
            sx={{
              color: '#10b981',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              fontSize: '0.75rem',
            }}
          >
            {t('app.subtitle')}
          </Typography>
        </Stack>

        <Typography
          level="body-md"
          sx={{
            color: 'text.secondary',
            lineHeight: 1.6,
            fontSize: '0.95rem',
          }}
        >
          {t('login.description')}
        </Typography>

        {/* Error State */}
        {error && (
          <Alert
            color="danger"
            variant="soft"
            startDecorator={<ShieldAlert size={20} />}
            sx={{
              width: '100%',
              borderRadius: '16px',
              textAlign: 'left',
              fontSize: '0.875rem',
              lineHeight: 1.4,
              border: '1px solid rgba(244, 63, 94, 0.2)',
            }}
          >
            <Box>
              <Typography level="title-sm" color="danger" sx={{ fontWeight: 700 }}>
                {t('login.access_denied')}
              </Typography>
              <Typography level="body-xs" sx={{ mt: 0.5, color: 'text.secondary' }}>
                {error}
              </Typography>
            </Box>
          </Alert>
        )}

        {/* Actions */}
        <Stack spacing={2} sx={{ width: '100%', mt: 1 }}>
          <Button
            size="lg"
            variant="solid"
            onClick={onLoginClick}
            loading={loading}
            startDecorator={
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'white',
                  p: '5px',
                  borderRadius: '8px',
                  mr: 0.5,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.78 0 3.37.61 4.63 1.81l3.46-3.46C18.01 1.34 15.22 0 12 0 7.37 0 3.4 2.67 1.48 6.56l3.99 3.1c.94-2.82 3.59-4.62 6.53-4.62Z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.28 1.48-1.12 2.74-2.38 3.58l3.7 2.87c2.16-1.99 3.71-4.92 3.71-8.6Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.47 9.66c-.24-.72-.38-1.5-.38-2.3c0-.8.14-1.58.38-2.3L1.48 1.96C.54 3.86 0 6.01 0 8.26c0 2.25.54 4.4 1.48 6.3l3.99-3.1c-.24-.72-.38-1.5-.38-2.3Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.7-2.87c-1.03.69-2.34 1.1-3.7 1.1-2.94 0-5.59-1.8-6.53-4.62L1.48 17.8C3.4 21.68 7.37 24 12 24Z"
                  />
                </svg>
              </Box>
            }
            sx={{
              py: 1.5,
              borderRadius: '16px',
              fontWeight: 700,
              fontSize: '0.975rem',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 25px rgba(16, 185, 129, 0.35)',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              },
              '&:active': {
                transform: 'translateY(0)',
              },
            }}
          >
            {t('login.sign_in')}
          </Button>
        </Stack>

        {/* Footer info */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            mt: 2,
            opacity: 0.6,
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <Info size={14} />
          <Typography level="body-xs" sx={{ fontWeight: 500 }}>
            {t('login.authorized_only')}
          </Typography>
        </Stack>
      </Sheet>
    </Box>
  );
}
