import { fmtNum, fmtPct, fmtShares, gainClass } from '../../../utils/format';
import * as React from 'react';
import { Box, Typography, Input, Select, Option, Button } from '@mui/joy';
import { Plus, Trash2, Check, Pencil, X } from 'lucide-react';
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


// ── Component ─────────────────────────────────────────────────────────────────

export default function ExpandedRow({ symbol, lastPrice, colSpan, onDataChange }: ExpandedRowProps) {
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const [activeTab, setActiveTab] = React.useState<SubTab>('lots');
  const showMoneyValues = useSettingsStore(state => state.showMoneyValues);

  const displayNum = (v: number | null | undefined, decimals = 2) => showMoneyValues ? fmtNum(v, decimals) : '••••••';
  const displayShares = (v: number | null | undefined) => showMoneyValues ? fmtShares(v) : '••••••';
  const displayPct = (v: number | null | undefined) => fmtPct(v);

  const {
    lots,
    transactions,
    dividends,
    loading,
    addLot,
    addTxn,
    updateTxn,
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
    date: getTodayDate(), type: 'Buy' as 'Buy' | 'Sell', shares: '', cost_per_share: '', commission: '', note: '',
  });
  const [newDiv, setNewDiv] = React.useState({
    date: getTodayDate(), amount: '', per_share: '', note: '',
  });

  // Edit-transaction state
  const [editingTxnId, setEditingTxnId] = React.useState<number | null>(null);
  const [editingTxn, setEditingTxn] = React.useState({
    date: '', type: 'Buy' as 'Buy' | 'Sell', shares: '', cost_per_share: '', commission: '', note: '',
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
    if (!newTxn.date) {
      alert('Please select a Date.');
      return;
    }
    if (!newTxn.shares || parseFloat(newTxn.shares) <= 0) {
      alert('Please enter a valid number of Shares.');
      return;
    }
    if (!newTxn.cost_per_share || parseFloat(newTxn.cost_per_share) <= 0) {
      alert('Please enter a valid Cost/Share.');
      return;
    }
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
        setNewTxn({ date: getTodayDate(), type: 'Buy', shares: '', cost_per_share: '', commission: '', note: '' });
        setShowForms(prev => ({ ...prev, txn: false }));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to add transaction: ${errData.error || res.statusText}`);
      }
    } catch (e) {
      console.error('Failed to add transaction', e);
      alert('Failed to add transaction. Please check console.');
    }
  };

  const startEditTxn = (txn: Transaction) => {
    if (txn.id !== undefined) {
      setEditingTxnId(txn.id);
      setEditingTxn({
        date: txn.date,
        type: txn.type,
        shares: txn.shares.toString(),
        cost_per_share: txn.cost_per_share.toString(),
        commission: (txn.commission || 0).toString(),
        note: txn.note || '',
      });
    }
  };

  const cancelEditTxn = () => {
    setEditingTxnId(null);
    setEditingTxn({
      date: '', type: 'Buy', shares: '', cost_per_share: '', commission: '', note: '',
    });
  };

  const handleUpdateTxn = async () => {
    if (editingTxnId === null) return;
    if (!editingTxn.date) {
      alert('Please select a Date.');
      return;
    }
    if (!editingTxn.shares || parseFloat(editingTxn.shares) <= 0) {
      alert('Please enter a valid number of Shares.');
      return;
    }
    if (!editingTxn.cost_per_share || parseFloat(editingTxn.cost_per_share) <= 0) {
      alert('Please enter a valid Cost/Share.');
      return;
    }
    try {
      const res = await updateTxn(editingTxnId, {
        date: editingTxn.date,
        type: editingTxn.type,
        shares: parseFloat(editingTxn.shares) || 0,
        cost_per_share: parseFloat(editingTxn.cost_per_share) || 0,
        commission: parseFloat(editingTxn.commission) || 0,
        note: editingTxn.note,
      });
      if (res.ok) {
        setEditingTxnId(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to update transaction: ${errData.error || res.statusText}`);
      }
    } catch (e) {
      console.error('Failed to update transaction', e);
      alert('Failed to update transaction. Please check console.');
    }
  };

  const handleAddDiv = async () => {
    if (!newDiv.date) {
      alert('Please select a Date.');
      return;
    }
    if (!newDiv.amount || parseFloat(newDiv.amount) <= 0) {
      alert('Please enter a valid Amount.');
      return;
    }
    try {
      const res = await addDiv({
        date: newDiv.date,
        amount: parseFloat(newDiv.amount) || 0,
        per_share: parseFloat(newDiv.per_share) || 0,
        note: newDiv.note,
      });
      if (res.ok) {
        setNewDiv({ date: getTodayDate(), amount: '', per_share: '', note: '' });
        setShowForms(prev => ({ ...prev, div: false }));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to add dividend: ${errData.error || res.statusText}`);
      }
    } catch (e) {
      console.error('Failed to add dividend', e);
      alert('Failed to add dividend. Please check console.');
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
              <td>{displayShares(lot.shares)}</td>
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

          {lots.length === 0 && (
            <tr>
              <td colSpan={13} className="left" style={{ padding: '16px 10px', opacity: 0.5 }}>
                No share lots recorded.
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
            <th style={{ width: 72 }}>&nbsp;</th>
          </tr>
        </thead>
        <tbody>
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
                <Button size="sm" variant="solid" color="success" onClick={handleAddTxn}
                  sx={{ minWidth: 0, px: 1 }}>
                  <Check size={14} />
                </Button>
              </td>
            </tr>
          )}

          {transactions.map((txn, i) => {
            const isEditing = txn.id === editingTxnId;
            if (isEditing) {
              return (
                <tr className="yf-add-row" key={txn.id ?? i}>
                  <td className="left">
                    <Input size="sm" type="date" value={editingTxn.date}
                      onChange={(e) => setEditingTxn({ ...editingTxn, date: e.target.value })} />
                  </td>
                  <td className="left">
                    <Select size="sm" value={editingTxn.type}
                      onChange={(_e, val) => setEditingTxn({ ...editingTxn, type: (val as 'Buy' | 'Sell') || 'Buy' })}>
                      <Option value="Buy">Buy</Option>
                      <Option value="Sell">Sell</Option>
                    </Select>
                  </td>
                  <td>
                    <Input size="sm" type="number" placeholder="0"
                      value={editingTxn.shares}
                      onChange={(e) => setEditingTxn({ ...editingTxn, shares: e.target.value })} />
                  </td>
                  <td>
                    <Input size="sm" type="number" placeholder="0.00"
                      value={editingTxn.cost_per_share}
                      onChange={(e) => setEditingTxn({ ...editingTxn, cost_per_share: e.target.value })} />
                  </td>
                  <td>
                    <Input size="sm" type="number" placeholder="0.00"
                      value={editingTxn.commission}
                      onChange={(e) => setEditingTxn({ ...editingTxn, commission: e.target.value })} />
                  </td>
                  <td colSpan={3}>&nbsp;</td>
                  <td className="left">
                    <Input size="sm" placeholder="Note"
                      value={editingTxn.note}
                      onChange={(e) => setEditingTxn({ ...editingTxn, note: e.target.value })} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Button size="sm" variant="solid" color="success" onClick={handleUpdateTxn}
                      sx={{ minWidth: 0, px: 1, mr: 0.5 }}>
                      <Check size={14} />
                    </Button>
                    <Button size="sm" variant="outlined" color="neutral" onClick={cancelEditTxn}
                      sx={{ minWidth: 0, px: 1 }}>
                      <X size={14} />
                    </Button>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={txn.id ?? i}>
                <td className="left">{txn.date}</td>
                <td className="left">{txn.type}</td>
                <td>{displayShares(txn.shares)}</td>
                <td>{displayNum(txn.cost_per_share)}</td>
                <td>{displayNum(txn.commission)}</td>
                <td>{displayNum(txn.total_cost)}</td>
                <td className={gainClass(txn.realized_gain_pct)}>{displayPct(txn.realized_gain_pct)}</td>
                <td className={gainClass(txn.realized_gain_amt)}>{displayNum(txn.realized_gain_amt)}</td>
                <td className="left">{txn.note || '--'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="yf-chevron"
                    onClick={() => startEditTxn(txn)}
                    style={{ marginRight: 4 }}
                    aria-label="Edit transaction"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="yf-chevron"
                    onClick={() => handleDeleteTxn(txn.id)}
                    aria-label="Delete transaction"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            );
          })}

          {transactions.length === 0 && !showForms.txn && (
            <tr>
              <td colSpan={10} className="left" style={{ padding: '16px 10px', opacity: 0.5 }}>
                No transactions recorded.
              </td>
            </tr>
          )}</tbody>
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
                <Button size="sm" variant="solid" color="success" onClick={handleAddDiv}
                  sx={{ minWidth: 0, px: 1 }}>
                  <Check size={14} />
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
