import React, { useState } from 'react';
import { Button, Tooltip, Stack, Typography } from '@mui/joy';
import { Play, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function ManualTrigger() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleTrigger = async (type: 'crawl' | 'run-all') => {
    setStatus('loading');
    setMessage('');

    try {
      const endpoint = type === 'crawl' ? '/api/crawl' : '/api/summarize-all';
      const url = `${API_BASE_URL}${endpoint}`;
      
      const response = await fetch(url);

      if (response.ok) {
        setStatus('success');
        setMessage(type === 'crawl' ? 'Crawler & Reports started' : 'Summaries regenerating...');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
      }
    } catch (e) {
      console.error("Trigger failed", e);
      setStatus('error');
    }
  };

  return (
    <Stack direction="row" spacing={1.5}>
      <Tooltip title="Trigger manual news crawl" variant="soft">
        <Button
          variant="soft"
          onClick={() => handleTrigger('crawl')}
          loading={status === 'loading'}
          startDecorator={<RefreshCw size={16} />}
          size="sm"
          sx={{ 
            borderRadius: '12px',
            fontWeight: 600,
            border: '1px solid rgba(16, 185, 129, 0.2)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': { 
              bgcolor: 'rgba(16, 185, 129, 0.2)',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)'
            }
          }}
        >
          {status === 'loading' ? 'Syncing...' : 'Sync News'}
        </Button>
      </Tooltip>

      <Tooltip title="Generate AI Summaries for Watchlist" variant="soft">
        <Button
          variant="soft"
          onClick={() => handleTrigger('run-all')}
          loading={status === 'loading'}
          startDecorator={<Play size={16} />}
          size="sm"
          sx={{ 
            borderRadius: '12px',
            fontWeight: 600,
            border: '1px solid rgba(99, 102, 241, 0.2)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': { 
              bgcolor: 'rgba(99, 102, 241, 0.2)',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)'
            }
          }}
        >
          Generate Reports
        </Button>
      </Tooltip>
    </Stack>
  );
}
