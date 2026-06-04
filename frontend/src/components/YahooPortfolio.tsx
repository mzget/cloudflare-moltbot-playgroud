import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Sheet, Button, Input, Stack, Tabs, TabList, Tab, Divider, Modal, ModalDialog, DialogTitle, DialogContent, ModalClose, FormControl, FormLabel } from '@mui/joy';
import { Plus } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { glassStyle } from '../styles/glass';
import HoldingsTable from './HoldingsTable';
import type { Holding } from './HoldingsTable';
import ExpandedRow from './ExpandedRow';
import FundametalDashboard from './FundamentalDashboard';
import PortfolioChart from './PortfolioChart';
import '../styles/yahooPortfolio.css';

interface PortfolioSummary {
  total_market_value: number;
  total_cost: number;
  cash: number;
  day_change_amt: number;
  day_change_pct: number;
  unrealized_gain_amt: number;
  unrealized_gain_pct: number;
  realized_gain_amt: number;
  total_dividends: number;
}

const formatCurrency = (val: number | null | undefined, showSign = true): string => {
  if (val === null || val === undefined) return '--';
  const sign = showSign ? (val >= 0 ? '+' : '') : '';
  return `${sign}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPct = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '--';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
};

function parseCSVRow(text: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map(v => v.replace(/^"|"$/g, '').trim());
}

function parseCSV(text: string): any[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase());

  const headerMap: Record<string, string> = {
    symbol: 'symbol', ticker: 'symbol',
    date: 'date',
    type: 'type', action: 'type',
    shares: 'shares', quantity: 'shares', qty: 'shares',
    price: 'price', cost: 'price', rate: 'price', cost_per_share: 'price',
    commission: 'commission', fee: 'commission', fees: 'commission',
    note: 'note', notes: 'note', memo: 'note'
  };

  const normalizedHeaders = headers.map(h => headerMap[h] || h);

  const transactions: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVRow(lines[i]);
    if (values.length < normalizedHeaders.length) continue;

    const tx: any = {};
    normalizedHeaders.forEach((header, index) => {
      tx[header] = values[index];
    });
    
    if (tx.symbol && tx.date && tx.shares && tx.price) {
      transactions.push({
        symbol: tx.symbol.toUpperCase(),
        date: tx.date,
        type: (tx.type && tx.type.toLowerCase().startsWith('s')) ? 'Sell' : 'Buy',
        shares: parseFloat(tx.shares) || 0,
        price: parseFloat(tx.price) || 0,
        commission: parseFloat(tx.commission) || 0,
        note: tx.note || null
      });
    }
  }
  return transactions;
}


export default function YahooPortfolio() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string>('symbol');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newShares, setNewShares] = useState('');
  const [newCost, setNewCost] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const fetchHoldings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/holdings`);
      if (res.ok) setHoldings(await res.json());
    } catch (e) { console.error('Failed to fetch holdings:', e); }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/summary`);
      if (res.ok) setSummary(await res.json());
    } catch (e) { console.error('Failed to fetch summary:', e); }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchHoldings(), fetchSummary()]);
    setLoading(false);
  }, [fetchHoldings, fetchSummary]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 180000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      const aVal = (a as any)[sortBy];
      const bVal = (b as any)[sortBy];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : (aVal as number) - (bVal as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [holdings, sortBy, sortDir]);

  const handleSort = useCallback((column: string) => {
    if (sortBy === column) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(column); setSortDir('asc'); }
  }, [sortBy]);

  const handleExpandRow = useCallback((symbol: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(symbol) ? next.delete(symbol) : next.add(symbol);
      return next;
    });
  }, []);

  const handleAddTicker = async () => {
    if (!newSymbol.trim()) return;
    try {
      await fetch(`${API_BASE_URL}/api/portfolio/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: newSymbol.trim().toUpperCase(),
          shares: parseFloat(newShares) || 0,
          avg_cost: parseFloat(newCost) || null,
          status: parseFloat(newShares) > 0 ? 'Open' : 'Add',
        }),
      });
      setNewSymbol(''); setNewShares(''); setNewCost('');
      setAddModalOpen(false);
      fetchAll();
    } catch (e) { console.error('Failed to add holding:', e); }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportSuccess(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const transactions = parseCSV(text);

        if (transactions.length === 0) {
          setImportError('No valid transactions found in CSV. Please verify column headers.');
          setImporting(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/api/portfolio/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transactions),
        });

        if (res.ok) {
          const result = await res.json();
          setImportSuccess(`Successfully imported ${result.count} transactions!`);
          fetchAll();
          setTimeout(() => {
            setAddModalOpen(false);
            setImportSuccess(null);
          }, 2000);
        } else {
          const errorText = await res.text();
          setImportError(`Import failed: ${errorText}`);
        }
      } catch (error) {
        setImportError(`Failed to parse CSV file: ${(error as any).message}`);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <Box className="yf-portfolio">
      {/* Portfolio Summary */}
      {summary && (
        <Sheet sx={{ ...glassStyle, p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 3 }}>
            <Box>
              <Typography level="h2" sx={{ fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.02em' }}>
                {formatCurrency(summary.total_market_value, false)}
              </Typography>
              <Typography level="body-sm" sx={{ opacity: 0.6, mt: 0.5 }}>
                <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', bgcolor: 'var(--yf-positive)', mr: 0.75, verticalAlign: 'middle' }} />
                Market Value {formatCurrency(summary.total_market_value, false)}
              </Typography>
              <Divider sx={{ my: 1.5, opacity: 0.15 }} />
              <Stack spacing={0.75}>
                {[
                  { label: 'Day Change', val: summary.day_change_amt, pct: summary.day_change_pct },
                  { label: 'Unrealized G/L', val: summary.unrealized_gain_amt, pct: summary.unrealized_gain_pct },
                ].map(item => (
                  <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                    <Typography level="body-sm" sx={{ opacity: 0.7 }}>{item.label}</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 700 }} className={item.val >= 0 ? 'yf-positive' : 'yf-negative'}>
                      {formatCurrency(item.val)} ({formatPct(item.pct)})
                    </Typography>
                  </Box>
                ))}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
                  <Typography level="body-sm" sx={{ opacity: 0.7 }}>Realized G/L</Typography>
                  <Typography level="body-sm" sx={{ fontWeight: 700 }} className={summary.realized_gain_amt >= 0 ? 'yf-positive' : 'yf-negative'}>
                    {formatCurrency(summary.realized_gain_amt)}
                  </Typography>
                </Box>
              </Stack>
            </Box>
            <Box sx={{ flex: 1, minWidth: 300, maxWidth: 600, width: '100%', display: 'block' }}>
              <PortfolioChart />
            </Box>
          </Box>
        </Sheet>
      )}

      {/* Tabs + Add Button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val as number)} sx={{ bgcolor: 'transparent' }}>
          <TabList disableUnderline sx={{ gap: 0, borderBottom: '1px solid', borderColor: 'divider',
            '& .MuiTab-root': { fontWeight: 600, fontSize: '0.875rem', px: 2, py: 1, minHeight: 40,
              '&[aria-selected="true"]': { color: 'primary.plainColor', borderBottom: '2px solid', borderColor: 'primary.plainColor' },
              '&:hover': { bgcolor: 'transparent', color: 'text.primary' } } }}>
            <Tab disableIndicator>Fundamentals</Tab>
            <Tab disableIndicator>Holdings</Tab>
            <Tab disableIndicator>Summary</Tab>
          </TabList>
        </Tabs>
        <Button variant="outlined" color="neutral" size="sm" startDecorator={<Plus size={16} />}
          onClick={() => setAddModalOpen(true)} sx={{ borderRadius: '20px', fontWeight: 600, px: 2 }}>
          Add tickers
        </Button>
      </Box>

      {/* Summary Tab */}
      {activeTab === 2 && summary && (
        <Sheet sx={{ ...glassStyle, p: 3 }}>
          <Typography level="h4" sx={{ mb: 2, fontWeight: 700 }}>Portfolio Summary</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            {[
              { label: 'Total Market Value', value: formatCurrency(summary.total_market_value, false) },
              { label: 'Total Cost Basis', value: formatCurrency(summary.total_cost, false) },
              { label: 'Day Change', value: formatCurrency(summary.day_change_amt), cls: summary.day_change_amt >= 0 ? 'yf-positive' : 'yf-negative' },
              { label: 'Unrealized G/L', value: formatCurrency(summary.unrealized_gain_amt), cls: summary.unrealized_gain_amt >= 0 ? 'yf-positive' : 'yf-negative' },
            ].map(card => (
              <Box key={card.label} sx={{ p: 2, borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
                <Typography level="body-xs" sx={{ opacity: 0.6, mb: 0.5 }}>{card.label}</Typography>
                <Typography level="h4" sx={{ fontWeight: 800 }} className={card.cls || ''}>{card.value}</Typography>
              </Box>
            ))}
          </Box>
          <Typography level="body-sm" sx={{ opacity: 0.5, mt: 2 }}>
            {holdings.length} holdings · {holdings.filter(h => h.status === 'Open').length} open positions
          </Typography>
        </Sheet>
      )}

      {/* Holdings Tab */}
      {activeTab === 1 && (
        <Sheet sx={{ ...glassStyle, p: 0, overflow: 'hidden' }}>
          <Box sx={{ overflowX: 'auto' }}>
            <HoldingsTable holdings={sortedHoldings} onExpandRow={handleExpandRow} expandedRows={expandedRows}
              sortBy={sortBy} sortDir={sortDir} onSort={handleSort}
              expandedContent={(symbol: string, lastPrice: number | null, colSpan: number) => (
                <ExpandedRow symbol={symbol} lastPrice={lastPrice} colSpan={colSpan} onDataChange={fetchAll} />
              )} />
          </Box>
          {holdings.length === 0 && !loading && (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography level="h4" sx={{ mb: 1, opacity: 0.6 }}>No holdings yet</Typography>
              <Typography level="body-sm" sx={{ mb: 3, opacity: 0.4 }}>Add tickers to start tracking your portfolio</Typography>
              <Button variant="solid" color="primary" startDecorator={<Plus size={16} />} onClick={() => setAddModalOpen(true)}>
                Add your first ticker
              </Button>
            </Box>
          )}
        </Sheet>
      )}

      {/* Fundamentals Tab */}
      {activeTab === 0 && <FundametalDashboard />}

      {/* Add Ticker Modal */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)}>
        <ModalDialog sx={{ ...glassStyle, minWidth: { xs: '90%', sm: 400 }, maxWidth: 460, borderRadius: '20px', p: 3 }}>
          <ModalClose />
          <DialogTitle sx={{ fontWeight: 800, fontSize: '1.3rem', mb: 1 }}>Add Ticker</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl required>
              <FormLabel>Symbol</FormLabel>
              <Input placeholder="e.g. MSFT" value={newSymbol} onChange={e => setNewSymbol(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTicker()} />
            </FormControl>
            <FormControl>
              <FormLabel>Shares</FormLabel>
              <Input type="number" placeholder="e.g. 35" value={newShares} onChange={e => setNewShares(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel>Average Cost / Share ($)</FormLabel>
              <Input type="number" placeholder="e.g. 394.40" value={newCost} onChange={e => setNewCost(e.target.value)} />
            </FormControl>
            <Button variant="solid" color="primary" onClick={handleAddTicker} disabled={!newSymbol.trim()}
              sx={{ mt: 1, borderRadius: '12px', fontWeight: 700 }}>
              Add to Portfolio
            </Button>
            <Divider sx={{ my: 1 }}>OR</Divider>
            <Box>
              <FormLabel sx={{ mb: 1, fontWeight: 600 }}>Bulk Import from CSV</FormLabel>
              <Typography level="body-xs" sx={{ opacity: 0.6, mb: 1.5 }}>
                CSV headers: Symbol, Date, Type (Buy/Sell), Shares, Price. Optional: Commission, Note.
              </Typography>
              <Button
                variant="outlined"
                color="neutral"
                component="label"
                loading={importing}
                sx={{ width: '100%', borderRadius: '12px', py: 1, fontWeight: 700 }}
              >
                Upload CSV File
                <input
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={handleCSVUpload}
                  disabled={importing}
                />
              </Button>
              {importError && (
                <Typography level="body-xs" color="danger" sx={{ mt: 1, fontWeight: 600 }}>
                  {importError}
                </Typography>
              )}
              {importSuccess && (
                <Typography level="body-xs" color="success" sx={{ mt: 1, fontWeight: 600 }}>
                  {importSuccess}
                </Typography>
              )}
            </Box>
          </DialogContent>
        </ModalDialog>
      </Modal>
    </Box>
  );
}
