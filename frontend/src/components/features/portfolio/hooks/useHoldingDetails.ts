import { useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../../../../config';
import { useQuery } from '../../../../utils/useQuery';
import { useMutation } from '../../../../utils/useMutation';
import { invalidateQueries } from '../../../../utils/invalidateQueries';
import { useQueryCache } from '../../../../store/queryCache';

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
  const lotsKey = `lots:${symbol}`;
  const txnKey = `transactions:${symbol}`;
  const divKey = `dividends:${symbol}`;

  const { data: lots = [], isLoading: lotsLoading } = useQuery<Lot[]>(
    lotsKey,
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/lots/${symbol}`);
      if (!res.ok) throw new Error('Failed to fetch lots');
      return res.json();
    }
  );

  const { data: transactions = [], isLoading: txnLoading } = useQuery<Transaction[]>(
    txnKey,
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/transactions/${symbol}`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json();
    }
  );

  const { data: dividends = [], isLoading: divLoading } = useQuery<Dividend[]>(
    divKey,
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/dividends/${symbol}`);
      if (!res.ok) throw new Error('Failed to fetch dividends');
      return res.json();
    }
  );

  const loading = lotsLoading || txnLoading || divLoading;

  // --- addLot ---
  const { mutateAsync: addLot, isPending: isAddingLot } = useMutation(
    async (lot: { date: string; shares: number; cost_per_share: number; low_limit: number | null; high_limit: number | null; note: string }) => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, ...lot }),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: (lot) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<Lot[]>(lotsKey).data ?? [];
        // Optimistically add with placeholder computed fields.
        setEntry(lotsKey, {
          data: [...prev, { ...lot, total_cost: lot.shares * lot.cost_per_share, market_value: null, day_gain_pct: null, day_gain_amt: null, tot_gain_pct: null, tot_gain_amt: null }] as unknown[],
        });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(lotsKey, { data: snapshot as unknown[] });
      },
      onSuccess: () => { invalidateQueries(lotsKey); onDataChange?.(); },
    }
  );

  // --- deleteLot ---
  const { mutateAsync: _deleteLot } = useMutation(
    async (id: number) => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/lots/${id}`, { method: 'DELETE' });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: (id) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<Lot[]>(lotsKey).data ?? [];
        setEntry(lotsKey, { data: prev.filter(l => l.id !== id) as unknown[] });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(lotsKey, { data: snapshot as unknown[] });
      },
      onSuccess: () => { invalidateQueries(lotsKey); onDataChange?.(); },
    }
  );

  const deleteLot = useCallback(
    (id: number | undefined) => { if (id != null) _deleteLot(id); },
    [_deleteLot]
  );

  // --- addTxn ---
  const { mutateAsync: addTxn, isPending: isAddingTxn } = useMutation(
    async (txn: { date: string; type: 'Buy' | 'Sell'; shares: number; cost_per_share: number; commission: number; note: string }) => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, ...txn }),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: (txn) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<Transaction[]>(txnKey).data ?? [];
        setEntry(txnKey, {
          data: [...prev, { ...txn, total_cost: txn.shares * txn.cost_per_share + txn.commission, realized_gain_pct: null, realized_gain_amt: null }] as unknown[],
        });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(txnKey, { data: snapshot as unknown[] });
      },
      onSuccess: () => { invalidateQueries(txnKey); onDataChange?.(); },
    }
  );

  // --- updateTxn ---
  const { mutateAsync: _updateTxn, isPending: isUpdatingTxn } = useMutation(
    async ({ id, txn }: { id: number; txn: { date: string; type: 'Buy' | 'Sell'; shares: number; cost_per_share: number; commission: number; note: string } }) => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txn),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: ({ id, txn }) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<Transaction[]>(txnKey).data ?? [];
        setEntry(txnKey, {
          data: prev.map(t => t.id === id ? { ...t, ...txn } : t) as unknown[],
        });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(txnKey, { data: snapshot as unknown[] });
      },
      onSuccess: () => { invalidateQueries(txnKey); onDataChange?.(); },
    }
  );

  const updateTxn = useCallback(
    (id: number, txn: { date: string; type: 'Buy' | 'Sell'; shares: number; cost_per_share: number; commission: number; note: string }) =>
      _updateTxn({ id, txn }),
    [_updateTxn]
  );

  // --- deleteTxn ---
  const { mutateAsync: _deleteTxn } = useMutation(
    async (id: number) => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/transactions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: (id) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<Transaction[]>(txnKey).data ?? [];
        setEntry(txnKey, { data: prev.filter(t => t.id !== id) as unknown[] });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(txnKey, { data: snapshot as unknown[] });
      },
      onSuccess: () => { invalidateQueries(txnKey); onDataChange?.(); },
    }
  );

  const deleteTxn = useCallback(
    (id: number | undefined) => { if (id != null) _deleteTxn(id); },
    [_deleteTxn]
  );

  // --- deleteSymbolTransactions ---
  const { mutateAsync: deleteSymbolTransactions } = useMutation(
    async () => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/transactions/symbol/${symbol}`, { method: 'DELETE' });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: () => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<Transaction[]>(txnKey).data ?? [];
        setEntry(txnKey, { data: [] });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(txnKey, { data: snapshot as unknown[] });
      },
      onSuccess: () => { invalidateQueries(txnKey); onDataChange?.(); },
    }
  );

  // --- addDiv ---
  const { mutateAsync: addDiv, isPending: isAddingDiv } = useMutation(
    async (div: { date: string; amount: number; per_share: number; note: string }) => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/dividends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, ...div }),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: (div) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<Dividend[]>(divKey).data ?? [];
        setEntry(divKey, { data: [...prev, div] as unknown[] });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(divKey, { data: snapshot as unknown[] });
      },
      onSuccess: () => { invalidateQueries(divKey); onDataChange?.(); },
    }
  );

  // --- deleteDiv ---
  const { mutateAsync: _deleteDiv } = useMutation(
    async (id: number) => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/dividends/${id}`, { method: 'DELETE' });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: (id) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<Dividend[]>(divKey).data ?? [];
        setEntry(divKey, { data: prev.filter(d => d.id !== id) as unknown[] });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(divKey, { data: snapshot as unknown[] });
      },
      onSuccess: () => { invalidateQueries(divKey); onDataChange?.(); },
    }
  );

  const deleteDiv = useCallback(
    (id: number | undefined) => { if (id != null) _deleteDiv(id); },
    [_deleteDiv]
  );

  // --- updateDiv ---
  const { mutateAsync: _updateDiv, isPending: isUpdatingDiv } = useMutation(
    async ({ id, div }: { id: number; div: { date: string; amount: number; per_share: number; note: string } }) => {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/dividends/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(div),
      });
      if (!res.ok) throw res;
      return res;
    },
    {
      onMutate: ({ id, div }) => {
        const { getEntry, setEntry } = useQueryCache.getState();
        const prev = getEntry<Dividend[]>(divKey).data ?? [];
        setEntry(divKey, {
          data: prev.map(d => d.id === id ? { ...d, ...div } : d) as unknown[],
        });
        return prev;
      },
      onError: (_err, _vars, snapshot) => {
        useQueryCache.getState().setEntry(divKey, { data: snapshot as unknown[] });
      },
      onSuccess: () => { invalidateQueries(divKey); onDataChange?.(); },
    }
  );

  const updateDiv = useCallback(
    (id: number, div: { date: string; amount: number; per_share: number; note: string }) =>
      _updateDiv({ id, div }),
    [_updateDiv]
  );

  const saving = useMemo(() => ({
    lot: isAddingLot,
    txn: isAddingTxn,
    div: isAddingDiv,
    updateTxn: isUpdatingTxn,
    updateDiv: isUpdatingDiv,
    any: isAddingLot || isAddingTxn || isUpdatingTxn || isAddingDiv || isUpdatingDiv,
  }), [isAddingLot, isAddingTxn, isUpdatingTxn, isAddingDiv, isUpdatingDiv]);

  return {
    lots,
    transactions,
    dividends,
    loading,
    saving,
    addLot,
    addTxn,
    updateTxn,
    addDiv,
    updateDiv,
    deleteLot,
    deleteTxn,
    deleteDiv,
    deleteSymbolTransactions,
  };
}
