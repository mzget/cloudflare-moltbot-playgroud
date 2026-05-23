import React, { useState, useEffect } from 'react';
import { Box, Typography, Sheet, IconButton, Button, Input, Stack, Card, CardContent, Divider, Switch, Grid, CardActions, Avatar } from '@mui/joy';
import { Plus, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface WatchlistItem {
  symbol: string;
  name: string;
  is_active: number;
  in_portfolio: number;
}

import { glassStyle } from '../styles/glass';

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');

  const fetchWatchlist = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/watchlist`);
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data);
      }
    } catch (e) {
      console.error("Failed to fetch watchlist", e);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const handleAdd = async () => {
    if (!newSymbol) return;
    try {
      await fetch(`${API_BASE_URL}/api/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: newSymbol.toUpperCase(), name: newName })
      });
      setNewSymbol('');
      setNewName('');
      fetchWatchlist();
    } catch (e) {
      console.error("Failed to add to watchlist", e);
    }
  };

  const handleDelete = async (symbol: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/watchlist?symbol=${symbol}`, { method: 'DELETE' });
      fetchWatchlist();
    } catch (e) {
      console.error("Failed to delete from watchlist", e);
    }
  };

  const handleToggleActive = async (symbol: string, currentStatus: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/watchlist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, is_active: !currentStatus })
      });
      fetchWatchlist();
    } catch (e) {
      console.error("Failed to toggle watchlist status", e);
    }
  };

  const handleTogglePortfolio = async (symbol: string, currentPortfolioStatus: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/watchlist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, in_portfolio: !currentPortfolioStatus })
      });
      fetchWatchlist();
    } catch (e) {
      console.error("Failed to toggle portfolio status", e);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography level="h3" sx={{ mb: 3 }}>Investment Watchlist</Typography>

      <Sheet sx={{ ...glassStyle, p: 2, mb: 4 }}>
        <Stack spacing={2}>
          <Typography level="title-sm" sx={{ opacity: 0.6 }}>Add New Security</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Input 
              placeholder="Symbol (e.g. AAPL)" 
              value={newSymbol} 
              onChange={e => setNewSymbol(e.target.value)}
              sx={{ flex: 1 }}
            />
            <Input 
              placeholder="Company Name" 
              value={newName} 
              onChange={e => setNewName(e.target.value)}
              sx={{ flex: 2 }}
            />
            <Button 
              variant="solid" 
              color="success" 
              onClick={handleAdd}
              startDecorator={<Plus size={18} />}
            >
              Add
            </Button>
          </Stack>
        </Stack>
      </Sheet>

      <Grid container spacing={2}>
        {watchlist.map((item) => (
          <Grid key={item.symbol} xs={12} sm={12} md={4}>
            <Card 
              sx={{ 
                ...glassStyle, 
                border: item.in_portfolio ? '1.5px solid rgba(46, 204, 113, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: item.in_portfolio 
                  ? '0 0 12px rgba(46, 204, 113, 0.15), 0 4px 20px rgba(0,0,0,0.08)' 
                  : '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.3s ease-in-out',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar 
                      src={`https://images.financialmodelingprep.com/symbol/${item.symbol}.png`}
                      alt={item.symbol}
                      variant="outlined"
                      size="md"
                      sx={{ 
                        bgcolor: 'background.surface',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                        borderRadius: 'md',
                        width: 40,
                        height: 40,
                        '--Avatar-size': '40px'
                      }}
                    >
                      {item.symbol.substring(0, 2)}
                    </Avatar>
                    <Box>
                      <Typography level="title-lg" sx={{ fontWeight: '700', letterSpacing: '0.5px', lineHeight: 1.2 }}>{item.symbol}</Typography>
                      <Typography level="body-sm" sx={{ opacity: 0.7, fontWeight: '500' }}>{item.name}</Typography>
                    </Box>
                  </Stack>
                  <IconButton 
                    color="danger" 
                    variant="plain" 
                    onClick={() => handleDelete(item.symbol)}
                    sx={{ 
                      opacity: 0.6, 
                      transition: 'opacity 0.2s', 
                      '&:hover': { opacity: 1, backgroundColor: 'rgba(231, 76, 60, 0.1)' } 
                    }}
                  >
                    <Trash2 size={18} />
                  </IconButton>
                </Stack>

                <Divider sx={{ my: 1.5, opacity: 0.15 }} />

                <CardActions sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 0, mt: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography level="body-xs" sx={{ fontWeight: '600', opacity: 0.7 }}>Active</Typography>
                    <Switch 
                      checked={!!item.is_active} 
                      onChange={() => handleToggleActive(item.symbol, item.is_active)} 
                      color={item.is_active ? 'success' : 'neutral'}
                      size="sm"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography level="body-xs" sx={{ fontWeight: '600', opacity: 0.7 }}>In Portfolio</Typography>
                    <Switch 
                      checked={!!item.in_portfolio} 
                      onChange={() => handleTogglePortfolio(item.symbol, item.in_portfolio)} 
                      color={item.in_portfolio ? 'success' : 'neutral'}
                      size="sm"
                    />
                  </Box>
                </CardActions>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
