import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../../../../config';

export interface Lot {
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

export interface Transaction {
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

export interface Dividend {
  id?: number;
  date: string;
  amount: number;
  per_share: number;
  note: string;
}

export function useHoldingDetails(symbol: string, onDataChange?: () => void) {
  const [lots, setLots] = useState<Lot[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLots = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/lots/${symbol}`);
      if (res.ok) setLots(await res.json());
    } catch (e) {
      console.error('Failed to fetch lots', e);
    }
  }, [symbol]);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/transactions/${symbol}`);
      if (res.ok) setTransactions(await res.json());
    } catch (e) {
      console.error('Failed to fetch transactions', e);
    }
  }, [symbol]);

  const fetchDividends = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/dividends/${symbol}`);
      if (res.ok) setDividends(await res.json());
    } catch (e) {
      console.error('Failed to fetch dividends', e);
    }
  }, [symbol]);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchLots(), fetchTransactions(), fetchDividends()]).finally(() =>
      setLoading(false)
    );
  }, [fetchLots, fetchTransactions, fetchDividends]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addLot = async (lot: {
    date: string;
    shares: number;
    cost_per_share: number;
    low_limit: number | null;
    high_limit: number | null;
    note: string;
  }) => {
    const res = await fetch(`${API_BASE_URL}/api/portfolio/lots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, ...lot }),
    });
    if (res.ok) {
      await fetchLots();
      if (onDataChange) onDataChange();
    }
    return res;
  };

  const addTxn = async (txn: {
    date: string;
    type: 'Buy' | 'Sell';
    shares: number;
    cost_per_share: number;
    commission: number;
    note: string;
  }) => {
    const res = await fetch(`${API_BASE_URL}/api/portfolio/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, ...txn }),
    });
    if (res.ok) {
      await fetchTransactions();
      if (onDataChange) onDataChange();
    }
    return res;
  };

  const updateTxn = async (id: number, txn: {
    date: string;
    type: 'Buy' | 'Sell';
    shares: number;
    cost_per_share: number;
    commission: number;
    note: string;
  }) => {
    const res = await fetch(`${API_BASE_URL}/api/portfolio/transactions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txn),
    });
    if (res.ok) {
      await fetchTransactions();
      if (onDataChange) onDataChange();
    }
    return res;
  };

  const addDiv = async (div: {
    date: string;
    amount: number;
    per_share: number;
    note: string;
  }) => {
    const res = await fetch(`${API_BASE_URL}/api/portfolio/dividends`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, ...div }),
    });
    if (res.ok) {
      await fetchDividends();
      if (onDataChange) onDataChange();
    }
    return res;
  };

  const deleteLot = async (id: number | undefined) => {
    if (!id) return;
    const res = await fetch(`${API_BASE_URL}/api/portfolio/lots/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchLots();
      if (onDataChange) onDataChange();
    }
    return res;
  };

  const deleteTxn = async (id: number | undefined) => {
    if (!id) return;
    const res = await fetch(`${API_BASE_URL}/api/portfolio/transactions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchTransactions();
      if (onDataChange) onDataChange();
    }
    return res;
  };

  const deleteSymbolTransactions = async () => {
    const res = await fetch(`${API_BASE_URL}/api/portfolio/transactions/symbol/${symbol}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await fetchTransactions();
      if (onDataChange) onDataChange();
    }
    return res;
  };

  const deleteDiv = async (id: number | undefined) => {
    if (!id) return;
    const res = await fetch(`${API_BASE_URL}/api/portfolio/dividends/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchDividends();
      if (onDataChange) onDataChange();
    }
    return res;
  };

  return {
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
    deleteDiv,
    deleteSymbolTransactions,
  };
}
