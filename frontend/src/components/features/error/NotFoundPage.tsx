import * as React from 'react';
import { Box, Button, Sheet, Typography, Stack } from '@mui/joy';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Home, Compass } from 'lucide-react';
import OaktreeIcon from '../../common/OaktreeIcon';
import { glassStyle } from '../../../styles/glass';

export default function NotFoundPage() {
  const navigate = useNavigate();
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
      {/* Background decorative gradients — matching LoginScreen */}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: { xs: '250px', md: '450px' },
          height: { xs: '250px', md: '450px' },
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '10%',
          right: '5%',
          width: { xs: '200px', md: '400px' },
          height: { xs: '200px', md: '400px' },
          background: 'radial-gradient(circle, rgba(5, 150, 105, 0.07) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <Sheet
        sx={{
          ...glassStyle,
          p: { xs: 4, md: 6 },
          maxWidth: '520px',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          zIndex: 1,
          backdropFilter: 'blur(30px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s ease',
          '&:hover': {
            borderColor: 'rgba(16, 185, 129, 0.2)',
            boxShadow: '0 32px 80px rgba(16, 185, 129, 0.05)',
          },
        }}
      >
        {/* Logo + error code */}
        <Stack alignItems="center" spacing={2}>
          <Box
            sx={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.1) 100%)',
              p: 2,
              borderRadius: '24px',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'inline-flex',
              position: 'relative',
            }}
          >
            <OaktreeIcon color="#10b981" size={48} />
            {/* Small compass badge */}
            <Box
              sx={{
                position: 'absolute',
                bottom: -6,
                right: -6,
                bgcolor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                p: '5px',
                display: 'flex',
                alignItems: 'center',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Compass size={16} color="#10b981" />
            </Box>
          </Box>

          {/* 404 number */}
          <Typography
            sx={{
              fontSize: { xs: '5rem', md: '7rem' },
              fontWeight: 900,
              fontFamily: 'Outfit, sans-serif',
              lineHeight: 1,
              letterSpacing: '-0.04em',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, rgba(16,185,129,0.4) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              userSelect: 'none',
            }}
          >
            404
          </Typography>
        </Stack>

        {/* Text */}
        <Stack spacing={1.5} sx={{ width: '100%' }}>
          <Typography
            level="h3"
            sx={{
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            {t('not_found.title')}
          </Typography>
          <Typography
            level="body-md"
            sx={{ color: 'text.secondary', lineHeight: 1.6 }}
          >
            {t('not_found.description')}
          </Typography>
        </Stack>

        {/* Divider line */}
        <Box
          sx={{
            width: '100%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.3), transparent)',
          }}
        />

        {/* Path display */}
        <Box
          sx={{
            bgcolor: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            borderRadius: '12px',
            px: 2,
            py: 1,
            width: '100%',
          }}
        >
          <Typography
            level="body-xs"
            sx={{
              fontFamily: 'monospace',
              color: '#10b981',
              opacity: 0.8,
              letterSpacing: '0.05em',
              wordBreak: 'break-all',
            }}
          >
            {typeof window !== 'undefined' ? window.location.pathname : '/unknown'}
          </Typography>
        </Box>

        {/* Actions */}
        <Button
          size="lg"
          variant="solid"
          startDecorator={<Home size={18} />}
          onClick={() => navigate({ to: '/dashboard' })}
          sx={{
            width: '100%',
            py: 1.5,
            borderRadius: '16px',
            fontWeight: 700,
            fontSize: '0.975rem',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            boxShadow: '0 4px 20px rgba(16, 185, 129, 0.2)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
          {t('not_found.go_home')}
        </Button>
      </Sheet>
    </Box>
  );
}
