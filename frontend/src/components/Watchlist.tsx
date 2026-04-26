import React, { useState, useEffect } from 'react';
import { Box, Typography, Sheet, IconButton, Button, Input, Stack, Card, CardContent, Divider } from '@mui/joy';
import { Plus, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface WatchlistItem {
  symbol: string;
  name: string;
}

const glassStyle = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '16px',
};

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');

  const fetchWatchlist = async () => {
    try {
      const res = await fetch('http://localhost:8787/api/watchlist');
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
      await fetch('http://localhost:8787/api/watchlist', {
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
      await fetch(`http://localhost:8787/api/watchlist?symbol=${symbol}`, { method: 'DELETE' });
      fetchWatchlist();
    } catch (e) {
      console.error("Failed to delete from watchlist", e);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography level="h3" sx={{ color: 'white', mb: 3 }}>Investment Watchlist</Typography>

      <Sheet sx={{ ...glassStyle, p: 2, mb: 4 }}>
        <Stack spacing={2}>
          <Typography level="title-sm" sx={{ color: 'rgba(255,255,255,0.6)' }}>Add New Security</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Input 
              placeholder="Symbol (e.g. AAPL)" 
              value={newSymbol} 
              onChange={e => setNewSymbol(e.target.value)}
              sx={{ flex: 1, bgcolor: 'rgba(255,255,255,0.05)', color: 'white' }}
            />
            <Input 
              placeholder="Company Name" 
              value={newName} 
              onChange={e => setNewName(e.target.value)}
              sx={{ flex: 2, bgcolor: 'rgba(255,255,255,0.05)', color: 'white' }}
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

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {watchlist.map((item) => (
          <Card key={item.symbol} sx={{ ...glassStyle }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography level="h4" sx={{ color: 'white' }}>{item.symbol}</Typography>
                  <Typography level="body-sm" sx={{ color: 'rgba(255,255,255,0.6)' }}>{item.name}</Typography>
                </Box>
                <IconButton color="danger" variant="plain" onClick={() => handleDelete(item.symbol)}>
                  <Trash2 size={20} />
                </IconButton>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
