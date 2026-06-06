import * as React from 'react';
import { Box, Typography, Input, Select, Option, Button } from '@mui/joy';
import { Plus, Trash2 } from 'lucide-react';
import { useHoldingDetails } from '../portfolio/hooks/useHoldingDetails';
import type { Lot, Transaction, Dividend } from '../portfolio/hooks/useHoldingDetails';
import '../../../styles/yahooPortfolio.css';
import { useSettingsStore } from '../../../store/settingsStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExpandedRowProps {
  symbol: string;
  lastPrice: number | null;
  colSpan: number;
  onDataChange?: () => void;
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
  const showMoneyValues = useSettingsStore(state => state.showMoneyValues);

  const displayNum = (v: number | null | undefined, decimals = 2) => showMoneyValues ? fmtNum(v, decimals) : '•••••';
  const displayPct = (v: number | null | undefined) => fmtPct(v);

  const {
    lots,
    transactions,
    dividends,
    loading,
    addLot,
    addTxn,
    addDiv,
    deleteLot,
    deleteTxn,
    deleteDiv
  } = useHoldingDetails(symbol, onDataChange);

  // Add-form visibility state
  const [showForms, setShowForms] = React.useState({
    lot: false,
    txn: false,
    div: false
  });

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

  // ── Add handlers ────────────────────────────────────────────────────────────

  const handleAddLot = async () => {
    try {
      const res = await addLot({
        date: newLot.date,
        shares: parseFloat(newLot.shares) || 0,
        cost_per_share: parseFloat(newLot.cost_per_share) || 0,
        low_limit: newLot.low_limit ? parseFloat(newLot.low_limit) : null,
        high_limit: newLot.high_limit ? parseFloat(newLot.high_limit) : null,
        note: newLot.note,
      });
      if (res.ok) {
        setNewLot({ date: '', shares: '', cost_per_share: '', low_limit: '', high_limit: '', note: '' });
        setShowForms(prev => ({ ...prev, lot: false }));
      }
    } catch (e) {
      console.error('Failed to add lot', e);
    }
  };

  const handleAddTxn = async () => {
    try {
      const res = await addTxn({
        date: newTxn.date,
        type: newTxn.type,
        shares: parseFloat(newTxn.shares) || 0,
        cost_per_share: parseFloat(newTxn.cost_per_share) || 0,
        commission: parseFloat(newTxn.commission) || 0,
        note: newTxn.note,
      });
      if (res.ok) {
        setNewTxn({ date: '', type: 'Buy', shares: '', cost_per_share: '', commission: '', note: '' });
        setShowForms(prev => ({ ...prev, txn: false }));
      }
    } catch (e) {
      console.error('Failed to add transaction', e);
    }
  };

  const handleAddDiv = async () => {
    try {
      const res = await addDiv({
        date: newDiv.date,
        amount: parseFloat(newDiv.amount) || 0,
        per_share: parseFloat(newDiv.per_share) || 0,
        note: newDiv.note,
      });
      if (res.ok) {
        setNewDiv({ date: '', amount: '', per_share: '', note: '' });
        setShowForms(prev => ({ ...prev, div: false }));
      }
    } catch (e) {
      console.error('Failed to add dividend', e);
    }
  };

  // ── Delete handlers ─────────────────────────────────────────────────────────

  const handleDeleteLot = async (id: number | undefined) => {
    try {
      await deleteLot(id);
    } catch (e) {
      console.error('Failed to delete lot', e);
    }
  };

  const handleDeleteTxn = async (id: number | undefined) => {
    try {
      await deleteTxn(id);
    } catch (e) {
      console.error('Failed to delete transaction', e);
    }
  };

  const handleDeleteDiv = async (id: number | undefined) => {
    try {
      await deleteDiv(id);
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
              <td>{displayNum(lot.shares, 0)}</td>
              <td>{displayNum(lot.cost_per_share)}</td>
              <td>{displayNum(lot.total_cost)}</td>
              <td>{displayNum(lot.market_value)}</td>
              <td className={gainClass(lot.day_gain_pct)}>{displayPct(lot.day_gain_pct)}</td>
              <td className={gainClass(lot.day_gain_amt)}>{displayNum(lot.day_gain_amt)}</td>
              <td className={gainClass(lot.tot_gain_pct)}>{displayPct(lot.tot_gain_pct)}</td>
              <td className={gainClass(lot.tot_gain_amt)}>{displayNum(lot.tot_gain_amt)}</td>
              <td>{displayNum(lot.low_limit)}</td>
              <td>{displayNum(lot.high_limit)}</td>
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

          {lots.length === 0 && !showForms.lot && (
            <tr>
              <td colSpan={13} className="left" style={{ padding: '16px 10px', opacity: 0.5 }}>
                No share lots recorded.
              </td>
            </tr>
          )}

          {showForms.lot && (
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
              <td>{displayNum(txn.shares, 0)}</td>
              <td>{displayNum(txn.cost_per_share)}</td>
              <td>{displayNum(txn.commission)}</td>
              <td>{displayNum(txn.total_cost)}</td>
              <td className={gainClass(txn.realized_gain_pct)}>{displayPct(txn.realized_gain_pct)}</td>
              <td className={gainClass(txn.realized_gain_amt)}>{displayNum(txn.realized_gain_amt)}</td>
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

          {transactions.length === 0 && !showForms.txn && (
            <tr>
              <td colSpan={10} className="left" style={{ padding: '16px 10px', opacity: 0.5 }}>
                No transactions recorded.
              </td>
            </tr>
          )}

          {showForms.txn && (
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
              <td>{displayNum(div.amount)}</td>
              <td>{displayNum(div.per_share)}</td>
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

          {dividends.length === 0 && !showForms.div && (
            <tr>
              <td colSpan={5} className="left" style={{ padding: '16px 10px', opacity: 0.5 }}>
                No dividends recorded.
              </td>
            </tr>
          )}

          {showForms.div && (
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

        <Box sx={{ marginLeft: 'auto', alignSelf: 'center', mb: 0.5 }}>
          {activeTab === 'lots' && (
            <Button
              size="sm"
              variant="plain"
              color="primary"
              startDecorator={<Plus size={14} />}
              onClick={() => setShowForms(prev => ({ ...prev, lot: !prev.lot }))}
            >
              {showForms.lot ? 'Cancel' : 'Add Lot'}
            </Button>
          )}
          {activeTab === 'transactions' && (
            <Button
              size="sm"
              variant="plain"
              color="primary"
              startDecorator={<Plus size={14} />}
              onClick={() => setShowForms(prev => ({ ...prev, txn: !prev.txn }))}
            >
              {showForms.txn ? 'Cancel' : 'Add Transaction'}
            </Button>
          )}
          {activeTab === 'dividends' && (
            <Button
              size="sm"
              variant="plain"
              color="primary"
              startDecorator={<Plus size={14} />}
              onClick={() => setShowForms(prev => ({ ...prev, div: !prev.div }))}
            >
              {showForms.div ? 'Cancel' : 'Add Dividend'}
            </Button>
          )}
        </Box>
      </div>

      {/* Tab content */}
      {activeTab === 'lots' && renderLots()}
      {activeTab === 'transactions' && renderTransactions()}
      {activeTab === 'dividends' && renderDividends()}
    </Box>
  );
}
