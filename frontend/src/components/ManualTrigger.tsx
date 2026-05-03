import React, { useState } from 'react';
import { Button, Tooltip, Stack, Typography } from '@mui/joy';
import { Play, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function ManualTrigger() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleTrigger = async (type: 'crawl' | 'run-all') => {
    setStatus('loading');
    setMessage('');

    try {
      const endpoint = type === 'crawl' ? '/api/crawl' : '/api/summarize-all';
      const url = `http://localhost:8787${endpoint}`;
      
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
    <Stack direction="row" spacing={1}>
      <Tooltip title="Trigger manual news crawl" variant="soft">
        <Button
          variant="soft"
          onClick={() => handleTrigger('crawl')}
          loading={status === 'loading'}
          startDecorator={<RefreshCw size={16} />}
          size="sm"
          sx={{ 
            bgcolor: 'rgba(255,255,255,0.05)', 
            color: 'white',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
          }}
        >
          {status === 'loading' ? 'Syncing...' : 'Sync News'}
        </Button>
      </Tooltip>

      <Tooltip title="Generate AI Summaries for Watchlist" variant="soft">
        <Button
          variant="soft"
          color="primary"
          onClick={() => handleTrigger('run-all')}
          loading={status === 'loading'}
          startDecorator={<Play size={16} />}
          size="sm"
          sx={{ 
            bgcolor: 'rgba(25, 118, 210, 0.2)', 
            color: '#90caf9',
            '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.3)' }
          }}
        >
          Generate Reports
        </Button>
      </Tooltip>
    </Stack>
  );
}
