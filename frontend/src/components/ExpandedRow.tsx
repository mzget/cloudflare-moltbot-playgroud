import * as React from 'react';
import { Box, Typography, Input, Select, Option, Button } from '@mui/joy';
import { Plus, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import '../styles/yahooPortfolio.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpandedRowProps {
  symbol: string;
  lastPrice: number | null;
  colSpan: number;
  onDataChange?: () => void;
}

interface Lot {
  id?: number;
  date: string;
  shares: number;
  cost_per_share: number;
  total_cost: number;
  market_value: number | null;
  day_gain_pct: number | null;
  day_gain_amt: number | null;
  tot_gain_pct: number | null;
  tot_gain_amt: number | null;
  low_limit: number | null;
  high_limit: number | null;
  note: string;
}

interface Transaction {
  id?: number;
  date: string;
  type: 'Buy' | 'Sell';
  shares: number;
  cost_per_share: number;
  commission: number;
  total_cost: number;
  realized_gain_pct: number | null;
  realized_gain_amt: number | null;
  note: string;
}

interface Dividend {
  id?: number;
  date: string;
  amount: number;
  per_share: number;
  note: string;
}

type SubTab = 'lots' | 'transactions' | 'dividends';

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined) return '--';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '--';
  const sign = v > 0 ? '+' : '';
  return sign + v.toFixed(2) + '%';
}

function gainClass(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (v > 0) return 'yf-positive';
  if (v < 0) return 'yf-negative';
  return '';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExpandedRow({ symbol, lastPrice, colSpan, onDataChange }: ExpandedRowProps) {
  const [activeTab, setActiveTab] = React.useState<SubTab>('lots');

  // Data state
  const [lots, setLots] = React.useState<Lot[]>([]);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [dividends, setDividends] = React.useState<Dividend[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Add-form visibility
  const [showAddLot, setShowAddLot] = React.useState(false);
  const [showAddTxn, setShowAddTxn] = React.useState(false);
  const [showAddDiv, setShowAddDiv] = React.useState(false);

  // Add-form state
  const [newLot, setNewLot] = React.useState({
    date: '', shares: '', cost_per_share: '', low_limit: '', high_limit: '', note: '',
  });
  const [newTxn, setNewTxn] = React.useState({
    date: '', type: 'Buy' as 'Buy' | 'Sell', shares: '', cost_per_share: '', commission: '', note: '',
  });
  const [newDiv, setNewDiv] = React.useState({
    date: '', amount: '', per_share: '', note: '',
  });

  // ── Fetch data ──────────────────────────────────────────────────────────────

  const fetchLots = React.useCallback(async () => {
    try {
      const res = await fetch(API_BASE_URL + '/api/portfolio/lots/' + symbol);
      if (res.ok) setLots(await res.json());
    } catch (e) {
      console.error('Failed to fetch lots', e);
    }
  }, [symbol]);

  const fetchTransactions = React.useCallback(async () => {
    try {
      const res = await fetch(API_BASE_URL + '/api/portfolio/transactions/' + symbol);
      if (res.ok) setTransactions(await res.json());
    } catch (e) {
      console.error('Failed to fetch transactions', e);
    }
  }, [symbol]);

  const fetchDividends = React.useCallback(async () => {
    try {
      const res = await fetch(API_BASE_URL + '/api/portfolio/dividends/' + symbol);
      if (res.ok) setDividends(await res.json());
    } catch (e) {
      console.error('Failed to fetch dividends', e);
    }
  }, [symbol]);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([fetchLots(), fetchTransactions(), fetchDividends()]).finally(() =>
      setLoading(false),
    );
  }, [fetchLots, fetchTransactions, fetchDividends]);

  // ── Add handlers ────────────────────────────────────────────────────────────

  const handleAddLot = async () => {
    try {
      const body = {
        symbol,
        date: newLot.date,
        shares: parseFloat(newLot.shares) || 0,
        cost_per_share: parseFloat(newLot.cost_per_share) || 0,
        low_limit: newLot.low_limit ? parseFloat(newLot.low_limit) : null,
        high_limit: newLot.high_limit ? parseFloat(newLot.high_limit) : null,
        note: newLot.note,
      };
      const res = await fetch(API_BASE_URL + '/api/portfolio/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchLots();
        setNewLot({ date: '', shares: '', cost_per_share: '', low_limit: '', high_limit: '', note: '' });
        setShowAddLot(false);
        if (onDataChange) onDataChange();
      }
    } catch (e) {
      console.error('Failed to add lot', e);
    }
  };

  const handleAddTxn = async () => {
    try {
      const body = {
        symbol,
        date: newTxn.date,
        type: newTxn.type,
        shares: parseFloat(newTxn.shares) || 0,
        cost_per_share: parseFloat(newTxn.cost_per_share) || 0,
        commission: parseFloat(newTxn.commission) || 0,
        note: newTxn.note,
      };
      const res = await fetch(API_BASE_URL + '/api/portfolio/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchTransactions();
        setNewTxn({ date: '', type: 'Buy', shares: '', cost_per_share: '', commission: '', note: '' });
        setShowAddTxn(false);
        if (onDataChange) onDataChange();
      }
    } catch (e) {
      console.error('Failed to add transaction', e);
    }
  };

  const handleAddDiv = async () => {
    try {
      const body = {
        symbol,
        date: newDiv.date,
        amount: parseFloat(newDiv.amount) || 0,
        per_share: parseFloat(newDiv.per_share) || 0,
        note: newDiv.note,
      };
      const res = await fetch(API_BASE_URL + '/api/portfolio/dividends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await fetchDividends();
        setNewDiv({ date: '', amount: '', per_share: '', note: '' });
        setShowAddDiv(false);
        if (onDataChange) onDataChange();
      }
    } catch (e) {
      console.error('Failed to add dividend', e);
    }
  };

  // ── Delete handlers ─────────────────────────────────────────────────────────

  const handleDeleteLot = async (id: number | undefined) => {
    if (!id) return;
    try {
      const res = await fetch(API_BASE_URL + '/api/portfolio/lots/' + id, { method: 'DELETE' });
      if (res.ok) {
        await fetchLots();
        if (onDataChange) onDataChange();
      }
    } catch (e) {
      console.error('Failed to delete lot', e);
    }
  };

  const handleDeleteTxn = async (id: number | undefined) => {
    if (!id) return;
    try {
      const res = await fetch(API_BASE_URL + '/api/portfolio/transactions/' + id, { method: 'DELETE' });
      if (res.ok) {
        await fetchTransactions();
        if (onDataChange) onDataChange();
      }
    } catch (e) {
      console.error('Failed to delete transaction', e);
    }
  };

  const handleDeleteDiv = async (id: number | undefined) => {
    if (!id) return;
    try {
      const res = await fetch(API_BASE_URL + '/api/portfolio/dividends/' + id, { method: 'DELETE' });
      if (res.ok) {
        await fetchDividends();
        if (onDataChange) onDataChange();
      }
    } catch (e) {
      console.error('Failed to delete dividend', e);
    }
  };

  // ── Render sub-tables ───────────────────────────────────────────────────────

  const renderLots = () => (
    <>
      <table className="yf-sub-table">
        <thead>
          <tr>
            <th className="left">Date</th>
            <th>Shares</th>
            <th>Cost/Share ($)</th>
            <th>Total Cost ($)</th>
            <th>Market Value ($)</th>
            <th>Day Gain (%)</th>
            <th>Day Gain ($)</th>
            <th>Tot Gain (%)</th>
            <th>Tot Gain ($)</th>
            <th>Low Limit</th>
            <th>High Limit</th>
            <th className="left">Note</th>
            <th style={{ width: 36 }}>&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot, i) => (
            <tr key={lot.id ?? i}>
              <td className="left">{lot.date}</td>
              <td>{fmtNum(lot.shares, 0)}</td>
              <td>{fmtNum(lot.cost_per_share)}</td>
              <td>{fmtNum(lot.total_cost)}</td>
              <td>{fmtNum(lot.market_value)}</td>
              <td className={gainClass(lot.day_gain_pct)}>{fmtPct(lot.day_gain_pct)}</td>
              <td className={gainClass(lot.day_gain_amt)}>{fmtNum(lot.day_gain_amt)}</td>
              <td className={gainClass(lot.tot_gain_pct)}>{fmtPct(lot.tot_gain_pct)}</td>
              <td className={gainClass(lot.tot_gain_amt)}>{fmtNum(lot.tot_gain_amt)}</td>
              <td>{fmtNum(lot.low_limit)}</td>
              <td>{fmtNum(lot.high_limit)}</td>
              <td className="left">{lot.note || '--'}</td>
              <td>
                <button
                  className="yf-chevron"
                  onClick={() => handleDeleteLot(lot.id)}
                  aria-label="Delete lot"
                >
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}

          {lots.length === 0 && !showAddLot && (
            <tr>
              <td colSpan={13} className="left" style={{ padding: '16px 10px', opacity: 0.5 }}>
                No share lots recorded.
              </td>
            </tr>
          )}

          {showAddLot && (
            <tr className="yf-add-row">
              <td className="left">
                <Input size="sm" type="date" value={newLot.date}
                  onChange={(e) => setNewLot({ ...newLot, date: e.target.value })} />
              </td>
              <td>
                <Input size="sm" type="number" placeholder="0"
                  value={newLot.shares}
                  onChange={(e) => setNewLot({ ...newLot, shares: e.target.value })} />
              </td>
              <td>
                <Input size="sm" type="number" placeholder="0.00"
                  value={newLot.cost_per_share}
                  onChange={(e) => setNewLot({ ...newLot, cost_per_share: e.target.value })} />
              </td>
              <td colSpan={4}>&nbsp;</td>
              <td colSpan={2}>&nbsp;</td>
              <td>
                <Input size="sm" type="number" placeholder="Low"
                  value={newLot.low_limit}
                  onChange={(e) => setNewLot({ ...newLot, low_limit: e.target.value })} />
              </td>
              <td>
                <Input size="sm" type="number" placeholder="High"
                  value={newLot.high_limit}
                  onChange={(e) => setNewLot({ ...newLot, high_limit: e.target.value })} />
              </td>
              <td className="left">
                <Input size="sm" placeholder="Note"
                  value={newLot.note}
                  onChange={(e) => setNewLot({ ...newLot, note: e.target.value })} />
              </td>
              <td>
                <Button size="sm" variant="solid" color="primary" onClick={handleAddLot}
                  sx={{ minWidth: 0, px: 1 }}>
                  ✓
                </Button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Box sx={{ mt: 1 }}>
        <Button
          size="sm"
          variant="plain"
          color="primary"
          startDecorator={<Plus size={14} />}
          onClick={() => setShowAddLot(!showAddLot)}
        >
          {showAddLot ? 'Cancel' : 'Add Lot'}
        </Button>
      </Box>
    </>
  );

  const renderTransactions = () => (
    <>
      <table className="yf-sub-table">
        <thead>
          <tr>
            <th className="left">Date</th>
            <th className="left">Type</th>
            <th>Shares</th>
            <th>Cost/Share ($)</th>
            <th>Comm</th>
            <th>Total Cost ($)</th>
            <th>Realized (%)</th>
            <th>Realized ($)</th>
            <th className="left">Note</th>
            <th style={{ width: 36 }}>&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn, i) => (
            <tr key={txn.id ?? i}>
              <td className="left">{txn.date}</td>
              <td className="left">{txn.type}</td>
              <td>{fmtNum(txn.shares, 0)}</td>
              <td>{fmtNum(txn.cost_per_share)}</td>
              <td>{fmtNum(txn.commission)}</td>
              <td>{fmtNum(txn.total_cost)}</td>
              <td className={gainClass(txn.realized_gain_pct)}>{fmtPct(txn.realized_gain_pct)}</td>
              <td className={gainClass(txn.realized_gain_amt)}>{fmtNum(txn.realized_gain_amt)}</td>
              <td className="left">{txn.note || '--'}</td>
              <td>
                <button
                  className="yf-chevron"
                  onClick={() => handleDeleteTxn(txn.id)}
                  aria-label="Delete transaction"
                >
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}

          {transactions.length === 0 && !showAddTxn && (
            <tr>
              <td colSpan={10} className="left" style={{ padding: '16px 10px', opacity: 0.5 }}>
                No transactions recorded.
              </td>
            </tr>
          )}

          {showAddTxn && (
            <tr className="yf-add-row">
              <td className="left">
                <Input size="sm" type="date" value={newTxn.date}
                  onChange={(e) => setNewTxn({ ...newTxn, date: e.target.value })} />
              </td>
              <td className="left">
                <Select size="sm" value={newTxn.type}
                  onChange={(_e, val) => setNewTxn({ ...newTxn, type: (val as 'Buy' | 'Sell') || 'Buy' })}>
                  <Option value="Buy">Buy</Option>
                  <Option value="Sell">Sell</Option>
                </Select>
              </td>
              <td>
                <Input size="sm" type="number" placeholder="0"
                  value={newTxn.shares}
                  onChange={(e) => setNewTxn({ ...newTxn, shares: e.target.value })} />
              </td>
              <td>
                <Input size="sm" type="number" placeholder="0.00"
                  value={newTxn.cost_per_share}
                  onChange={(e) => setNewTxn({ ...newTxn, cost_per_share: e.target.value })} />
              </td>
              <td>
                <Input size="sm" type="number" placeholder="0.00"
                  value={newTxn.commission}
                  onChange={(e) => setNewTxn({ ...newTxn, commission: e.target.value })} />
              </td>
              <td colSpan={3}>&nbsp;</td>
              <td className="left">
                <Input size="sm" placeholder="Note"
                  value={newTxn.note}
                  onChange={(e) => setNewTxn({ ...newTxn, note: e.target.value })} />
              </td>
              <td>
                <Button size="sm" variant="solid" color="primary" onClick={handleAddTxn}
                  sx={{ minWidth: 0, px: 1 }}>
                  ✓
                </Button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Box sx={{ mt: 1 }}>
        <Button
          size="sm"
          variant="plain"
          color="primary"
          startDecorator={<Plus size={14} />}
          onClick={() => setShowAddTxn(!showAddTxn)}
        >
          {showAddTxn ? 'Cancel' : 'Add Transaction'}
        </Button>
      </Box>
    </>
  );

  const renderDividends = () => (
    <>
      <table className="yf-sub-table">
        <thead>
          <tr>
            <th className="left">Date</th>
            <th>Amount ($)</th>
            <th>Per Share ($)</th>
            <th className="left">Note</th>
            <th style={{ width: 36 }}>&nbsp;</th>
          </tr>
        </thead>
        <tbody>
          {dividends.map((div, i) => (
            <tr key={div.id ?? i}>
              <td className="left">{div.date}</td>
              <td>{fmtNum(div.amount)}</td>
              <td>{fmtNum(div.per_share)}</td>
              <td className="left">{div.note || '--'}</td>
              <td>
                <button
                  className="yf-chevron"
                  onClick={() => handleDeleteDiv(div.id)}
                  aria-label="Delete dividend"
                >
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}

          {dividends.length === 0 && !showAddDiv && (
            <tr>
              <td colSpan={5} className="left" style={{ padding: '16px 10px', opacity: 0.5 }}>
                No dividends recorded.
              </td>
            </tr>
          )}

          {showAddDiv && (
            <tr className="yf-add-row">
              <td className="left">
                <Input size="sm" type="date" value={newDiv.date}
                  onChange={(e) => setNewDiv({ ...newDiv, date: e.target.value })} />
              </td>
              <td>
                <Input size="sm" type="number" placeholder="0.00"
                  value={newDiv.amount}
                  onChange={(e) => setNewDiv({ ...newDiv, amount: e.target.value })} />
              </td>
              <td>
                <Input size="sm" type="number" placeholder="0.00"
                  value={newDiv.per_share}
                  onChange={(e) => setNewDiv({ ...newDiv, per_share: e.target.value })} />
              </td>
              <td className="left">
                <Input size="sm" placeholder="Note"
                  value={newDiv.note}
                  onChange={(e) => setNewDiv({ ...newDiv, note: e.target.value })} />
              </td>
              <td>
                <Button size="sm" variant="solid" color="primary" onClick={handleAddDiv}
                  sx={{ minWidth: 0, px: 1 }}>
                  ✓
                </Button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <Box sx={{ mt: 1 }}>
        <Button
          size="sm"
          variant="plain"
          color="primary"
          startDecorator={<Plus size={14} />}
          onClick={() => setShowAddDiv(!showAddDiv)}
        >
          {showAddDiv ? 'Cancel' : 'Add Dividend'}
        </Button>
      </Box>
    </>
  );

  // ── Main render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography level="body-sm" sx={{ opacity: 0.5 }}>
          Loading {symbol} details...
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="yf-portfolio">
      {/* Sub-tabs */}
      <div className="yf-sub-tabs">
        {(['lots', 'transactions', 'dividends'] as SubTab[]).map((tab) => (
          <button
            key={tab}
            className={'yf-sub-tab' + (activeTab === tab ? ' active' : '')}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'lots' ? 'Share Lots' : tab === 'transactions' ? 'Transactions' : 'Dividends'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'lots' && renderLots()}
      {activeTab === 'transactions' && renderTransactions()}
      {activeTab === 'dividends' && renderDividends()}
    </Box>
  );
}
