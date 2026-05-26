import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Sheet, IconButton, Button, Input, Stack, Card, CardContent, Divider, Switch, Grid, CardActions, Avatar, Modal, ModalDialog, DialogTitle, DialogContent, ModalClose, FormControl, FormLabel, Select, Option, FormHelperText, Badge } from '@mui/joy';
import { Plus, Trash2, Bell } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface WatchlistItem {
  symbol: string;
  name: string;
  is_active: number;
  in_portfolio: number;
  active_alerts_count?: number;
}

import { glassStyle } from '../styles/glass';

export default function Watchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [marketStats, setMarketStats] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('watchlist_sort_by');
      if (saved && ['symbol', 'symbol-desc', 'name', 'in_portfolio', 'is_active'].includes(saved)) {
        return saved;
      }
    }
    return 'symbol';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('watchlist_sort_by', sortBy);
    }
  }, [sortBy]);

  const sortedWatchlist = useMemo(() => {
    return [...watchlist].sort((a, b) => {
      if (sortBy === 'symbol') {
        return a.symbol.localeCompare(b.symbol);
      }
      if (sortBy === 'symbol-desc') {
        return b.symbol.localeCompare(a.symbol);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'in_portfolio') {
        if (a.in_portfolio !== b.in_portfolio) {
          return b.in_portfolio - a.in_portfolio; // In Portfolio (1) first
        }
        return a.symbol.localeCompare(b.symbol);
      }
      if (sortBy === 'is_active') {
        if (a.is_active !== b.is_active) {
          return b.is_active - a.is_active; // Active (1) first
        }
        return a.symbol.localeCompare(b.symbol);
      }
      return 0;
    });
  }, [watchlist, sortBy]);

  // Alert Modal State
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [symbolRules, setSymbolRules] = useState<any[]>([]);
  const [newRuleMetric, setNewRuleMetric] = useState('price');
  const [newRuleCondition, setNewRuleCondition] = useState('cross_up');
  const [newRuleTarget, setNewRuleTarget] = useState('');

  const fetchMarketStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/market-intelligence`);
      if (res.ok) {
        const data = await res.json();
        setMarketStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch market stats", e);
    }
  };

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

  const fetchRulesForSymbol = async (symbol: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        setSymbolRules(data);
      }
    } catch (e) {
      console.error("Failed to fetch alert rules", e);
    }
  };

  const handleOpenAlertsModal = (symbol: string) => {
    setSelectedSymbol(symbol);
    fetchRulesForSymbol(symbol);
    setNewRuleMetric('price');
    setNewRuleCondition('cross_up');
    setNewRuleTarget('');
    setIsAlertsModalOpen(true);
  };

  const handleCreateRule = async () => {
    if (!selectedSymbol || !newRuleTarget || isNaN(Number(newRuleTarget))) return;
    
    let targetVal = Number(newRuleTarget);
    if (newRuleMetric === 'market_cap') {
      // User inputs in Billions, DB stores in Millions
      targetVal = targetVal * 1000;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedSymbol,
          metric: newRuleMetric,
          condition_type: newRuleCondition,
          target_value: targetVal
        })
      });
      if (res.ok) {
        setNewRuleTarget('');
        fetchRulesForSymbol(selectedSymbol);
        fetchWatchlist();
      }
    } catch (e) {
      console.error("Failed to create alert rule", e);
    }
  };

  const handleToggleRule = async (ruleId: number, currentStatus: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ruleId,
          is_active: currentStatus === 1 ? 0 : 1
        })
      });
      if (res.ok && selectedSymbol) {
        fetchRulesForSymbol(selectedSymbol);
        fetchWatchlist();
      }
    } catch (e) {
      console.error("Failed to toggle alert rule", e);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/alerts?id=${ruleId}`, {
        method: 'DELETE'
      });
      if (res.ok && selectedSymbol) {
        fetchRulesForSymbol(selectedSymbol);
        fetchWatchlist();
      }
    } catch (e) {
      console.error("Failed to delete alert rule", e);
    }
  };

  const formatMetricLabel = (m: string) => {
    switch(m) {
      case 'price': return 'Price';
      case 'market_cap': return 'Market Cap';
      case 'p_e': return 'P/E';
      case 'ev_ebit': return 'EV/EBIT';
      case 'ev_sales': return 'EV/Sales';
      default: return m;
    }
  };

  const formatTargetValue = (val: number, metric: string) => {
    if (metric === 'market_cap') {
      return `$${(val / 1000).toFixed(2)}B`;
    }
    if (metric === 'price') {
      return `$${val.toFixed(2)}`;
    }
    return val.toFixed(2);
  };

  const formatConditionLabel = (cond: string) => {
    return cond === 'cross_up' ? 'Crosses Up' : 'Crosses Down';
  };

  const currentSymbolStats = marketStats.find(s => s.symbol === selectedSymbol);

  const getHelperTextForMetric = (metric: string) => {
    if (!currentSymbolStats) return 'No current data available';
    let val: number | null = null;
    if (metric === 'price') {
      val = currentSymbolStats.price;
      return val !== null ? `Current Price: $${val.toFixed(2)}` : 'Current Price: N/A';
    }
    if (metric === 'market_cap') {
      val = currentSymbolStats.market_cap;
      return val !== null ? `Current Market Cap: $${(val / 1000).toFixed(2)}B` : 'Current Market Cap: N/A';
    }
    if (metric === 'p_e') {
      val = currentSymbolStats.p_e;
      return val !== null ? `Current P/E: ${val.toFixed(2)}` : 'Current P/E: N/A';
    }
    if (metric === 'ev_ebit') {
      val = currentSymbolStats.ev_ebit;
      return val !== null ? `Current EV/EBIT: ${val.toFixed(2)}` : 'Current EV/EBIT: N/A';
    }
    if (metric === 'ev_sales') {
      val = currentSymbolStats.ev_sales;
      return val !== null ? `Current EV/Sales: ${val.toFixed(2)}` : 'Current EV/Sales: N/A';
    }
    return '';
  };

  useEffect(() => {
    fetchWatchlist();
    fetchMarketStats();
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

      <Stack 
        direction={{ xs: 'column', sm: 'row' }} 
        justifyContent="space-between" 
        alignItems={{ xs: 'flex-start', sm: 'center' }} 
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Typography level="title-md" sx={{ opacity: 0.6 }}>
          {watchlist.length} {watchlist.length === 1 ? 'Security' : 'Securities'}
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <Typography level="body-sm" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Sort By:</Typography>
          <Select
            value={sortBy}
            onChange={(_, val) => setSortBy(val || 'symbol')}
            size="sm"
            sx={{ 
              minWidth: 180, 
              flex: { xs: 1, sm: 'none' },
              ...glassStyle,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.15)'
              }
            }}
          >
            <Option value="symbol">Symbol (A-Z)</Option>
            <Option value="symbol-desc">Symbol (Z-A)</Option>
            <Option value="name">Company Name (A-Z)</Option>
            <Option value="in_portfolio">In Portfolio First</Option>
            <Option value="is_active">Active First</Option>
          </Select>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {sortedWatchlist.map((item) => (
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
                  <Stack direction="row" spacing={0.5}>
                    <Badge
                      badgeContent={item.active_alerts_count}
                      invisible={!item.active_alerts_count}
                      color="warning"
                      size="sm"
                      variant="solid"
                      sx={{
                        '& .MuiBadge-badge': {
                          right: 2,
                          top: 2,
                          boxShadow: '0 0 8px rgba(245, 158, 11, 0.4)',
                        }
                      }}
                    >
                      <IconButton 
                        color={item.active_alerts_count ? "warning" : "neutral"} 
                        variant="plain" 
                        onClick={() => handleOpenAlertsModal(item.symbol)}
                        sx={{ 
                          opacity: item.active_alerts_count ? 1 : 0.8,
                          transition: 'all 0.2s', 
                          '&:hover': { opacity: 1, backgroundColor: 'rgba(0,0,0,0.05)', color: '#10b981' } 
                        }}
                      >
                        <Bell 
                          size={18} 
                          className={item.active_alerts_count ? "animate-bell-ring" : ""}
                          fill={item.active_alerts_count ? "currentColor" : "none"}
                        />
                      </IconButton>
                    </Badge>
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

      {/* Alert Rules Manager Modal */}
      <Modal open={isAlertsModalOpen} onClose={() => setIsAlertsModalOpen(false)}>
        <ModalDialog
          sx={{
            ...glassStyle,
            minWidth: { xs: '90%', sm: 480 },
            maxWidth: 500,
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
            p: 3,
          }}
        >
          <ModalClose />
          <DialogTitle sx={{ fontWeight: 800, fontSize: '1.4rem', letterSpacing: '-0.02em', mb: 1 }}>
            Alert Manager: {selectedSymbol}
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Create Rule Form */}
            <Box sx={{ p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography level="title-sm" sx={{ mb: 1.5, fontWeight: 700 }}>Create New Alert</Typography>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.5}>
                  <FormControl sx={{ flex: 1 }}>
                    <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Metric</FormLabel>
                    <Select
                      value={newRuleMetric}
                      onChange={(_, val) => setNewRuleMetric(val || 'price')}
                      size="sm"
                    >
                      <Option value="price">Price ($)</Option>
                      <Option value="market_cap">Market Cap ($B)</Option>
                      <Option value="p_e">P/E Ratio</Option>
                      <Option value="ev_ebit">EV/EBIT</Option>
                      <Option value="ev_sales">EV/Sales</Option>
                    </Select>
                  </FormControl>

                  <FormControl sx={{ flex: 1 }}>
                    <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Condition</FormLabel>
                    <Select
                      value={newRuleCondition}
                      onChange={(_, val) => setNewRuleCondition(val || 'cross_up')}
                      size="sm"
                    >
                      <Option value="cross_up">Crosses Up</Option>
                      <Option value="cross_down">Crosses Down</Option>
                    </Select>
                  </FormControl>
                </Stack>

                <FormControl>
                  <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Target Value</FormLabel>
                  <Stack direction="row" spacing={1}>
                    <Input
                      type="number"
                      placeholder="e.g. 150"
                      value={newRuleTarget}
                      onChange={e => setNewRuleTarget(e.target.value)}
                      size="sm"
                      sx={{ flex: 1 }}
                    />
                    <Button
                      variant="solid"
                      color="success"
                      onClick={handleCreateRule}
                      size="sm"
                    >
                      Add
                    </Button>
                  </Stack>
                  <FormHelperText sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 500, mt: 0.5 }}>
                    {getHelperTextForMetric(newRuleMetric)}
                  </FormHelperText>
                </FormControl>
              </Stack>
            </Box>

            {/* Existing Rules List */}
            <Box>
              <Typography level="title-sm" sx={{ mb: 1.5, fontWeight: 700 }}>Active Rules</Typography>
              {symbolRules.length === 0 ? (
                <Typography level="body-sm" sx={{ color: 'text.tertiary', fontStyle: 'italic', textAlign: 'center', py: 2 }}>
                  No alert rules set for this symbol.
                </Typography>
              ) : (
                <Stack spacing={1} sx={{ maxHeight: 200, overflowY: 'auto', pr: 0.5 }}>
                  {symbolRules.map(rule => (
                    <Box
                      key={rule.id}
                      sx={{
                        p: 1.5,
                        borderRadius: '10px',
                        border: '1px solid',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        bgcolor: rule.is_active ? 'transparent' : 'rgba(0,0,0,0.02)',
                        opacity: rule.is_active ? 1 : 0.7
                      }}
                    >
                      <Box>
                        <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                          {formatMetricLabel(rule.metric)} {formatConditionLabel(rule.condition_type)} {formatTargetValue(rule.target_value, rule.metric)}
                        </Typography>
                        {rule.last_checked_value !== null && (
                          <Typography level="body-xs" sx={{ color: 'text.tertiary', mt: 0.25 }}>
                            Last Checked: {formatTargetValue(rule.last_checked_value, rule.metric)}
                          </Typography>
                        )}
                      </Box>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Switch
                          size="sm"
                          checked={rule.is_active === 1}
                          onChange={() => handleToggleRule(rule.id, rule.is_active)}
                          color={rule.is_active === 1 ? 'success' : 'neutral'}
                        />
                        <IconButton
                          size="sm"
                          color="danger"
                          variant="plain"
                          onClick={() => handleDeleteRule(rule.id)}
                          sx={{ '&:hover': { bgcolor: 'rgba(231, 76, 60, 0.1)' } }}
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </DialogContent>
        </ModalDialog>
      </Modal>
    </Box>
  );
}
