import React, { useState } from 'react';
import { usePortfolio } from './hooks/usePortfolio';
import { Box, Typography, Sheet, Button, Input, Stack, Tabs, TabList, Tab, Divider, Modal, ModalDialog, DialogTitle, DialogContent, ModalClose, FormControl, FormLabel } from '@mui/joy';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';
import type { Holding } from './HoldingsTable';
import FundametalDashboard from './FundamentalDashboard';
import SummaryTab from './SummaryTab';
import HoldingsTab from './HoldingsTab';
import '../../../styles/yahooPortfolio.css';

export interface PortfolioSummary {
  total_market_value: number;
  total_cost: number;
  cash: number;
  day_change_amt: number;
  day_change_pct: number;
  unrealized_gain_amt: number;
  unrealized_gain_pct: number;
  realized_gain_amt: number;
  total_dividends: number;
  stocks?: {
    total_market_value: number;
    total_cost: number;
    day_change_amt: number;
    day_change_pct: number;
    unrealized_gain_amt: number;
    unrealized_gain_pct: number;
    realized_gain_amt: number;
    total_dividends: number;
  };
}

export const formatCurrency = (val: number | null | undefined, showSign = true, currencySymbol = '$'): string => {
  if (val === null || val === undefined) return '--';
  const sign = showSign ? (val >= 0 ? '+' : '') : '';
  return `${sign}${currencySymbol}${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatPct = (val: number | null | undefined): string => {
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
    date: 'quote_date',
    'trade date': 'date',
    type: 'type', action: 'type', 'transaction type': 'type',
    shares: 'shares', quantity: 'shares', qty: 'shares',
    price: 'price', cost: 'price', rate: 'price', cost_per_share: 'price', 'purchase price': 'price',
    commission: 'commission', fee: 'commission', fees: 'commission',
    note: 'note', notes: 'note', memo: 'note', comment: 'note'
  };

  // If there is no 'trade date' in headers but there is 'date', we map 'date' to 'date'
  if (!headers.includes('trade date') && headers.includes('date')) {
    headerMap['date'] = 'date';
  }

  const normalizedHeaders = headers.map(h => headerMap[h] || h);

  const transactions: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVRow(lines[i]);
    if (values.length < normalizedHeaders.length) continue;

    const tx: any = {};
    normalizedHeaders.forEach((header, index) => {
      tx[header] = values[index];
    });

    // Fallback if trade date was not present but quote date was
    if (!tx.date && tx.quote_date) {
      tx.date = tx.quote_date;
    }

    if (tx.symbol && tx.date && tx.shares && tx.price) {
      // Normalize date format to YYYY-MM-DD
      let dateVal = tx.date.trim();
      if (/^\d{8}$/.test(dateVal)) {
        dateVal = `${dateVal.slice(0, 4)}-${dateVal.slice(4, 6)}-${dateVal.slice(6, 8)}`;
      } else if (dateVal.includes('/')) {
        dateVal = dateVal.replace(/\//g, '-');
      }

      transactions.push({
        symbol: tx.symbol.toUpperCase(),
        date: dateVal,
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
  const { holdings, summary, loading, watchlist, fetchAll } = usePortfolio();

  const [activeTab, setActiveTab] = useState<number>(1);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const [form, setForm] = useState({
    symbol: '',
    shares: '',
    cost: '',
    commission: '',
  });

  const [importStatus, setImportStatus] = useState<{
    importing: boolean;
    error: string | null;
    success: string | null;
  }>({
    importing: false,
    error: null,
    success: null,
  });

  const handleFormChange = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleAddTicker = async () => {
    if (!form.symbol.trim()) return;
    try {
      await fetch(`${API_BASE_URL}/api/portfolio/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: form.symbol.trim().toUpperCase(),
          shares: parseFloat(form.shares) || 0,
          avg_cost: parseFloat(form.cost) || null,
          commission: parseFloat(form.commission) || 0,
          status: parseFloat(form.shares) > 0 ? 'Open' : 'Add',
        }),
      });
      setForm({ symbol: '', shares: '', cost: '', commission: '' });
      setAddModalOpen(false);
      fetchAll();
    } catch (e) { console.error('Failed to add holding:', e); }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus({ importing: true, error: null, success: null });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const transactions = parseCSV(text);

        if (transactions.length === 0) {
          setImportStatus({
            importing: false,
            error: 'No valid transactions found in CSV. Please verify column headers.',
            success: null,
          });
          return;
        }

        const res = await fetch(`${API_BASE_URL}/api/portfolio/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transactions),
        });

        if (res.ok) {
          const result = await res.json();
          setImportStatus({
            importing: false,
            error: null,
            success: `Successfully imported ${result.count} transactions!`,
          });
          fetchAll();
          setTimeout(() => {
            setAddModalOpen(false);
            setImportStatus(prev => ({ ...prev, success: null }));
          }, 2000);
        } else {
          const errorText = await res.text();
          setImportStatus({
            importing: false,
            error: `Import failed: ${errorText}`,
            success: null,
          });
        }
      } catch (error) {
        setImportStatus({
          importing: false,
          error: `Failed to parse CSV file: ${(error as any).message}`,
          success: null,
        });
      }
    };
    reader.readAsText(file);
  };

  const symbolUpper = form.symbol.trim().toUpperCase();
  const inHoldings = holdings.some(h => h.symbol === symbolUpper);
  const inWatchlist = watchlist.some(w => w.symbol === symbolUpper);

  return (
    <Box className="yf-portfolio">

      {/* Tabs */}
      <Box sx={{ mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val as number)} sx={{ bgcolor: 'transparent' }}>
          <TabList
            variant="soft"
            sx={{
              p: 0.5,
              gap: 1,
              borderRadius: '12px',
              bgcolor: 'background.level1',
              width: 'fit-content',
              '& .MuiTab-root': {
                fontWeight: 600,
                fontSize: '0.875rem',
                px: 3,
                py: 1,
                minHeight: 36,
                borderRadius: '8px',
                color: 'text.secondary',
                bgcolor: 'transparent',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&.Mui-selected': {
                  color: 'primary.plainColor',
                  bgcolor: 'background.surface',
                  boxShadow: 'sm',
                },
                '&:hover:not(.Mui-selected)': {
                  color: 'text.primary',
                  bgcolor: 'background.level2',
                }
              }
            }}
          >
            <Tab disableIndicator>Fundamentals</Tab>
            <Tab disableIndicator>Holdings</Tab>
            <Tab disableIndicator>Summary</Tab>
          </TabList>
        </Tabs>
      </Box>

      {/* Summary Tab */}
      {activeTab === 2 && summary && (
        <SummaryTab
          summary={summary}
          holdingsCount={holdings.length}
          openPositionsCount={holdings.filter(h => h.status === 'Open').length}
          holdings={holdings}
        />
      )}

      {/* Holdings Tab */}
      {activeTab === 1 && (
        <HoldingsTab
          holdings={holdings}
          loading={loading}
          onAddTicker={() => setAddModalOpen(true)}
          onDataChange={fetchAll}
        />
      )}

      {/* Fundamentals Tab */}
      {activeTab === 0 && (
        <Box className="tab-pane-active">
          <FundametalDashboard />
        </Box>
      )}

      {/* Add Ticker Modal */}
      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)}>
        <ModalDialog sx={{ ...glassStyle, minWidth: { xs: '90%', sm: 400 }, maxWidth: 460, borderRadius: '20px', p: 3 }}>
          <ModalClose />
          <DialogTitle sx={{ fontWeight: 800, fontSize: '1.3rem', mb: 1 }}>
            {inHoldings ? 'Add Transaction' : 'Add Ticker'}
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl required>
              <FormLabel>Symbol</FormLabel>
              <Input placeholder="e.g. MSFT" value={form.symbol} onChange={handleFormChange('symbol')}
                onKeyDown={e => e.key === 'Enter' && handleAddTicker()} />
            </FormControl>
            {form.symbol.trim() && (
              <Typography level="body-xs" sx={{ mt: -0.5, color: inHoldings ? 'warning.plainColor' : 'success.plainColor', fontWeight: 600 }}>
                {inHoldings 
                  ? '✨ Already in holdings. This will record a new transaction.' 
                  : inWatchlist 
                    ? 'ℹ️ Found in watchlist. This will create a new holding.' 
                    : 'ℹ️ New ticker. This will create a new holding and add it to your watchlist.'}
              </Typography>
            )}
            <FormControl>
              <FormLabel>Shares</FormLabel>
              <Input type="number" placeholder="e.g. 35" value={form.shares} onChange={handleFormChange('shares')} />
            </FormControl>
            <FormControl>
              <FormLabel>Average Cost / Share ($)</FormLabel>
              <Input type="number" placeholder="e.g. 394.40" value={form.cost} onChange={handleFormChange('cost')} />
            </FormControl>
            <FormControl>
              <FormLabel>Commission ($)</FormLabel>
              <Input type="number" placeholder="e.g. 5.00" value={form.commission} onChange={handleFormChange('commission')} />
            </FormControl>
            <Button variant="solid" color={inHoldings ? 'warning' : 'primary'} onClick={handleAddTicker} disabled={!form.symbol.trim()}
              sx={{ mt: 1, borderRadius: '12px', fontWeight: 700 }}>
              {inHoldings ? 'Add Transaction' : 'Add to Portfolio'}
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
                loading={importStatus.importing}
                sx={{ width: '100%', borderRadius: '12px', py: 1, fontWeight: 700 }}
              >
                Upload CSV File
                <input
                  type="file"
                  accept=".csv"
                  hidden
                  onChange={handleCSVUpload}
                  disabled={importStatus.importing}
                />
              </Button>
              {importStatus.error && (
                <Typography level="body-xs" color="danger" sx={{ mt: 1, fontWeight: 600 }}>
                  {importStatus.error}
                </Typography>
              )}
              {importStatus.success && (
                <Typography level="body-xs" color="success" sx={{ mt: 1, fontWeight: 600 }}>
                  {importStatus.success}
                </Typography>
              )}
            </Box>
          </DialogContent>
        </ModalDialog>
      </Modal>
    </Box>
  );
}
