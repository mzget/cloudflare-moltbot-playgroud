import React, { useState } from 'react';
import { Button, Tooltip, Stack, Typography } from '@mui/joy';
import { Play, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../../../config';

export default function ManualTrigger() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleTrigger = async (type: 'crawl' | 'run-all' | 'sync-notebook') => {
    setStatus('loading');
    setMessage('');

    try {
      let endpoint = '';
      let method = 'GET';
      
      if (type === 'crawl') {
        endpoint = '/api/crawl';
      } else if (type === 'run-all') {
        endpoint = '/api/summarize-all';
      } else if (type === 'sync-notebook') {
        endpoint = '/api/test-notebook-sync';
        method = 'POST';
      }
      
      const url = `${API_BASE_URL}${endpoint}`;
      
      const response = await fetch(url, { method });

      if (response.ok) {
        setStatus('success');
        if (type === 'crawl') {
          setMessage('Crawler & Reports started');
        } else if (type === 'run-all') {
          setMessage('Summaries regenerating...');
        } else if (type === 'sync-notebook') {
          setMessage('NotebookLM sync completed successfully');
        }
        setTimeout(() => {
          setStatus('idle');
          setMessage('');
        }, 5000);
      } else {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 5000);
      }
    } catch (e) {
      console.error("Trigger failed", e);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ gap: 1 }}>
        <Tooltip title="Trigger manual news crawl" variant="soft">
          <Button
            variant="soft"
            onClick={() => handleTrigger('crawl')}
            loading={status === 'loading' && message === ''}
            disabled={status === 'loading'}
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
            Sync News
          </Button>
        </Tooltip>

        <Tooltip title="Generate AI Summaries for Watchlist" variant="soft">
          <Button
            variant="soft"
            onClick={() => handleTrigger('run-all')}
            loading={status === 'loading' && message === ''}
            disabled={status === 'loading'}
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

        <Tooltip title="Sync NotebookLM Articles & Post to Facebook" variant="soft">
          <Button
            variant="soft"
            onClick={() => handleTrigger('sync-notebook')}
            loading={status === 'loading' && message === 'NotebookLM sync completed successfully'}
            disabled={status === 'loading'}
            startDecorator={<RefreshCw size={16} />}
            size="sm"
            sx={{ 
              borderRadius: '12px',
              fontWeight: 600,
              border: '1px solid rgba(24, 119, 242, 0.2)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': { 
                bgcolor: 'rgba(24, 119, 242, 0.2)',
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(24, 119, 242, 0.15)'
              }
            }}
          >
            Sync NotebookLM
          </Button>
        </Tooltip>
      </Stack>
      {message && (
        <Typography level="body-xs" sx={{ color: 'success.plainColor', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <CheckCircle2 size={14} /> {message}
        </Typography>
      )}
      {status === 'error' && (
        <Typography level="body-xs" sx={{ color: 'danger.plainColor', display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <AlertCircle size={14} /> Action failed
        </Typography>
      )}
    </Stack>
  );
}
