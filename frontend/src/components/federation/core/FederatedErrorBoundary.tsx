import * as React from 'react';
import { Box, Button, Sheet, Typography, Stack } from '@mui/joy';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class FederatedErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[FederatedErrorBoundary] Caught error loading remote module:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            width: '100%',
            p: 3,
          }}
        >
          <Sheet
            sx={{
              ...glassStyle,
              p: { xs: 3, md: 5 },
              maxWidth: 540,
              width: '100%',
              textAlign: 'center',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: '0 8px 32px rgba(239, 68, 68, 0.1)',
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: '16px',
                bgcolor: 'rgba(239, 68, 68, 0.1)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
                color: '#ef4444',
              }}
            >
              <AlertTriangle size={28} />
            </Box>

            <Typography level="h3" sx={{ mb: 1, fontWeight: 700 }}>
              Simplicity Finance Unavailable
            </Typography>

            <Typography level="body-sm" sx={{ mb: 3, opacity: 0.8, lineHeight: 1.6 }}>
              Unable to connect to the Simplicity Finance remote application.
              Please ensure the remote service is reachable and retry.
            </Typography>

            {this.state.error && (
              <Box
                sx={{
                  mb: 3,
                  p: 1.5,
                  borderRadius: '10px',
                  bgcolor: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  textAlign: 'left',
                  maxHeight: '120px',
                  overflow: 'auto',
                }}
              >
                <Typography level="body-xs" sx={{ fontFamily: 'monospace', color: '#f87171' }}>
                  {this.state.error.message || String(this.state.error)}
                </Typography>
              </Box>
            )}

            <Stack direction="row" spacing={2} justifyContent="center">
              <Button
                variant="solid"
                color="primary"
                startDecorator={<RefreshCw size={16} />}
                onClick={this.handleRetry}
                sx={{
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  fontWeight: 600,
                  px: 3,
                }}
              >
                Retry Connection
              </Button>
            </Stack>
          </Sheet>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default FederatedErrorBoundary;

