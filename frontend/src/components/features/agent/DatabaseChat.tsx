import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Chip } from '@mui/joy';
import { Terminal } from 'lucide-react';
import { MCP_WORKER_URL, API_BASE_URL } from '../../../config';
import GameCanvas from './game/GameCanvas';

export default function DatabaseChat() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`${MCP_WORKER_URL}/database-chat/status`);
        if (res.ok) {
          const data = await res.json() as { enabled: boolean };
          setIsEnabled(data.enabled);
        } else {
          setIsEnabled(false);
        }
      } catch {
        setIsEnabled(false);
      } finally {
        setCheckingStatus(false);
      }
    }
    checkStatus();
  }, []);

  if (checkingStatus) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 2 }}>
        <CircularProgress size="md" color="success" />
        <Typography level="body-sm" sx={{ opacity: 0.6, fontFamily: "'Press Start 2P', monospace", fontSize: '9px' }}>
          LOADING WORLD...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 'lg' }}>
      <GameCanvas
        isEnabled={isEnabled}
        mcpWorkerUrl={MCP_WORKER_URL}
        apiBaseUrl={API_BASE_URL}
        authToken={authToken}
      />
    </Box>
  );
}
